/**
 * QUV-Lab — Import d'un essai depuis le dossier scientifique JSON (R-IMPORT).
 *
 * Contrat : fail-closed (toute anomalie est refusée avant modification du
 * store), jamais d'écrasement d'un essai existant, fidélité intégrale des
 * données (RAW, COMPUTED, rapports, audit trail), import tracé.
 */
import { TrialStoreService } from '../../services/trialStoreService';
import { sanitizeTrialForExport } from '../../services/mediaMigrationService';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';

export interface TrialImportTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

/** Reproduit le contenu de l'export JSON de l'onglet 08, après un aller-retour fichier. */
function exportPayload(trial: Trial): unknown {
  return JSON.parse(
    JSON.stringify({ trial: sanitizeTrialForExport(trial), ruleSet: getDefaultScientificRuleSet(), activeReport: null })
  );
}

/**
 * Essai sans les champs que l'import modifie légitimement (dernier audit,
 * updatedAt), listes absentes normalisées en [] comme le fait saveTrial().
 */
function comparable(trial: Trial, dropLastAudit: boolean): string {
  const { updatedAt: _updatedAt, auditTrail, ...rest } = trial;
  return JSON.stringify({
    ...rest,
    reports: rest.reports ?? [],
    mediaReferences: rest.mediaReferences ?? [],
    acquisitions: rest.acquisitions ?? {},
    auditTrail: dropLastAudit ? auditTrail.slice(0, -1) : auditTrail
  });
}

function demoTrial(): Trial {
  return TrialStoreService.createIsolatedStore().resetToDemo();
}

function rejection(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
}

export function runTrialImportTests(): {
  results: TrialImportTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: TrialImportTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-IMPORT-01 : aller-retour export → import fidèle (RAW, COMPUTED, rapports, audit).
  {
    const source = demoTrial();
    const target = TrialStoreService.createIsolatedStore();
    const imported = target.importTrialFromExport(exportPayload(source), 'OP', 'DOSSIER.json');
    const expected = comparable(JSON.parse(JSON.stringify(sanitizeTrialForExport(source))) as Trial, false);
    const actual = comparable(target.getTrial(imported.id) as Trial, true);
    const acqCount = Object.keys(source.acquisitions).length;
    record('R-IMPORT-01', 'Aller-retour export JSON → import : essai identique (hors entrée d’audit d’import et updatedAt)',
      expected === actual && acqCount > 0, `identique, ${acqCount} acquisitions`,
      `identique=${expected === actual}, acquisitions=${Object.keys(imported.acquisitions).length}`);
  }

  // R-IMPORT-02 : entrée d'audit IMPORT_TRIAL avec opérateur et source.
  {
    const target = TrialStoreService.createIsolatedStore();
    const imported = target.importTrialFromExport(exportPayload(demoTrial()), '  OP  ', 'DOSSIER.json');
    const last = imported.auditTrail[imported.auditTrail.length - 1];
    const source = (last?.details as { source?: string } | undefined)?.source;
    const ok = last?.action === 'IMPORT_TRIAL' && last.operatorId === 'OP' && source === 'DOSSIER.json';
    record('R-IMPORT-02', 'Import tracé : IMPORT_TRIAL, opérateur nettoyé, nom du fichier source',
      ok, 'IMPORT_TRIAL / OP / DOSSIER.json', `${last?.action} / ${last?.operatorId} / ${source}`);
  }

  // R-IMPORT-03 : identifiant déjà présent → refus, essai existant strictement inchangé.
  {
    const store = TrialStoreService.createIsolatedStore();
    const existing = store.resetToDemo();
    const before = JSON.stringify(store.getTrial(existing.id));
    const modified = exportPayload(existing) as { trial: Trial };
    modified.trial.metadata.title = 'VERSION IMPORTÉE';
    const err = rejection(() => store.importTrialFromExport(modified, 'OP'));
    const unchanged = JSON.stringify(store.getTrial(existing.id)) === before;
    record('R-IMPORT-03', 'Essai déjà présent → import refusé, essai existant strictement inchangé',
      !!err && err.startsWith('IntegrityViolationError') && unchanged, 'IntegrityViolationError, inchangé',
      `${err ?? 'aucun refus'}, inchangé=${unchanged}`);
  }

  // R-IMPORT-04 : contenus non reconnus → refus, store vide.
  {
    const cases: Array<[string, unknown]> = [
      ['null', null],
      ['tableau', []],
      ['objet sans essai', { ruleSet: {} }],
      ['stages invalides', { trial: { id: 'X', stages: 'oops', batches: [], acquisitions: {}, config: {} } }],
      ['référence absente', { trial: { ...(exportPayload(demoTrial()) as { trial: Trial }).trial, metadata: {} } }],
      ['auditTrail non liste', { trial: { ...(exportPayload(demoTrial()) as { trial: Trial }).trial, auditTrail: {} } }]
    ];
    const failures: string[] = [];
    for (const [label, payload] of cases) {
      const store = TrialStoreService.createIsolatedStore();
      const err = rejection(() => store.importTrialFromExport(payload, 'OP'));
      if (!err?.startsWith('IntegrityViolationError') || store.getAllTrials().length !== 0) failures.push(label);
    }
    record('R-IMPORT-04', 'Contenus non reconnus (null, tableau, sans essai, structure ou référence invalide) → refus, rien importé',
      failures.length === 0, '6 refus, store vide', failures.length ? `acceptés à tort : ${failures.join(', ')}` : '6 refus, store vide');
  }

  // R-IMPORT-05 : opérateur obligatoire.
  {
    const store = TrialStoreService.createIsolatedStore();
    const err = rejection(() => store.importTrialFromExport(exportPayload(demoTrial()), '   '));
    record('R-IMPORT-05', 'Opérateur vide → import refusé',
      !!err && store.getAllTrials().length === 0, 'refus, store vide', `${err ?? 'aucun refus'}, essais=${store.getAllTrials().length}`);
  }

  // R-IMPORT-06 : contexte scientifique gelé incohérent → refus (fail-closed).
  {
    const payload = exportPayload(demoTrial()) as { trial: Trial };
    (payload.trial as unknown as Record<string, unknown>)['scientificContext'] = { status: 'FROZEN' };
    const store = TrialStoreService.createIsolatedStore();
    const err = rejection(() => store.importTrialFromExport(payload, 'OP'));
    record('R-IMPORT-06', 'Contexte scientifique gelé invalide → import refusé, aucune réparation',
      !!err && store.getAllTrials().length === 0, 'refus, store vide', `${err ?? 'aucun refus'}`);
  }

  // R-IMPORT-07 : essai MOCK_TEST_ refusé ; objet Trial brut (sans enveloppe) accepté.
  {
    const mock = exportPayload(demoTrial()) as { trial: Trial };
    mock.trial.id = 'MOCK_TEST_123';
    const store = TrialStoreService.createIsolatedStore();
    const mockErr = rejection(() => store.importTrialFromExport(mock, 'OP'));
    const raw = (exportPayload(demoTrial()) as { trial: Trial }).trial;
    const rawErr = rejection(() => store.importTrialFromExport(raw, 'OP'));
    record('R-IMPORT-07', 'Essai MOCK_TEST_ refusé ; Trial brut sans enveloppe accepté',
      !!mockErr && rawErr === null && !!store.getTrial(raw.id), 'MOCK refusé, brut importé',
      `mock=${mockErr ? 'refusé' : 'ACCEPTÉ'}, brut=${rawErr ?? 'importé'}`);
  }

  // R-IMPORT-08 : l'essai importé n'est pas partagé avec l'objet fourni.
  {
    const payload = exportPayload(demoTrial()) as { trial: Trial };
    const store = TrialStoreService.createIsolatedStore();
    const imported = store.importTrialFromExport(payload, 'OP');
    payload.trial.metadata.title = 'MUTATION APRÈS IMPORT';
    record('R-IMPORT-08', 'Copie profonde : modifier l’objet source après import n’altère pas le store',
      store.getTrial(imported.id)?.metadata.title !== 'MUTATION APRÈS IMPORT', 'titre inchangé',
      `titre=${store.getTrial(imported.id)?.metadata.title}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
