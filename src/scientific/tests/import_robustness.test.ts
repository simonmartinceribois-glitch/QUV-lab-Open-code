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
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';

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

  // Helpers acquisitions persistées : entrée structurellement complète.
  const persistedEntry = (trial: Trial, raw: unknown, familyId: unknown) => {
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    return {
      id: 'acq-persist-1',
      trialId: trial.id,
      stageId: stage.id,
      batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-E1`,
      familyId,
      raw,
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }
    };
  };
  const withPersisted = (trial: Trial, entry: unknown) => ({
    ...trial,
    acquisitions: { k1: entry }
  });

  // --- IR-29/30/31 : RAW persisté mal formé → Trial invalide ---
  ([[null, '29', 'null'], [[], '30', '[]'], ['texte', '31', '"texte"']] as const).forEach(
    ([raw, num, label]) => {
      const trial = buildTrial();
      const ok = !isStructurallyValidTrial(withPersisted(trial, persistedEntry(trial, raw, 'PERSOZ')));
      record(`IR-${num}`, `Acquisition persistée raw=${label} → Trial invalide`,
        ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
    }
  );

  // --- IR-32 : RAW primitifs (42, true) → Trial invalide ---
  {
    const trial = buildTrial();
    const ok42 = !isStructurallyValidTrial(withPersisted(trial, persistedEntry(trial, 42, 'PERSOZ')));
    const trial2 = buildTrial();
    const okTrue = !isStructurallyValidTrial(withPersisted(trial2, persistedEntry(trial2, true, 'PERSOZ')));
    record('IR-32', 'Acquisition persistée raw=42/true → Trial invalide',
      ok42 && okTrue, 'false/false', `42=${String(ok42 ? 'rejeté' : 'fuite')}, true=${String(okTrue ? 'rejeté' : 'fuite')}`);
  }

  // --- IR-33/34 : familyId persisté invalide → Trial invalide ---
  {
    const trial = buildTrial();
    const okUnknown = !isStructurallyValidTrial(
      withPersisted(trial, persistedEntry(trial, { readings: [] }, 'UNKNOWN')));
    const trial2 = buildTrial();
    const okNum = !isStructurallyValidTrial(
      withPersisted(trial2, persistedEntry(trial2, { readings: [] }, 123)));
    record('IR-33', 'familyId "UNKNOWN" persisté → Trial invalide',
      okUnknown, 'false', String(okUnknown ? 'rejeté' : 'ACCEPTÉ (fuite)'));
    record('IR-34', 'familyId 123 persisté → Trial invalide',
      okNum, 'false', String(okNum ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // Mock localStorage avec suivi d'écriture.
  const mockStorage = (initial: string) => {
    const box: { text: string; sets: number } = { text: initial, sets: 0 };
    return {
      box,
      api: {
        getItem: () => box.text,
        setItem: (_k: string, v: string) => { box.text = v; box.sets += 1; }
      }
    };
  };
  const withMockStorage = <T>(initial: string, fn: (box: { text: string; sets: number }) => T): { result: T; box: { text: string; sets: number }; warns: unknown[][]; threw: boolean } => {
    const g = globalThis as unknown as Record<string, unknown>;
    const previousStorage = g['localStorage'];
    const warns: unknown[][] = [];
    const consoleTarget = console as unknown as { warn: (...args: unknown[]) => void };
    const originalWarn = consoleTarget.warn;
    const mock = mockStorage(initial);
    let result: T | undefined;
    let threw = false;
    try {
      g['localStorage'] = mock.api;
      consoleTarget.warn = (...args: unknown[]) => { warns.push(args); };
      result = fn(mock.box);
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
    return { result: result as T, box: mock.box, warns, threw };
  };

  // --- IR-35 : JSON corrompu → warn, aucune écriture, contenu identique ---
  {
    const before = '{ this is not valid JSON';
    const out = withMockStorage(before, () => new TrialStoreService());
    const ok = !out.threw && out.warns.length > 0 && out.box.sets === 0 && out.box.text === before;
    record('IR-35', 'JSON corrompu : warn, 0 écriture, contenu identique',
      ok, 'warn + sets=0 + identique',
      `throw=${String(out.threw)}, warns=${out.warns.length}, sets=${out.box.sets}, identique=${String(out.box.text === before)}`);
  }

  // --- IR-36 : [A valide, B corrompu, C valide] ---
  {
    const trialA = buildTrial();
    const trialC = buildTrial();
    const payload = JSON.stringify([trialA, { id: 'B', stages: 'x' }, trialC]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const fresh = out.result;
    const ok = !out.threw &&
      Boolean(fresh.getTrial(trialA.id)) &&
      Boolean(fresh.getTrial(trialC.id)) &&
      out.warns.length > 0 &&
      out.box.sets === 0;
    record('IR-36', 'Mixte : A+C chargés, B ignoré+warn, aucune réécriture',
      ok, 'A+C chargés, warn, sets=0',
      `A=${String(Boolean(fresh.getTrial(trialA.id)))}, C=${String(Boolean(fresh.getTrial(trialC.id)))}, warns=${out.warns.length}, sets=${out.box.sets}`);
  }

  // --- IR-37 : tableau entièrement corrompu ---
  {
    const payload = JSON.stringify([null, {}, { id: 123 }, { id: 'BAD', stages: [] }]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const fresh = out.result;
    // Aucun des corrompus ne doit être chargé (ni demos persistées par-dessus).
    const loadedBad = fresh.getTrial('BAD');
    const ok = !out.threw && loadedBad === undefined && out.warns.length > 0 && out.box.sets === 0;
    record('IR-37', 'Tout-corrompu : rien chargé, warn, aucun écrasement',
      ok, '0 chargé, warn, sets=0',
      `BAD=${String(loadedBad !== undefined)}, warns=${out.warns.length}, sets=${out.box.sets}`);
  }

  // --- IR-38 : raw {} reste chargeable ---
  {
    const trial = buildTrial();
    const ok = isStructurallyValidTrial(withPersisted(trial, persistedEntry(trial, {}, 'PERSOZ')));
    record('IR-38', 'raw {} : structurellement valide (MISSING = moteurs)',
      ok, 'true', String(ok));
  }

  // --- IR-39 : vraie valeur 0 intacte au rechargement ---
  {
    const trial = buildTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    const key = `${stage.id}__${trial.id}-p-E1__PERSOZ`;
    trial.acquisitions[key] = {
      id: 'acq-zero', trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-E1`, familyId: 'PERSOZ',
      raw: { readings: [{ pointIndex: 1, dampingTimeSeconds: 0 }] },
      computed: null, status: 'COMPLETE', alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
    } as PanelAcquisitionRecord;
    const payload = JSON.stringify([trial]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const rawAfter = (out.result.getTrial(trial.id)?.acquisitions[key]?.raw as { readings?: { dampingTimeSeconds?: unknown }[] } | undefined)?.readings?.[0]?.dampingTimeSeconds;
    const ok = !out.threw && rawAfter === 0;
    record('IR-39', 'Vraie valeur 0 intacte après rechargement (pas missing)',
      ok, '0 conservé', `valeur=${String(rawAfter)}`);
  }

  // Acquisition relationnellement cohérente de référence pour IR-40..50.
  const coherentEntry = (trial: Trial) => {
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    return {
      id: 'acq-rel-1',
      trialId: trial.id,
      stageId: stage.id,
      batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-E1`,
      familyId: 'PERSOZ',
      raw: { readings: [{ pointIndex: 1, dampingTimeSeconds: 85 }] },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }
    };
  };
  const withOneAcq = (trial: Trial, entry: unknown) => ({
    ...trial,
    acquisitions: { k1: entry }
  });

  // --- IR-40 : trialId différent → invalide ---
  {
    const trial = buildTrial();
    const entry = { ...coherentEntry(trial), trialId: 'autre-essai' };
    const ok = !isStructurallyValidTrial(withOneAcq(trial, entry));
    record('IR-40', 'Acquisition trialId ≠ essai → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-41 : stageId inexistant → invalide ---
  {
    const trial = buildTrial();
    const entry = { ...coherentEntry(trial), stageId: 'stage-inexistant' };
    const ok = !isStructurallyValidTrial(withOneAcq(trial, entry));
    record('IR-41', 'Acquisition stageId inexistant → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-42 : batchId inexistant → invalide ---
  {
    const trial = buildTrial();
    const entry = { ...coherentEntry(trial), batchId: 'batch-inexistant' };
    const ok = !isStructurallyValidTrial(withOneAcq(trial, entry));
    record('IR-42', 'Acquisition batchId inexistant → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-43 : panelId inexistant dans le batch → invalide ---
  {
    const trial = buildTrial();
    const entry = { ...coherentEntry(trial), panelId: `${trial.id}-p-FANTOME` };
    const ok = !isStructurallyValidTrial(withOneAcq(trial, entry));
    record('IR-43', 'Acquisition panelId inexistant → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-44 : panel d'un AUTRE batch → invalide ---
  {
    const trial = buildTrial();
    const batch1 = trial.batches[0];
    const batch2 = {
      ...batch1,
      id: `${trial.id}-batch-2`,
      panels: batch1.panels.map((p) => ({ ...p, id: `${p.id}-b2`, batchId: `${trial.id}-batch-2` }))
    };
    const trial2 = { ...trial, batches: [batch1, batch2] };
    const entry = {
      ...coherentEntry(trial),
      batchId: batch1.id,
      panelId: `${trial.id}-p-E1-b2`
    };
    const ok = !isStructurallyValidTrial(withOneAcq(trial2, entry));
    record('IR-44', 'Panel existant mais dans un autre batch → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-45 : panel.batchId ≠ acquisition.batchId → invalide ---
  {
    const trial = buildTrial();
    const batch = {
      ...trial.batches[0],
      panels: trial.batches[0].panels.map((p) =>
        p.id === `${trial.id}-p-E1` ? { ...p, batchId: 'batch-menteur' } : p)
    };
    const trial2 = { ...trial, batches: [batch] };
    const entry = coherentEntry(trial);
    const ok = !isStructurallyValidTrial(withOneAcq(trial2, entry));
    record('IR-45', 'panel.batchId ≠ acquisition.batchId → Trial invalide',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-46 : acquisition cohérente → valide ---
  {
    const trial = buildTrial();
    const ok = isStructurallyValidTrial(withOneAcq(trial, coherentEntry(trial)));
    record('IR-46', 'Acquisition relationnellement valide → Trial valide',
      ok, 'true', String(ok));
  }

  // --- IR-47 : 2 valides + 1 corrompue → Trial rejeté entièrement ---
  {
    const trial = buildTrial();
    const good = coherentEntry(trial);
    const bad = { ...coherentEntry(trial), id: 'acq-rel-2', stageId: 'stage-inexistant' };
    const candidate = {
      ...trial,
      acquisitions: { k1: good, k2: { ...good, id: 'acq-rel-3' }, k3: bad }
    };
    const ok = !isStructurallyValidTrial(candidate);
    record('IR-47', 'Une acquisition corrompue invalide tout le Trial',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-48 : [A valide, B corrompu relationnel, C valide] au chargement ---
  {
    const trialA = buildTrial();
    const trialC = buildTrial();
    const trialB = buildTrial();
    const badEntry = { ...coherentEntry(trialB), panelId: `${trialB.id}-p-FANTOME` };
    const trialBCorrupt = withOneAcq(trialB, badEntry);
    const payload = JSON.stringify([trialA, trialBCorrupt, trialC]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const fresh = out.result;
    const ok = !out.threw &&
      Boolean(fresh.getTrial(trialA.id)) &&
      Boolean(fresh.getTrial(trialC.id)) &&
      fresh.getTrial(trialB.id) === undefined &&
      out.warns.length > 0 &&
      out.box.sets === 0;
    record('IR-48', 'A+C chargés, B relationnellement corrompu ignoré, 0 écriture',
      ok, 'A+C chargés, B ignoré, sets=0',
      `A=${String(Boolean(fresh.getTrial(trialA.id)))}, C=${String(Boolean(fresh.getTrial(trialC.id)))}, B=${String(fresh.getTrial(trialB.id) !== undefined)}, warns=${out.warns.length}, sets=${out.box.sets}`);
  }

  // --- IR-49 : aucune correction silencieuse des IDs ---
  {
    const trial = buildTrial();
    const entry = { ...coherentEntry(trial), panelId: `${trial.id}-p-FANTOME` };
    const before = JSON.stringify(entry);
    const valid = isStructurallyValidTrial(withOneAcq(trial, entry));
    const after = JSON.stringify(entry);
    record('IR-49', 'Aucune correction silencieuse (rejet + objet intact)',
      !valid && before === after, 'rejeté, intact', `rejeté=${String(!valid)}, intact=${String(before === after)}`);
  }

  // --- IR-50 : RAW inchangé sur acquisition relationnellement valide ---
  {
    const trial = buildTrial();
    const entry = coherentEntry(trial);
    const before = JSON.stringify(entry.raw);
    const payload = JSON.stringify([withOneAcq(trial, entry)]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const key = Object.keys(out.result.getTrial(trial.id)?.acquisitions || {})[0];
    const after = JSON.stringify(out.result.getTrial(trial.id)?.acquisitions[key]?.raw);
    const ok = !out.threw && before === after;
    record('IR-50', 'RAW strictement inchangé après rechargement valide',
      ok, 'identique', String(ok));
  }

  // --- IR-51 : doublon stage.id → rejet, sans mutation ---
  {
    const trial = buildTrial();
    const stages = [...trial.stages];
    stages[2] = { ...stages[1], cycleIndex: 2 };
    const candidate = { ...trial, stages };
    const before = JSON.stringify(candidate);
    const ok = !isStructurallyValidTrial(candidate);
    const unmutated = JSON.stringify(candidate) === before;
    record('IR-51', 'Doublon stage.id → Trial rejeté, objet intact',
      ok && unmutated, 'rejeté, intact', `rejeté=${String(ok)}, intact=${String(unmutated)}`);
  }

  // --- IR-52 : doublon batch.id → rejet ---
  {
    const trial = buildTrial();
    const batch2 = { ...trial.batches[0], id: trial.batches[0].id, reference: 'LOT DUP' };
    const candidate = { ...trial, batches: [...trial.batches, batch2] };
    const before = JSON.stringify(candidate);
    const ok = !isStructurallyValidTrial(candidate);
    record('IR-52', 'Doublon batch.id → Trial rejeté, sans écrasement',
      ok && JSON.stringify(candidate) === before, 'rejeté, intact', String(ok));
  }

  // --- IR-53 : doublon panel.id dans le même batch → rejet ---
  {
    const trial = buildTrial();
    const batch = trial.batches[0];
    const candidate = {
      ...trial,
      batches: [{ ...batch, panels: [...batch.panels, { ...batch.panels[1] }] }]
    };
    const ok = !isStructurallyValidTrial(candidate);
    record('IR-53', 'Doublon panel.id intra-batch → Trial rejeté',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-54 : doublon panel.id entre deux batches → rejet ---
  {
    const trial = buildTrial();
    const batch1 = trial.batches[0];
    const batch2 = {
      ...batch1,
      id: `${trial.id}-batch-2`,
      panels: [{ ...batch1.panels[1], id: batch1.panels[1].id, batchId: `${trial.id}-batch-2` }]
    };
    const candidate = { ...trial, batches: [batch1, batch2] };
    const ok = !isStructurallyValidTrial(candidate);
    record('IR-54', 'Doublon panel.id inter-batches → Trial rejeté (unicité globale)',
      ok, 'false', String(ok ? 'rejeté' : 'ACCEPTÉ (fuite)'));
  }

  // --- IR-55 : IDs uniques + acquisition cohérente → valide ---
  {
    const trial = buildTrial();
    const ok = isStructurallyValidTrial(withOneAcq(trial, coherentEntry(trial)));
    record('IR-55', 'IDs uniques + acquisition cohérente → Trial valide',
      ok, 'true', String(ok));
  }

  // --- IR-56 : [A valide, B doublon structurel, C valide] au chargement ---
  {
    const trialA = buildTrial();
    const trialC = buildTrial();
    const trialB = buildTrial();
    const batchB = {
      ...trialB.batches[0],
      panels: [...trialB.batches[0].panels, { ...trialB.batches[0].panels[1] }]
    };
    const corruptB = { ...trialB, batches: [batchB] };
    const payload = JSON.stringify([trialA, corruptB, trialC]);
    const out = withMockStorage(payload, () => new TrialStoreService());
    const fresh = out.result;
    const before = JSON.stringify(corruptB);
    const ok = !out.threw &&
      Boolean(fresh.getTrial(trialA.id)) &&
      Boolean(fresh.getTrial(trialC.id)) &&
      fresh.getTrial(trialB.id) === undefined &&
      out.warns.length > 0 &&
      out.box.sets === 0 &&
      JSON.stringify(corruptB) === before;
    record('IR-56', 'A+C chargés, B (doublon) ignoré+warn, 0 écriture, B intact',
      ok, 'A+C chargés, B ignoré',
      `A=${String(Boolean(fresh.getTrial(trialA.id)))}, C=${String(Boolean(fresh.getTrial(trialC.id)))}, warns=${out.warns.length}, sets=${out.box.sets}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
