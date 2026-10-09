/**
 * QUV-Lab — Garde-fous d'architecture pour la cible serveur (R-ARCH, D-13).
 * Voir docs/architecture/SERVER_TARGET.md §3 et §4.
 *
 * Analyse statique du code (commentaires retirés) : elle échoue si une
 * évolution réintroduit une dépendance qui empêcherait la migration.
 * Les dettes connues sont listées explicitement : la liste ne doit que diminuer.
 */
import * as fs from 'fs';
import * as path from 'path';
import { TrialStoreService, stampAcquisitionRaw } from '../../services/trialStoreService';
import type { Trial } from '../../types/trial';

function rejects(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export interface ServerReadinessTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const SRC = path.resolve(process.cwd(), 'src');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Source sans commentaires (bloc et ligne) ni contenu des chaînes simples, pour éviter les faux positifs. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** Appels réels d'API navigateur (`window.x`, `new FileReader`…), pas un champ « document » ni un mot dans un texte. */
const BROWSER_API_CALL = /(?<![.\w])(window|document|navigator|localStorage|sessionStorage|indexedDB)\s*\.|\bnew\s+FileReader\b/;
/** Accès au stockage du navigateur (l'import `idb` est conservé : les chaînes simples sont vidées par code()). */
const STORAGE_API_CALL = /(?<![.\w])(localStorage|sessionStorage|indexedDB)\s*\.|\bopenDB\s*[<(]/;

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

function offenders(dirFiles: string[], pattern: RegExp, allowed: string[] = []): string[] {
  return dirFiles.filter((f) => !allowed.includes(rel(f)) && pattern.test(code(f))).map(rel);
}

export function runServerReadinessTests(): {
  results: ServerReadinessTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ServerReadinessTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const all = files(SRC);

  // R-ARCH-01 : moteur scientifique portable (aucune API navigateur).
  {
    const scientific = all.filter((f) => rel(f).startsWith('scientific/'));
    const bad = offenders(scientific, BROWSER_API_CALL);
    record('R-ARCH-01', 'Moteur scientifique (src/scientific) sans API du navigateur : exécutable côté serveur',
      scientific.length > 20 && bad.length === 0, '0 fichier', bad.join(', ') || `0 fichier sur ${scientific.length}`);
  }

  // R-ARCH-02 : l'interface n'écrit pas directement dans un essai (dette A1 autorisée temporairement).
  {
    const components = all.filter((f) => rel(f).startsWith('components/') && !rel(f).endsWith('UXTestsSuite.tsx'));
    const KNOWN_DEBT: string[] = []; // A1 (CREATE_BATCH) résorbée : createBatch du store
    const bad = offenders(components, /globalTrialStore\.saveTrial\s*\(|\.auditTrail\.push\s*\(/, KNOWN_DEBT);
    const debtStillPresent = KNOWN_DEBT.filter((d) => /globalTrialStore\.saveTrial\s*\(|\.auditTrail\.push\s*\(/.test(code(path.join(SRC, d))));
    record('R-ARCH-02', 'Interface : aucune écriture directe (saveTrial / auditTrail.push) — dette A1 résorbée, liste de dette vide',
      bad.length === 0 && debtStillPresent.length === KNOWN_DEBT.length, `0 nouveau ; dette listée encore présente (${KNOWN_DEBT.length})`,
      `nouveaux=${bad.join(', ') || 'aucun'} ; dette encore présente=${debtStillPresent.length}`);
  }

  // R-ARCH-03 : localStorage / IndexedDB confinés aux services de persistance.
  {
    const PERSISTENCE = ['services/trialStoreService.ts', 'services/mediaStorageService.ts', 'services/mediaMigrationService.ts'];
    const bad = offenders(all.filter((f) => !rel(f).endsWith('UXTestsSuite.tsx')), STORAGE_API_CALL, PERSISTENCE);
    record('R-ARCH-03', 'localStorage / IndexedDB utilisés uniquement par les services de persistance',
      bad.length === 0, '0 fichier hors persistance', bad.join(', ') || '0 fichier');
  }

  // R-ARCH-04 : aucune donnée de mot de passe dans le modèle d'essai ni le profil.
  {
    const modelFiles = ['types/trial.ts', 'types/scientific.ts', 'types/auth.ts'].map((f) => path.join(SRC, f));
    const bad = modelFiles.filter((f) => /\b(password|motDePasse|passwordHash)\b/i.test(code(f))).map(rel);
    record('R-ARCH-04', 'Aucun champ mot de passe dans le modèle d’essai ni dans le profil utilisateur',
      bad.length === 0, '0 champ', bad.join(', ') || '0 champ');
  }

  // R-ARCH-05 : A1 — ajout de lot par le store (même modèle, refus si verrouillé ou sans référence).
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = store.resetToDemo();
    trial.configurationStatus = 'EDITABLE';
    store.saveTrial(trial);
    const auditBefore = trial.auditTrail.length;
    const batch = store.createBatch(trial.id, { reference: '  LOT NEW ', coatingSystem: ' Lasure ', dryFilmThicknessMicrons: 70 }, 'OP');
    const t = store.getTrial(trial.id) as Trial;
    const entry = t.auditTrail[auditBefore];
    const roles = batch.panels.map((p) => `${p.roleCode}:${p.grainOrientation}:${p.exposureFace ?? '-'}`).join(',');
    const refusedEmpty = rejects(() => store.createBatch(trial.id, { reference: '  ' }, 'OP'));
    t.configurationStatus = 'LOCKED';
    store.saveTrial(t);
    const refusedLocked = rejects(() => store.createBatch(trial.id, { reference: 'LOT X' }, 'OP'));
    const ok =
      batch.reference === 'LOT NEW' && batch.coatingSystem === 'Lasure' && batch.dryFilmThicknessMicrons === 70 &&
      batch.orderIndex === t.batches.length && batch.trialId === trial.id &&
      roles === 'T:Quartier:-,E1:Quartier:Face externe,E2:Quartier:Face externe,E3:Faux quartier:Face externe' &&
      entry?.action === 'CREATE_BATCH' && entry.entityId === batch.id && entry.operatorId === 'OP' &&
      refusedEmpty && refusedLocked;
    record('R-ARCH-05', 'A1 : createBatch — lot T/E1/E2/E3 identique à l’ancien, journal CREATE_BATCH, refus si référence vide ou essai verrouillé',
      ok, 'modèle identique, journalisé, 2 refus', `rôles=${roles}, journal=${entry?.action}, refusVide=${refusedEmpty}, refusVerrouillé=${refusedLocked}`);
  }

  // R-ARCH-06 : A3 — horodatages système posés par le store, jamais écrasés.
  {
    const now = '2026-10-09T10:00:00.000Z';
    const given = '2025-01-01T08:00:00.000Z';
    const adhRaw = { measurements: [], gridSpacingMm: 2 };
    const stampedAdh = stampAcquisitionRaw('ADHESION', adhRaw, now, 'OP') as Record<string, unknown>;
    const keptAdh = stampAcquisitionRaw('ADHESION', { ...adhRaw, measurementDateTime: given }, now, 'OP') as Record<string, unknown>;
    const stampedObs = stampAcquisitionRaw('OBSERVATIONS', { observations: [] }, now, 'OP') as Record<string, unknown>;
    const keptObs = stampAcquisitionRaw('OBSERVATIONS', { observations: [], assessedAt: given, assessedBy: 'X' }, now, 'OP') as Record<string, unknown>;
    const colorRaw = { readings: [] };
    const ok =
      stampedAdh['measurementDateTime'] === now && !('measurementDateTime' in adhRaw) &&
      keptAdh['measurementDateTime'] === given &&
      stampedObs['assessedAt'] === now && stampedObs['assessedBy'] === 'OP' &&
      keptObs['assessedAt'] === given && keptObs['assessedBy'] === 'X' &&
      stampAcquisitionRaw('COLOR', colorRaw, now, 'OP') === colorRaw;
    record('R-ARCH-06', 'A3 : horodatages ADHESION / OBSERVATIONS ajoutés par le store si absents, jamais écrasés, RAW d’origine non modifié, autres familles intactes',
      ok, 'ajout si absent, valeur fournie conservée', `adh=${String(stampedAdh['measurementDateTime'])}, adhFourni=${String(keptAdh['measurementDateTime'])}, obs=${String(stampedObs['assessedAt'])}/${String(stampedObs['assessedBy'])}`);
  }

  // R-ARCH-07 : A3 bout en bout — une observation enregistrée sans horodatage est datée par recordAcquisition.
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = store.resetToDemo();
    // Jalon après T0 avec observations au plan (T0 exige les dates de conditionnement, hors sujet ici).
    const stage = trial.stages.find((s) => s.cycleIndex > 0 && s.status !== 'INACTIVE') ?? trial.stages[1];
    const batch = trial.batches[0];
    const panel = batch.panels[1];
    const before = Date.now();
    store.recordAcquisition({
      trialId: trial.id, stageId: stage.id, batchId: batch.id, panelId: panel.id, familyId: 'OBSERVATIONS',
      raw: { observations: [] }, operatorId: 'OP-OBS'
    });
    const stored = store.getTrial(trial.id)?.acquisitions[`${stage.id}__${panel.id}__OBSERVATIONS`]?.raw as Record<string, unknown> | undefined;
    const at = Date.parse(String(stored?.['assessedAt']));
    const ok = !!stored && stored['assessedBy'] === 'OP-OBS' && at >= before - 1000 && at <= Date.now() + 1000;
    record('R-ARCH-07', 'A3 bout en bout : observation saisie sans date → assessedAt / assessedBy posés par recordAcquisition',
      ok, 'assessedBy=OP-OBS, assessedAt ≈ maintenant', `assessedBy=${String(stored?.['assessedBy'])}, assessedAt=${String(stored?.['assessedAt'])}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
