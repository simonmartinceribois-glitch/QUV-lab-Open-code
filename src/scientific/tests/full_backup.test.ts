/**
 * QUV-Lab — Sauvegarde complète avec photographies (R-BACKUP).
 *
 * Contrat : la sauvegarde embarque octet pour octet les médias référencés,
 * la restauration n'écrit que les clés de l'essai importé et n'écrase
 * jamais un média existant ; le dossier scientifique reste sans binaire.
 */
import { TrialStoreService } from '../../services/trialStoreService';
import type { MediaRecord, MediaStoragePort } from '../../services/mediaStorageService';
import { buildFullBackup, isFullBackup, restoreFullBackupMedia, FULL_BACKUP_FORMAT } from '../../services/fullBackupService';
import type { FullBackup } from '../../services/fullBackupService';
import { sanitizeTrialForExport } from '../../services/mediaMigrationService';
import type { PhotoReference, Trial } from '../../types/trial';

export interface FullBackupTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

class MemoryMediaStorage implements MediaStoragePort {
  public readonly records = new Map<string, MediaRecord>();
  public puts = 0;
  async put(file: File | Blob, key: string, mimeType?: string): Promise<void> {
    this.puts++;
    this.records.set(key, { key, blob: file, mimeType: mimeType ?? file.type, createdAt: new Date().toISOString() });
  }
  async get(key: string): Promise<MediaRecord | null> {
    return this.records.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
  async has(key: string): Promise<boolean> {
    return this.records.has(key);
  }
  async keys(): Promise<string[]> {
    return Array.from(this.records.keys());
  }
}

const BYTES_A = new Uint8Array(70000).map((_, i) => (i * 37) % 256); // > 1 bloc d'encodage (0x8000)
const BYTES_B = new Uint8Array([0, 255, 1, 254, 128]);

function photo(trial: Trial, key: string, mimeType: string, size: number): PhotoReference {
  return {
    id: `ref-${key}`,
    trialId: trial.id,
    type: 'PHOTO',
    storageKey: key,
    filename: `${key}.bin`,
    mimeType,
    sizeBytes: size,
    capturedAt: '2026-10-09T10:00:00.000Z',
    capturedBy: 'OP',
    panelId: trial.batches[0].panels[0].id,
    stageId: trial.stages[0].id
  };
}

async function fixture(): Promise<{ trial: Trial; backend: MemoryMediaStorage }> {
  const trial = TrialStoreService.createIsolatedStore().resetToDemo();
  trial.mediaReferences = [
    photo(trial, 'media/photo-a', 'image/jpeg', BYTES_A.length),
    photo(trial, 'media/photo-b', 'image/png', BYTES_B.length),
    photo(trial, 'media/photo-missing', 'image/png', 1)
  ];
  const backend = new MemoryMediaStorage();
  await backend.put(new Blob([BYTES_A], { type: 'image/jpeg' }), 'media/photo-a', 'image/jpeg');
  await backend.put(new Blob([BYTES_B], { type: 'image/png' }), 'media/photo-b', 'image/png');
  return { trial, backend };
}

async function bytesOf(backend: MemoryMediaStorage, key: string): Promise<Uint8Array | null> {
  const rec = await backend.get(key);
  return rec ? new Uint8Array(await rec.blob.arrayBuffer()) : null;
}

const sameBytes = (a: Uint8Array | null, b: Uint8Array) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);

export async function runFullBackupTests(): Promise<{
  results: FullBackupTestResult[];
  summary: { total: number; passed: number; failed: number };
}> {
  const results: FullBackupTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-BACKUP-01 : contenu de la sauvegarde.
  {
    const { trial, backend } = await fixture();
    const backup = await buildFullBackup(trial, backend, { ruleSet: { id: 'rs' } });
    const keys = backup.media.map((m) => m.storageKey).sort().join(',');
    const ok =
      backup.format === FULL_BACKUP_FORMAT &&
      keys === 'media/photo-a,media/photo-b' &&
      backup.missingMediaKeys.join(',') === 'media/photo-missing' &&
      (backup['ruleSet'] as { id: string }).id === 'rs' &&
      isFullBackup(backup);
    record('R-BACKUP-01', 'Sauvegarde : 2 photos présentes incluses, 1 introuvable listée, extras recopiés, format reconnu',
      ok, 'photo-a, photo-b / missing=photo-missing', `${keys} / missing=${backup.missingMediaKeys.join(',')}`);
  }

  // R-BACKUP-02 : aller-retour fichier → import → restauration, octets identiques.
  {
    const { trial, backend } = await fixture();
    const payload = JSON.parse(JSON.stringify(await buildFullBackup(trial, backend))) as FullBackup;
    const store = TrialStoreService.createIsolatedStore();
    const imported = store.importTrialFromExport(payload, 'OP', 'SAUVEGARDE.json');
    const target = new MemoryMediaStorage();
    const summary = await restoreFullBackupMedia(payload, imported, target);
    const okA = sameBytes(await bytesOf(target, 'media/photo-a'), BYTES_A);
    const okB = sameBytes(await bytesOf(target, 'media/photo-b'), BYTES_B);
    const mimeOk = (await target.get('media/photo-b'))?.mimeType === 'image/png';
    record('R-BACKUP-02', 'Aller-retour sauvegarde → import → restauration : photos identiques octet pour octet (dont 70 ko)',
      summary.restored === 2 && summary.failed.length === 0 && okA && okB && mimeOk && !!store.getTrial(imported.id),
      '2 restaurées, octets et type MIME identiques',
      `restaurées=${summary.restored}, échecs=${summary.failed.length}, A=${okA}, B=${okB}, mime=${mimeOk}`);
  }

  // R-BACKUP-03 : un média déjà présent n'est jamais écrasé.
  {
    const { trial, backend } = await fixture();
    const payload = await buildFullBackup(trial, backend);
    const target = new MemoryMediaStorage();
    const local = new Uint8Array([9, 9, 9]);
    await target.put(new Blob([local], { type: 'image/jpeg' }), 'media/photo-a', 'image/jpeg');
    const summary = await restoreFullBackupMedia(payload, payload.trial, target);
    const kept = sameBytes(await bytesOf(target, 'media/photo-a'), local);
    record('R-BACKUP-03', 'Média déjà présent sur le poste → conservé, jamais écrasé',
      kept && summary.alreadyPresent === 1 && summary.restored === 1, 'local conservé, 1 déjà présent, 1 restauré',
      `conservé=${kept}, déjàPrésent=${summary.alreadyPresent}, restaurés=${summary.restored}`);
  }

  // R-BACKUP-04 : clé non référencée ou entrée corrompue → non écrite, comptée en échec.
  {
    const { trial, backend } = await fixture();
    const payload = await buildFullBackup(trial, backend);
    payload.media.push({ storageKey: 'media/intrus', mimeType: 'image/png', sizeBytes: 1, dataBase64: 'AA==' });
    payload.media.push({ storageKey: 'media/photo-missing', mimeType: '', sizeBytes: 0, dataBase64: 'AA==' });
    const target = new MemoryMediaStorage();
    const summary = await restoreFullBackupMedia(payload, payload.trial, target);
    const ok = !(await target.has('media/intrus')) && !(await target.has('media/photo-missing')) && summary.failed.length === 2 && summary.restored === 2;
    record('R-BACKUP-04', 'Clé non référencée par l’essai ou entrée incomplète → jamais écrite, comptée en échec, les autres restaurées',
      ok, '2 échecs, 2 restaurées, aucune écriture parasite', `échecs=${summary.failed.join(',')}, restaurées=${summary.restored}`);
  }

  // R-BACKUP-05 : le dossier scientifique (sans binaire) n'est pas une sauvegarde complète.
  {
    const { trial } = await fixture();
    const dossier = JSON.parse(JSON.stringify({ trial: sanitizeTrialForExport(trial), ruleSet: {}, activeReport: null }));
    const noBinary = !JSON.stringify(dossier).includes('dataBase64');
    record('R-BACKUP-05', 'Dossier scientifique JSON : sans binaire et non reconnu comme sauvegarde complète',
      !isFullBackup(dossier) && noBinary, 'isFullBackup=false, sans dataBase64', `isFullBackup=${isFullBackup(dossier)}, sansBinaire=${noBinary}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
