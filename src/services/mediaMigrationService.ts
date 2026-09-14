/**
 * QUV-Lab — Migration légacies (Base64 / Data URI → IndexedDB)
 *
 * Conversion des PhotoReferences legacy dont `storageKey` est une Data URI
 * (data:image/jpeg;base64,... | data:image/svg+xml;utf8,...) vers une clé
 * logique `media/<hash>` et écriture du Blob dans IndexedDB.
 *
 * GARANTIES :
 *  - idempotence : la nouvelle clé est une fonction déterministe du contenu
 *    legacy ; relancer la migration ne recrée jamais de média dupliqué.
 *  - reprise : en cas d'échec d'un média, la référence legacy est conservée,
 *    les autres continuent ; la migration est rejouable.
 *  - mémoire : traitement séquentiel média par média (pas de Promise.all global).
 *  - atomicité : la référence n'est mise à jour qu'après réussite de l'écriture
 *    IndexedDB ; localStorage n'est réécrit qu'après validation.
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
    const decoded = decodeURIComponent(payload);
    bytes = new TextEncoder().encode(decoded);
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
    failedKeys: []
  };

  for (const trial of ctx.trials) {
    const refs = trial.mediaReferences;
    if (!Array.isArray(refs) || refs.length === 0) continue;

    let trialChanged = false;
    for (const ref of refs) {
      if (!detector(ref.storageKey)) continue;
      summary.examined += 1;

      try {
        const { blob, mimeType } = convertDataUriToBlob(ref.storageKey);
        const newKey = createMigratedStorageKey(ref.storageKey);

        // Idempotence : si le média existe déjà sous la même clé déterministe,
        // on ne réécrit pas (aucun doublon).
        const exists = await ctx.backend.has(newKey);
        if (!exists) {
          await ctx.backend.put(blob, newKey, mimeType);
        }

        // Validation de l'écriture avant mise à jour de la référence.
        const written = await ctx.backend.get(newKey);
        if (!written) {
          throw new Error(`Écriture IndexedDB non confirmée pour ${newKey}`);
        }

        ref.storageKey = newKey;
        ref.mimeType = mimeType;
        ref.sizeBytes = written.blob.size;
        trialChanged = true;
        summary.migrated += 1;
      } catch (err) {
        summary.errors += 1;
        summary.failedKeys.push(ref.id);
        // Référence legacy conservée telle quelle : reprise possible.
      }
    }

    if (trialChanged) {
      ctx.saveTrial(trial);
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