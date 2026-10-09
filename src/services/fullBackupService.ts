/**
 * QUV-Lab — Sauvegarde complète d'un essai (métadonnées + photographies).
 *
 * Le dossier scientifique JSON reste volontairement SANS binaire. La
 * sauvegarde complète est un format distinct qui embarque en plus les
 * photographies (Blobs IndexedDB) encodées en base64, afin qu'un essai
 * puisse être restauré intégralement sur un autre poste ou après une purge
 * du navigateur. Aucune dépendance supplémentaire (pas d'archive ZIP).
 *
 * Restauration : seules les clés média référencées par l'essai importé sont
 * écrites, et un média déjà présent n'est jamais écrasé.
 */
import type { Trial } from '../types/trial';
import type { MediaStoragePort } from './mediaStorageService';
import { sanitizeTrialForExport } from './mediaMigrationService';

export const FULL_BACKUP_FORMAT = 'QUV-LAB-FULL-BACKUP';
export const FULL_BACKUP_FORMAT_VERSION = 1;

export interface FullBackupMediaEntry {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface FullBackup {
  format: typeof FULL_BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  trial: Trial;
  media: FullBackupMediaEntry[];
  /** Références dont le média est introuvable sur ce poste au moment de l'export. */
  missingMediaKeys: string[];
  [extra: string]: unknown;
}

export interface MediaRestoreSummary {
  restored: number;
  alreadyPresent: number;
  failed: string[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function referencedKeys(trial: Trial): string[] {
  const keys = (trial.mediaReferences ?? []).map((ref) => ref?.storageKey).filter((k): k is string => !!k);
  return Array.from(new Set(keys));
}

/**
 * Construit la sauvegarde complète. `extras` (RuleSet, rapport actif,
 * évaluations) est recopié tel quel, comme dans le dossier scientifique.
 */
export async function buildFullBackup(
  trial: Trial,
  backend: MediaStoragePort,
  extras: Record<string, unknown> = {}
): Promise<FullBackup> {
  const exported = sanitizeTrialForExport(trial);
  const media: FullBackupMediaEntry[] = [];
  const missingMediaKeys: string[] = [];
  for (const key of referencedKeys(exported)) {
    const record = await backend.get(key);
    if (!record) {
      missingMediaKeys.push(key);
      continue;
    }
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    media.push({ storageKey: key, mimeType: record.mimeType, sizeBytes: bytes.length, dataBase64: bytesToBase64(bytes) });
  }
  return {
    ...extras,
    format: FULL_BACKUP_FORMAT,
    formatVersion: FULL_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    trial: exported,
    media,
    missingMediaKeys
  };
}

export function isFullBackup(payload: unknown): payload is FullBackup {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as Record<string, unknown>)['format'] === FULL_BACKUP_FORMAT &&
    Array.isArray((payload as Record<string, unknown>)['media'])
  );
}

/**
 * Écrit les photographies de la sauvegarde pour l'essai déjà importé.
 * N'écrit que les clés référencées par cet essai ; ne remplace jamais un
 * média existant ; une entrée invalide est comptée en échec sans bloquer
 * les autres.
 */
export async function restoreFullBackupMedia(
  payload: FullBackup,
  importedTrial: Trial,
  backend: MediaStoragePort
): Promise<MediaRestoreSummary> {
  const allowed = new Set(referencedKeys(importedTrial));
  const summary: MediaRestoreSummary = { restored: 0, alreadyPresent: 0, failed: [] };
  for (const entry of payload.media) {
    const key = entry && typeof entry.storageKey === 'string' ? entry.storageKey : '';
    if (!key || !allowed.has(key)) {
      summary.failed.push(key || '(clé absente)');
      continue;
    }
    try {
      if (await backend.has(key)) {
        summary.alreadyPresent++;
        continue;
      }
      if (typeof entry.mimeType !== 'string' || !entry.mimeType || typeof entry.dataBase64 !== 'string') {
        throw new Error('entrée média incomplète');
      }
      const bytes = base64ToBytes(entry.dataBase64);
      await backend.put(new Blob([bytes], { type: entry.mimeType }), key, entry.mimeType);
      summary.restored++;
    } catch {
      summary.failed.push(key);
    }
  }
  return summary;
}
