/**
 * QUV-Lab — Migration légacies (Base64 / Data URI → IndexedDB)
 *
 * Conversion des PhotoReferences legacy dont `storageKey` est une Data URI
 * (data:image/jpeg;base64,... | data:image/svg+xml;utf8,...) vers une clé
 * content-addressed `media/sha256/<64hex>` (repli `media/<hash>` hors contexte
 * sécurisé) et écriture du Blob dans IndexedDB.
 *
 * GARANTIES :
 *  - idempotence : la clé dérive du contenu ; relancer la migration ne recrée
 *    jamais de média dupliqué (comparaison de contenu avant toute écriture).
 *  - collision : une clé existante au contenu DIFFÉRENT n'est jamais écrasée ;
 *    une erreur explicite est signalée et la référence legacy est conservée.
 *  - reprise : en cas d'échec d'un média, la référence legacy est conservée,
 *    les autres continuent ; la migration est rejouable.
 *  - mémoire : traitement séquentiel média par média (pas de Promise.all global).
 *  - atomicité : la référence n'est mise à jour qu'après réussite de l'écriture
 *    IndexedDB ; localStorage n'est réécrit qu'après validation.
 *  - compatibilité : les clés déjà migrées `media/<16hex>` restent valides et
 *    ne sont jamais recalculées ni supprimées.
 */
import type { Trial, MediaReference } from '../types/trial';
import type { MediaStoragePort } from './mediaStorageService';

export type LegacyDetector = (key: string) => boolean;

/**
 * Détection des formats legacy réellement présents dans le dépôt :
 *  - data:image/jpeg;base64,...
 *  - data:image/svg+xml;utf8,<svg...>
 * Le préfixe `data:` couvre également toute variante future.
 */
export function isLegacyStorageKey(key: string): boolean {
  return key.startsWith('data:');
}

export function isLegacyMediaReference(m: MediaReference | undefined | null): boolean {
  return !!m && isLegacyStorageKey(m.storageKey);
}

/**
 * Écrit un code point Unicode en UTF-8 dans le tableau d'octets.
 * Les surrogates isolés (U+D800-U+DFFF) sont remplacés par U+FFFD,
 * conformément au comportement de TextEncoder.
 */
function appendUtf8Bytes(bytes: number[], codePoint: number): void {
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    appendUtf8Bytes(bytes, 0xfffd);
    return;
  }
  if (codePoint <= 0x7f) {
    bytes.push(codePoint);
  } else if (codePoint <= 0x7ff) {
    bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
  } else if (codePoint <= 0xffff) {
    bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  } else {
    bytes.push(
      0xf0 | (codePoint >> 18),
      0x80 | ((codePoint >> 12) & 0x3f),
      0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f)
    );
  }
}

/**
 * Décodage percent tolérant, AU NIVEAU OCTET, du payload d'une Data URI
 * non-base64. Trois règles déterministes :
 *  - `%XX` valide (suivi de deux hexadécimaux) → l'octet correspondant
 *    (%20 → 0x20, %23 → 0x23, %25 → 0x25, %C3%A9 → 0xC3 0xA9) ;
 *  - `%` littéral non suivi de deux hexadécimaux → caractère '%' conservé
 *    (0% → "0%" : 0x30 0x25 ; 100% → "100%") ;
 *  - caractère Unicode direct → ses octets UTF-8 (é → C3 A9, 📷 → F0 9F 93 B7).
 *
 * Strictement équivalent à `decodeURIComponent` + `TextEncoder` sur tout
 * payload correctement encodé, tout en supportant les payloads legacy
 * historiques qui mélangent `%XX` valides et `%` littéraux (0%, 100%).
 * N'utilise AUCUN fallback global try/catch → payload brut : une telle
 * approche perdrait le décodage des séquences `%XX` valides du même payload.
 */
function percentDecodeToUtf8(payload: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < payload.length; ) {
    const code = payload.charCodeAt(i);
    if (code === 0x25 /* '%' */ && /^[0-9a-fA-F]{2}$/.test(payload.slice(i + 1, i + 3))) {
      bytes.push(parseInt(payload.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      const codePoint = payload.codePointAt(i) as number;
      appendUtf8Bytes(bytes, codePoint);
      i += codePoint > 0xffff ? 2 : 1;
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Conversion d'une Data URI legacy vers Blob + type MIME réel.
 * Couvre base64 (;base64,xxx) et encodage utf8 (data:image/svg+xml;utf8,<...>).
 */
export function convertDataUriToBlob(dataUri: string): { blob: Blob; mimeType: string } {
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) {
    throw new Error(`Data URI malformée : séparateur "," absent`);
  }
  const header = dataUri.slice(0, commaIndex);
  const payload = dataUri.slice(commaIndex + 1);

  // MIME : data:image/jpeg;base64  →  image/jpeg
  const mimeMatch = /^data:([^;,]*)/.exec(header);
  const mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'application/octet-stream';

  let bytes: Uint8Array;
  if (/;base64$/i.test(header)) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = percentDecodeToUtf8(payload);
  }

  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

/**
 * Hash stable et déterministe (deux passes FNV-1a 32-bit combinées).
 * Utilisé pour dériver une clé logique idempotente depuis le contenu legacy.
 */
export function stableHash(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193;
    h2 = (h2 ^ ((c << 1) | (c >> 7))) * 0x85ebca6b;
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return a + b;
}

/**
 * Nouvelle clé logique, déterministe depuis la Data URI legacy.
 * Jamais de données binaires : uniquement des caractères hexadécimaux.
 */
export function createMigratedStorageKey(legacyKey: string): string {
  return `media/${stableHash(legacyKey)}`;
}

/** Préfixe des clés content-addressed (SHA-256, 64 hexadécimaux). */
export const CONTENT_ADDRESSED_PREFIX = 'media/sha256/';

/**
 * Erreur explicite levée lorsqu'une clé content-addressed existe déjà avec un
 * contenu DIFFÉRENT. Aucun écrasement : la référence legacy est conservée.
 */
export class MediaCollisionError extends Error {
  public readonly storageKey: string;
  constructor(storageKey: string) {
    super(
      `COLLISION DÉTECTÉE : la clé ${storageKey} référence déjà un contenu différent ; écriture refusée, référence legacy conservée`
    );
    this.name = 'MediaCollisionError';
    this.storageKey = storageKey;
  }
}

/**
 * Empreinte SHA-256 (`media/sha256/<64hex>`) du contenu binaire, via Web Crypto.
 * Retourne `null` lorsque `crypto.subtle` est indisponible (contexte non
 * sécurisé : HTTP sur IP LAN) : l'appelant applique alors le repli déterministe
 * `createMigratedStorageKey` pour ne jamais interrompre la migration.
 */
export async function computeContentAddressedKey(blob: Blob): Promise<string | null> {
  const subtle = (globalThis as unknown as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') return null;
  try {
    const buffer = await blob.arrayBuffer();
    const digest = await subtle.digest('SHA-256', buffer);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    return `${CONTENT_ADDRESSED_PREFIX}${hex}`;
  } catch {
    return null;
  }
}

/**
 * Comparaison octet à octet de deux Blobs (taille d'abord, puis contenu).
 */
async function blobsHaveSameContent(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [ab, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const ua = new Uint8Array(ab);
  const ub = new Uint8Array(bb);
  for (let i = 0; i < ua.length; i++) {
    if (ua[i] !== ub[i]) return false;
  }
  return true;
}

/**
 * Clé logique pour une nouvelle capture (côté navigateur).
 */
export function createNewMediaStorageKey(mimeType: string, filename?: string): string {
  const ext = filename ? filename.split('.').pop() : undefined;
  const suffix =
    ext && /^[a-zA-Z0-9]{1,8}$/.test(ext)
      ? ext
      : mimeType.includes('svg')
        ? 'svg'
        : mimeType.includes('png')
          ? 'png'
          : mimeType.includes('webp')
            ? 'webp'
            : 'jpg';
  return `media/${crypto.randomUUID?.() ?? stableHash(`${mimeType}-${Date.now()}-${Math.random()}`)}.${suffix}`;
}

export interface MigrationSummary {
  examined: number;
  migrated: number;
  errors: number;
  remainingLegacy: number;
  failedKeys: string[];
  collisions: string[];
}

export interface MigrationContext {
  backend: MediaStoragePort;
  trials: Trial[];
  saveTrial: (t: Trial) => void;
  legacyDetector?: LegacyDetector;
}

/**
 * Migration one-by-one, rejouable et idempotente.
 * La référence n'est modifiée que si l'écriture IndexedDB a réussi.
 */
export async function runMediaMigration(ctx: MigrationContext): Promise<MigrationSummary> {
  const detector = ctx.legacyDetector ?? isLegacyStorageKey;
  const summary: MigrationSummary = {
    examined: 0,
    migrated: 0,
    errors: 0,
    remainingLegacy: 0,
    failedKeys: [],
    collisions: []
  };

  for (const trial of ctx.trials) {
    const refs = trial.mediaReferences;
    if (!Array.isArray(refs) || refs.length === 0) continue;

    const pending: Array<{
      ref: MediaReference;
      originalStorageKey: string;
      originalMimeType: string;
      originalSizeBytes: number;
    }> = [];

    for (const ref of refs) {
      if (!detector(ref.storageKey)) continue;
      summary.examined += 1;

      try {
        const { blob, mimeType } = convertDataUriToBlob(ref.storageKey);

        // Clé content-addressed (SHA-256). Repli déterministe legacy uniquement
        // hors contexte sécurisé (crypto.subtle indisponible) : les anciennes
        // clés `media/<16hex>` restent alors produites à l'identique.
        const contentKey = await computeContentAddressedKey(blob);
        const newKey = contentKey ?? createMigratedStorageKey(ref.storageKey);

        // Idempotence / collision : un contenu identique déjà présent n'est pas
        // réécrit ; un contenu DIFFÉRENT sous la même clé lève une erreur
        // explicite et n'écrase JAMAIS l'existant (référence legacy conservée).
        const existing = await ctx.backend.get(newKey);
        if (existing) {
          if (!(await blobsHaveSameContent(existing.blob, blob))) {
            throw new MediaCollisionError(newKey);
          }
        } else {
          await ctx.backend.put(blob, newKey, mimeType);
        }

        // Validation de l'écriture avant mise à jour de la référence.
        const written = await ctx.backend.get(newKey);
        if (!written) {
          throw new Error(`Écriture IndexedDB non confirmée pour ${newKey}`);
        }

        pending.push({
          ref,
          originalStorageKey: ref.storageKey,
          originalMimeType: ref.mimeType,
          originalSizeBytes: ref.sizeBytes
        });
        ref.storageKey = newKey;
        ref.mimeType = mimeType;
        ref.sizeBytes = written.blob.size;
      } catch (err) {
        // Échec ISOLÉ (conversion, collision, écriture...) : erreur comptabilisée,
        // référence legacy conservée telle quelle (réessayable), migration des
        // autres médias poursuivie.
        summary.errors += 1;
        summary.failedKeys.push(ref.id);
        if (err instanceof MediaCollisionError) {
          summary.collisions.push(ref.id);
        }
      }
    }

    if (pending.length > 0) {
      try {
        ctx.saveTrial(trial);
      } catch (saveErr) {
        // Échec de persistance du trial : le Blob IndexedDB peut avoir été
        // écrit, mais la référence n'a pas pu être persistée. Les références
        // sont restaurées à leur valeur legacy (remainingLegacy reste exact) ;
        // le Blob valide est conservé — un retry ultérieur le réconcilie via
        // la clé content-addressed + comparaison de contenu. L'état incohérent IDB/legacy est LE
        // mieux évité possible, aucun Blob valide n'est supprimé.
        for (const p of pending) {
          p.ref.storageKey = p.originalStorageKey;
          p.ref.mimeType = p.originalMimeType;
          p.ref.sizeBytes = p.originalSizeBytes;
          summary.errors += 1;
          summary.failedKeys.push(p.ref.id);
        }
        continue;
      }
      summary.migrated += pending.length;
    }
  }

  for (const trial of ctx.trials) {
    for (const ref of trial.mediaReferences) {
      if (detector(ref.storageKey)) {
        summary.remainingLegacy += 1;
      }
    }
  }

  return summary;
}

/**
 * Préparation d'un essai pour EXPORT sans binaire.
 * Une référence legacy (Data URI) est remplacée par sa clé logique déterministe
 * `media/<hash>` : le JSON scientifique ne contient jamais data:image/ ni base64.
 * NOTE : opération SYNCHRONE → ne peut pas calculer le SHA-256 ; cette clé legacy
 * n'est produite que pour une référence NON ENCORE migrée (repli défensif : la
 * migration au démarrage précède normalement tout export).
 * La référence originale (en mémoire / localStorage) n'est pas modifiée.
 */
export function sanitizeTrialForExport(trial: Trial): Trial {
  if (!trial || !Array.isArray(trial.mediaReferences)) return trial;
  return {
    ...trial,
    mediaReferences: trial.mediaReferences.map((ref) =>
      isLegacyStorageKey(ref.storageKey)
        ? { ...ref, storageKey: createMigratedStorageKey(ref.storageKey) }
        : ref
    )
  };
}

/**
 * Garbage collection des Blobs IndexedDB.
 * Principe : un Blob est supprimé uniquement lorsqu'AUCUNE PhotoReference
 * (actif, archivé, remplacé, autre panneau, autre jalon, autre essai,
 * référence partagée) ne référence sa clé, sur l'ensemble des Trials.
 */
export async function deleteUnreferencedMedia(
  backend: MediaStoragePort,
  trials: Trial[]
): Promise<string[]> {
  const referenced = new Set<string>();
  for (const trial of trials) {
    for (const ref of trial.mediaReferences) {
      if (ref?.storageKey) {
        referenced.add(ref.storageKey);
      }
    }
  }

  const allKeys = await backend.keys();
  const orphaned: string[] = [];
  for (const key of allKeys) {
    if (!referenced.has(key)) {
      orphaned.push(key);
    }
  }
  for (const key of orphaned) {
    await backend.delete(key);
  }
  return orphaned;
}