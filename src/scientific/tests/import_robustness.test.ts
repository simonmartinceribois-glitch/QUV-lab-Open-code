/**
 * QUV-Lab — Suite de Tests ROBUSTESSE IMPORTS / DONNÉES MAL FORMÉES (P2).
 *
 * Donnée invalide = rejetée explicitement (IntegrityViolationError avant tout
 * effet) ou marquée (WARNING/ERROR + alertes), jamais validée silencieusement,
 * jamais 0 par défaut, jamais fabriquée. Absent / invalide / zéro réel Persoz
 * restent sémantiquement distincts. RAW fourni intact.
 */

import {
  generateStandardExposureStages,
  IntegrityViolationError,
  isStructurallyValidTrial,
  TrialStoreService
} from '../../services/trialStore';
import type { Trial } from '../../types/trial';

export interface ImportRobustnessTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-ir-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-IR-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['PERSOZ', 'COLOR', 'ADHESION'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT IR-${trialSeq}`, orderIndex: 1,
      dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
      panels: [
        { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  } as Trial;
}

function persozReadings(values: unknown[]) {
  return {
    readings: values.map((v, i) => ({ pointIndex: i + 1, dampingTimeSeconds: v })),
    unit: 'SECONDS'
  };
}

function attempt(
  store: TrialStoreService,
  trial: Trial,
  familyId: string,
  raw: unknown,
  panelSuffix = 'E1',
  cycleIndex = 0
): { ok: boolean; integrity: boolean; record?: { status?: unknown; computed?: unknown; alerts?: { code?: unknown; severity?: unknown }[] } } {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  try {
    const { record: rec } = store.recordAcquisition({
      trialId: trial.id,
      stageId: stage.id,
      batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-${panelSuffix}`,
      familyId,
      raw,
      operatorId: 'TEST_OP'
    });
    return { ok: true, integrity: false, record: rec as unknown as { status?: unknown; computed?: unknown; alerts?: { code?: unknown; severity?: unknown }[] } };
  } catch (err) {
    return { ok: false, integrity: err instanceof IntegrityViolationError };
  }
}

function alertsOf(rec: { alerts?: { code?: unknown; severity?: unknown }[] } | undefined): string[] {
  return (rec?.alerts || []).map((a) => `${String(a.code)}/${String(a.severity)}`);
}

export function runImportRobustnessTests(): {
  results: ImportRobustnessTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ImportRobustnessTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- IR-01 : valide accepté ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings([85.2, 84.8, 85.5]));
    const mean = (r.record?.computed as { meanDampingTime?: unknown } | undefined)?.meanDampingTime;
    record('IR-01', 'Objet valide accepté (PERSOZ calculé)',
      r.ok && typeof mean === 'number', 'accepté, mean numérique', `ok=${String(r.ok)}, mean=${String(mean)}`);
  }

  // --- IR-02 : champ obligatoire absent → marqué WARNING ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', {});
    const codes = alertsOf(r.record);
    record('IR-02', 'Champ readings absent → stocké WARNING (marqué, non valide)',
      r.ok && r.record?.status === 'WARNING' && codes.some((c) => c.includes('MEASUREMENT_MISSING')),
      'WARNING + MEASUREMENT_MISSING', `status=${String(r.record?.status)}, alertes=${codes.join(',')}`);
  }

  // --- IR-03 : mauvais type numérique → BLOCKING ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings(['85' as unknown as number, 84.8, 85.5]));
    const codes = alertsOf(r.record);
    record('IR-03', 'Chaîne "85" → MEASUREMENT_INVALID/BLOCKING',
      r.ok && r.record?.status === 'ERROR' && codes.some((c) => c.includes('MEASUREMENT_INVALID')),
      'ERROR + INVALID', `status=${String(r.record?.status)}, alertes=${codes.join(',')}`);
  }

  // --- IR-04 : chaîne vide → BLOCKING ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings(['' as unknown as number, 84.8, 85.5]));
    record('IR-04', 'Chaîne vide → INVALID (jamais 0)',
      r.ok && alertsOf(r.record).some((c) => c.includes('MEASUREMENT_INVALID')),
      'INVALID', alertsOf(r.record).join(','));
  }

  // --- IR-05 : null → MISSING ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings([null, 84.8, 85.5]));
    record('IR-05', 'null → MISSING (distinct d’invalide et de 0)',
      r.ok && alertsOf(r.record).some((c) => c.includes('MEASUREMENT_MISSING')),
      'MISSING', alertsOf(r.record).join(','));
  }

  // --- IR-06 : propriété absente → MISSING ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', { readings: [{ pointIndex: 1 }], unit: 'SECONDS' });
    record('IR-06', 'Propriété absente → MISSING',
      r.ok && alertsOf(r.record).some((c) => c.includes('MEASUREMENT_MISSING')),
      'MISSING', alertsOf(r.record).join(','));
  }

  // --- IR-07 : NaN → INVALID ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings([NaN, 84.8, 85.5]));
    record('IR-07', 'NaN → INVALID/BLOCKING',
      r.ok && alertsOf(r.record).some((c) => c.includes('MEASUREMENT_INVALID')),
      'INVALID', alertsOf(r.record).join(','));
  }

  // --- IR-08 : RAW mal formé rejeté avant pipeline ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const raws: unknown[] = [null, 'texte', 42, [1, 2]];
    const results8 = raws.map((raw) => attempt(store, trial, 'PERSOZ', raw));
    const allRejected = results8.every((r) => !r.ok && r.integrity);
    const isolatedCount = Object.keys(store.getTrial(trial.id)?.acquisitions || {}).length;
    record('IR-08', 'null/texte/nombre/tableau → IntegrityViolationError, rien stocké',
      allRejected && isolatedCount === 0,
      '4 rejets, 0 acquisition', `rejets=${results8.filter((r) => r.integrity).length}/4, stockées=${isolatedCount}`);
  }

  // --- IR-09 : familyId inconnu rejeté ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'UNKNOWN', persozReadings([85, 85, 85]));
    const isolatedCount = Object.keys(store.getTrial(trial.id)?.acquisitions || {}).length;
    record('IR-09', 'Famille inconnue → IntegrityViolationError, rien stocké',
      !r.ok && r.integrity && isolatedCount === 0,
      'rejet, 0 acquisition', `rejet=${String(r.integrity)}, stockées=${isolatedCount}`);
  }

  // --- IR-10 : cible inexistante rejetée ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    let threw = false;
    let integrity = false;
    try {
      store.recordAcquisition({
        trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
        panelId: 'panel-inexistant', familyId: 'PERSOZ',
        raw: persozReadings([85, 85, 85]), operatorId: 'TEST_OP'
      });
    } catch (err) {
      threw = true;
      integrity = err instanceof IntegrityViolationError;
    }
    record('IR-10', 'Panneau inexistant → IntegrityViolationError',
      threw && integrity, 'rejet intégrité', `rejet=${String(integrity)}`);
  }

  // --- IR-11 : aucune valeur fabriquée (null, pas 0) ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const rP = attempt(store, trial, 'PERSOZ', {});
    const meanP = (rP.record?.computed as { meanDampingTime?: unknown } | undefined)?.meanDampingTime;
    const rC = attempt(store, trial, 'COLOR', {});
    const meanL = (rC.record?.computed as { meanL?: unknown } | undefined)?.meanL;
    record('IR-11', 'Absence → null (jamais 0 fabriqué)',
      meanP === null && meanL === null,
      'mean=null des deux', `persoz=${String(meanP)}, L=${String(meanL)}`);
  }

  // --- IR-12 : RAW valide inchangé ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const raw = persozReadings([85.2, 84.8, 85.5]);
    const before = JSON.stringify(raw);
    attempt(store, trial, 'PERSOZ', raw);
    record('IR-12', 'RAW fourni strictement inchangé après import',
      JSON.stringify(raw) === before, 'identique', JSON.stringify(raw) === before ? 'identique' : 'MODIFIÉ');
  }

  // --- IR-13 : zéro réel distinct (0 VALID, pas MISSING) ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const r = attempt(store, trial, 'PERSOZ', persozReadings([0, 0, 0]));
    const computed = r.record?.computed as { meanDampingTime?: unknown; qualityAssessment?: { validCount?: unknown } } | undefined;
    const codes = alertsOf(r.record);
    record('IR-13', 'Zéro réel = VALID (ni absence ni invalide)',
      r.ok && computed?.meanDampingTime === 0 && !codes.some((c) => c.includes('MEASUREMENT_MISSING')),
      'mean=0, pas de MISSING', `mean=${String(computed?.meanDampingTime)}, alertes=${codes.join(',') || 'aucune'}`);
  }

  // --- IR-14 : ADHÉSION invalide marquée (jamais admissible silencieuse) ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    let status: unknown = null;
    let codes: string[] = [];
    try {
      const { record: rec } = store.recordAcquisition({
        trialId: trial.id, stageId: stageC12.id, batchId: trial.batches[0].id,
        panelId: `${trial.id}-p-E1`, familyId: 'ADHESION',
        raw: {
          measurements: [{ measurementIndex: 1, adhesionClass: 7 }],
          gridSpacingMm: 2, measurementDateTime: '2026-10-24T00:00:00Z', normReference: 'NF EN ISO 2409:2020'
        },
        operatorId: 'TEST_OP'
      });
      const r = rec as unknown as { status?: unknown; alerts?: { code?: unknown; severity?: unknown }[] };
      status = r.status;
      codes = (r.alerts || []).map((a) => `${String(a.code)}/${String(a.severity)}`);
    } catch {
      status = 'THREW';
    }
    record('IR-14', 'Classe 7 → ERROR/BLOCKING (marquée, non admissible)',
      status === 'ERROR' && codes.some((c) => c.includes('PHYSICAL_BOUNDS_EXCEEDED')),
      'ERROR + BOUNDS', `status=${String(status)}, alertes=${codes.join(',')}`);
  }

  // --- IR-15 : validateur structurel du chargement ---
  {
    const valid = buildTrial();
    const okValid = isStructurallyValidTrial(valid);
    const okEmpty = !isStructurallyValidTrial({});
    const okIdOnly = !isStructurallyValidTrial({ id: 'x' });
    const broken = { ...valid, batches: [{ id: 'b' }] };
    const okPanels = !isStructurallyValidTrial(broken);
    const ok = okValid && okEmpty && okIdOnly && okPanels;
    record('IR-15', 'Validateur chargement : valide OK, corrompus rejetés',
      ok, 'true/false/false/false', `valide=${String(okValid)}, vide=${String(!okEmpty)}, id=${String(!okIdOnly)}, panneaux=${String(!okPanels)}`);
  }

  // --- IR-16 : id numérique → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, id: 123 });
    record('IR-16', 'id numérique → Trial invalide', ok, 'false', String(!ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-17 : id absent → invalide ---
  {
    const valid = buildTrial();
    const { id: _dropped, ...noId } = valid as unknown as Record<string, unknown>;
    void _dropped;
    const ok = !isStructurallyValidTrial(noId);
    record('IR-17', 'id absent → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-18 : stages [null] → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, stages: [null] });
    record('IR-18', 'stages [null] → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-19 : stages [{}] → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, stages: [{}] });
    record('IR-19', 'stages [{}] → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-20 : batches [null] → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, batches: [null] });
    record('IR-20', 'batches [null] → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-21 : panel non objet → invalide ---
  {
    const valid = buildTrial();
    const batch = { ...valid.batches[0], panels: [null] };
    const ok = !isStructurallyValidTrial({ ...valid, batches: [batch] });
    record('IR-21', 'panel non objet → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-22 : config tableau → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, config: [] });
    record('IR-22', 'config [] → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-23 : acquisitions tableau → invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, acquisitions: [] });
    record('IR-23', 'acquisitions [] → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-24 : acquisition invalide → Trial invalide ---
  {
    const valid = buildTrial();
    const ok = !isStructurallyValidTrial({ ...valid, acquisitions: { k1: { id: 'a' } } });
    record('IR-24', 'acquisition sans clés métier → Trial invalide', ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-25 : A valide / B corrompu / C valide au chargement ---
  {
    const store = TrialStoreService.createIsolatedStore();
    void store;
    const trialA = buildTrial();
    const trialC = buildTrial();
    const corruptB = { id: 'corrupt-B', stages: 'not-an-array' };
    const payload = JSON.stringify([trialA, corruptB, trialC]);
    const warns: unknown[][] = [];
    const consoleTarget = console as unknown as { warn: (...args: unknown[]) => void };
    const originalWarn = consoleTarget.warn;
    let threw = false;
    let loadedA = false;
    let loadedC = false;
    let loadedB = false;
    let warned = false;
    const g = globalThis as unknown as Record<string, unknown>;
    const previousStorage = g['localStorage'];
    try {
      const box: { text: string } = { text: '' };
      g['localStorage'] = {
        getItem: () => box.text,
        setItem: (_k: string, v: string) => { box.text = v; }
      };
      (g['localStorage'] as { setItem: (k: string, v: string) => void }).setItem('k', payload);
      consoleTarget.warn = (...args: unknown[]) => { warns.push(args); };
      const fresh = new TrialStoreService();
      loadedA = Boolean(fresh.getTrial(trialA.id));
      loadedC = Boolean(fresh.getTrial(trialC.id));
      loadedB = Boolean(fresh.getTrial('corrupt-B'));
      warned = warns.length > 0;
    } catch {
      threw = true;
    } finally {
      consoleTarget.warn = originalWarn;
      if (previousStorage === undefined) {
        delete g['localStorage'];
      } else {
        g['localStorage'] = previousStorage;
      }
    }
    const ok = !threw && loadedA && loadedC && !loadedB && warned;
    record('IR-25', 'Chargement A/B-corrompu/C : A+C chargés, B ignoré+warn, sans exception',
      ok, 'A+C chargés, B ignoré, warn, sans exception',
      `A=${String(loadedA)}, C=${String(loadedC)}, B=${String(loadedB)}, warn=${String(warned)}, throw=${String(threw)}`);
  }

  // --- IR-26 : id 123 dans le tableau persisté ---
  {
    const trialA = buildTrial();
    const trialC = buildTrial();
    const payload = JSON.stringify([trialA, { id: 123, stages: [], batches: [], acquisitions: {}, config: {} }, trialC]);
    const warns: unknown[][] = [];
    const consoleTarget = console as unknown as { warn: (...args: unknown[]) => void };
    const originalWarn = consoleTarget.warn;
    let threw = false;
    let loadedA = false;
    let loadedC = false;
    const g = globalThis as unknown as Record<string, unknown>;
    const previousStorage = g['localStorage'];
    try {
      const box: { text: string } = { text: '' };
      g['localStorage'] = {
        getItem: () => box.text,
        setItem: (_k: string, v: string) => { box.text = v; }
      };
      (g['localStorage'] as { setItem: (k: string, v: string) => void }).setItem('k', payload);
      consoleTarget.warn = (...args: unknown[]) => { warns.push(args); };
      const fresh = new TrialStoreService();
      loadedA = Boolean(fresh.getTrial(trialA.id));
      loadedC = Boolean(fresh.getTrial(trialC.id));
    } catch {
      threw = true;
    } finally {
      consoleTarget.warn = originalWarn;
      if (previousStorage === undefined) {
        delete g['localStorage'];
      } else {
        g['localStorage'] = previousStorage;
      }
    }
    const ok = !threw && loadedA && loadedC && warns.length > 0;
    record('IR-26', 'id:123 persisté : pas de plantage, voisins chargés',
      ok, 'sans exception, A+C chargés', `A=${String(loadedA)}, C=${String(loadedC)}, throw=${String(threw)}`);
  }

  // --- IR-27 : trial valide + acquisition valide intégralement chargeable ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    store.recordAcquisition({
      trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-E1`, familyId: 'PERSOZ',
      raw: persozReadings([85.2, 84.8, 85.5]), operatorId: 'TEST_OP'
    });
    const saved = store.getTrial(trial.id)!;
    const payload = JSON.stringify([JSON.parse(JSON.stringify(saved))]);
    const g = globalThis as unknown as Record<string, unknown>;
    const previousStorage = g['localStorage'];
    let found = false;
    try {
      const box: { text: string } = { text: '' };
      g['localStorage'] = {
        getItem: () => box.text,
        setItem: (_k: string, v: string) => { box.text = v; }
      };
      (g['localStorage'] as { setItem: (k: string, v: string) => void }).setItem('k', payload);
      const fresh = new TrialStoreService();
      const reloaded = fresh.getTrial(trial.id);
      found = reloaded !== undefined &&
        Object.keys(reloaded.acquisitions).some((k) => k.endsWith('__PERSOZ'));
    } finally {
      if (previousStorage === undefined) {
        delete g['localStorage'];
      } else {
        g['localStorage'] = previousStorage;
      }
    }
    record('IR-27', 'Trial valide + acquisition valide intégralement chargeable',
      found, 'essai + PERSOZ retrouvés', String(found));
  }

  // --- IR-28 : RAW valide ni modifié ni normalisé au chargement ---
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = buildTrial();
    store.saveTrial(trial);
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    const raw = persozReadings([85.2, 84.8, 85.5]);
    store.recordAcquisition({
      trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-E1`, familyId: 'PERSOZ',
      raw, operatorId: 'TEST_OP'
    });
    const key = `${stage.id}__${trial.id}-p-E1__PERSOZ`;
    const before = JSON.stringify(store.getTrial(trial.id)?.acquisitions[key]?.raw);
    const payload = JSON.stringify([store.getTrial(trial.id)]);
    const g = globalThis as unknown as Record<string, unknown>;
    const previousStorage = g['localStorage'];
    let after: string | undefined;
    try {
      const box: { text: string } = { text: '' };
      g['localStorage'] = {
        getItem: () => box.text,
        setItem: (_k: string, v: string) => { box.text = v; }
      };
      (g['localStorage'] as { setItem: (k: string, v: string) => void }).setItem('k', payload);
      const fresh = new TrialStoreService();
      after = JSON.stringify(fresh.getTrial(trial.id)?.acquisitions[key]?.raw);
    } finally {
      if (previousStorage === undefined) {
        delete g['localStorage'];
      } else {
        g['localStorage'] = previousStorage;
      }
    }
    record('IR-28', 'RAW valide strictement inchangé après rechargement',
      before !== undefined && before === after, 'identique', String(before === after));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
