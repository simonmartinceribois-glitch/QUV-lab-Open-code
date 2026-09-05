/**
 * QUV-Lab — Suite de Tests VERROU PERSOZ/TÉMOIN : PERSOZ interdit sur T
 *
 * Règle : la dureté Persoz se mesure UNIQUEMENT sur éprouvettes exposées
 * (E1, E2, E3), à tous les jalons (T0..C12). Toute tentative PERSOZ + T,
 * même en contournant l'UI (appel direct au store), est rejetée par
 * recordAcquisition() via IntegrityViolationError AVANT toute écriture.
 */

import { generateStandardExposureStages, globalTrialStore, IntegrityViolationError } from '../../services/trialStore';
import type { Trial } from '../../types/trial';
import type { PersozRawData } from '../../types/scientific';

export interface PersozWitnessLockTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildLockTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-pzt-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-PZT-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['PERSOZ'],
      familyConfigs: {}
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [
      {
        id: batchId,
        trialId,
        reference: `LOT PZT-${trialSeq}`,
        orderIndex: 1,
        panels: [
          { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const },
          // Variantes d'identification du témoin (un seul marqueur chacune).
          { id: `${trialId}-p-W1`, batchId, index: 5, label: 'X', role: 'WITNESS' as const, roleCode: 'E' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-W2`, batchId, index: 6, label: 'X', role: 'EXPOSED_1' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-W3`, batchId, index: 7, label: 'T', role: 'EXPOSED_1' as const, roleCode: 'E' as const, status: 'ACTIVE' as const },
          // Panneau ambigu : exposé générique non identifiable E1/E2/E3 → refusé.
          { id: `${trialId}-p-W4`, batchId, index: 8, label: 'X', role: 'EXPOSED_1' as const, roleCode: 'E' as const, status: 'ACTIVE' as const }
        ]
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  };
  globalTrialStore.saveTrial(trial);
  return trial;
}

function persozRaw(): PersozRawData {
  return {
    readings: [
      { pointIndex: 1, dampingTimeSeconds: 85.2 },
      { pointIndex: 2, dampingTimeSeconds: 84.8 },
      { pointIndex: 3, dampingTimeSeconds: 85.5 }
    ],
    unit: 'SECONDS',
    instrumentMetadata: { temperatureCelsius: 21.5, relativeHumidityPercent: 50 }
  } as PersozRawData;
}

function attemptPersoz(trial: Trial, cycleIndex: number, panelSuffix: string): { threw: boolean; isIntegrity: boolean; code: string; mentionsT: boolean } {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const batchId = trial.batches[0].id;
  const out = { threw: false, isIntegrity: false, code: '', mentionsT: false };
  try {
    globalTrialStore.recordAcquisition({
      trialId: trial.id,
      stageId: stage.id,
      batchId,
      panelId: `${trial.id}-p-${panelSuffix}`,
      familyId: 'PERSOZ',
      raw: persozRaw(),
      operatorId: 'TEST_OP'
    });
  } catch (err) {
    out.threw = true;
    out.isIntegrity = err instanceof IntegrityViolationError;
    const code = (err as { code?: unknown }).code;
    out.code = typeof code === 'string' ? code : '';
    out.mentionsT = String((err as Error).message || '').toLowerCase().includes('témoin');
  }
  return out;
}

export function runPersozWitnessLockTests(): {
  results: PersozWitnessLockTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: PersozWitnessLockTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- PZ-T-01 : attaque directe UI-bypass → rejet IntegrityViolationError ---
  {
    const trial = buildLockTrial();
    const r = attemptPersoz(trial, 12, 'T');
    record(
      'PZ-T-01',
      'Attaque directe (store, sans UI) PERSOZ + T → IntegrityViolationError',
      r.threw && r.isIntegrity && r.code === 'INTEGRITY_VIOLATION' && r.mentionsT,
      'IntegrityViolationError INTEGRITY_VIOLATION mentionnant le témoin',
      `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}, code=${r.code}, mention=${String(r.mentionsT)}`
    );
  }

  // --- PZ-T-02/03/04 : E1/E2/E3 acceptés ---
  (['E1', 'E2', 'E3'] as const).forEach((suffix, i) => {
    const trial = buildLockTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 12)!;
    let ok = false;
    let detail = '';
    try {
      const { record: rec } = globalTrialStore.recordAcquisition({
        trialId: trial.id,
        stageId: stage.id,
        batchId: trial.batches[0].id,
        panelId: `${trial.id}-p-${suffix}`,
        familyId: 'PERSOZ',
        raw: persozRaw(),
        operatorId: 'TEST_OP'
      });
      const mean = (rec.computed as { meanDampingTime?: unknown } | null)?.meanDampingTime;
      ok = typeof mean === 'number';
      detail = `mean=${String(mean)}`;
    } catch (err) {
      detail = `rejet inattendu : ${String((err as Error).message).slice(0, 80)}`;
    }
    record(
      `PZ-T-0${2 + i}`,
      `PERSOZ sur ${suffix} → accepté avec calcul`,
      ok,
      `${suffix} accepté, meanDampingTime numérique`,
      detail
    );
  });

  // --- PZ-T-05..09 : rejet à T0/C1/C6/C11/C12 ---
  ([[0, '05', 'T0'], [1, '06', 'C1'], [6, '07', 'C6'], [11, '08', 'C11'], [12, '09', 'C12']] as const).forEach(
    ([cycle, num, label]) => {
      const trial = buildLockTrial();
      const r = attemptPersoz(trial, cycle, 'T');
      record(
        `PZ-T-${num}`,
        `PERSOZ sur T à ${label} → rejet`,
        r.threw && r.isIntegrity,
        `Rejet à ${label}`,
        `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}`
      );
    }
  );

  // --- PZ-T-10 : role WITNESS seul ---
  {
    const trial = buildLockTrial();
    const r = attemptPersoz(trial, 12, 'W1');
    record(
      'PZ-T-10',
      "Panneau identifié par role === 'WITNESS' → rejet",
      r.threw && r.isIntegrity,
      'Rejet (role WITNESS)',
      `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}`
    );
  }

  // --- PZ-T-11 : roleCode T seul ---
  {
    const trial = buildLockTrial();
    const r = attemptPersoz(trial, 12, 'W2');
    record(
      'PZ-T-11',
      "Panneau identifié par roleCode === 'T' → rejet",
      r.threw && r.isIntegrity,
      'Rejet (roleCode T)',
      `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}`
    );
  }

  // --- Variante label T seul (garde défensive) ---
  {
    const trial = buildLockTrial();
    const r = attemptPersoz(trial, 12, 'W3');
    record(
      'PZ-T-11b',
      "Panneau identifié par label === 'T' → rejet (garde défensive)",
      r.threw && r.isIntegrity,
      'Rejet (label T)',
      `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}`
    );
  }

  // --- PZ-T-12 : aucune acquisition créée après rejet ---
  {
    const trial = buildLockTrial();
    attemptPersoz(trial, 12, 'T');
    const stored = globalTrialStore.getTrial(trial.id);
    const persozKeys = Object.keys(stored?.acquisitions || {}).filter((k) => k.endsWith('__PERSOZ'));
    record(
      'PZ-T-12',
      'Après rejet : aucune acquisition PERSOZ persistée',
      persozKeys.length === 0,
      '0 acquisition PERSOZ',
      `${persozKeys.length} acquisition(s) : ${persozKeys.join(', ').slice(0, 120)}`
    );
  }

  // --- PZ-T-13 : rejet avant toute mutation (RAW, lock, audit) ---
  {
    const trial = buildLockTrial();
    const beforeAcq = JSON.stringify(globalTrialStore.getTrial(trial.id)?.acquisitions || {});
    const beforeAudit = (globalTrialStore.getTrial(trial.id)?.auditTrail || []).length;
    const beforeLock = globalTrialStore.getTrial(trial.id)?.configurationStatus;
    attemptPersoz(trial, 12, 'T');
    const stored = globalTrialStore.getTrial(trial.id);
    const afterAcq = JSON.stringify(stored?.acquisitions || {});
    const afterAudit = (stored?.auditTrail || []).length;
    record(
      'PZ-T-13',
      'Rejet avant mutation : acquisitions, audit et lock intacts',
      beforeAcq === afterAcq && beforeAudit === afterAudit && stored?.configurationStatus === beforeLock,
      'acquisitions + audit + lock inchangés',
      `acq=${String(beforeAcq === afterAcq)}, audit=${beforeAudit}→${afterAudit}, lock=${String(stored?.configurationStatus)}`
    );
  }

  // --- PZ-T-14 : E1/E2/E3 fonctionnels ensemble ---
  {
    const trial = buildLockTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 12)!;
    const batchId = trial.batches[0].id;
    let okCount = 0;
    (['E1', 'E2', 'E3'] as const).forEach((suffix) => {
      try {
        const { record: rec } = globalTrialStore.recordAcquisition({
          trialId: trial.id,
          stageId: stage.id,
          batchId,
          panelId: `${trial.id}-p-${suffix}`,
          familyId: 'PERSOZ',
          raw: persozRaw(),
          operatorId: 'TEST_OP'
        });
        if (typeof (rec.computed as { meanDampingTime?: unknown } | null)?.meanDampingTime === 'number') okCount += 1;
      } catch {
        // compté comme échec via okCount
      }
    });
    record(
      'PZ-T-14',
      'PERSOZ E1/E2/E3 continuent de fonctionner (campagne complète)',
      okCount === 3,
      '3/3 acceptés avec calcul',
      `${okCount}/3 acceptés`
    );
  }

  // --- PZ-T-15 : E1/E2/E3 à T0 acceptés ---
  {
    const trial = buildLockTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    const batchId = trial.batches[0].id;
    let okCount = 0;
    (['E1', 'E2', 'E3'] as const).forEach((suffix) => {
      try {
        globalTrialStore.recordAcquisition({
          trialId: trial.id,
          stageId: stage.id,
          batchId,
          panelId: `${trial.id}-p-${suffix}`,
          familyId: 'PERSOZ',
          raw: persozRaw(),
          operatorId: 'TEST_OP'
        });
        okCount += 1;
      } catch {
        // compté comme échec via okCount
      }
    });
    record(
      'PZ-T-15',
      'PERSOZ E1/E2/E3 à T0 → acceptés',
      okCount === 3,
      '3/3 acceptés à T0',
      `${okCount}/3 acceptés`
    );
  }

  // --- PZ-T-16 : jalon intermédiaire C6 accepté sur exposé ---
  {
    const trial = buildLockTrial();
    const r = (() => {
      const stage = trial.stages.find((s) => s.cycleIndex === 6)!;
      try {
        globalTrialStore.recordAcquisition({
          trialId: trial.id,
          stageId: stage.id,
          batchId: trial.batches[0].id,
          panelId: `${trial.id}-p-E2`,
          familyId: 'PERSOZ',
          raw: persozRaw(),
          operatorId: 'TEST_OP'
        });
        return true;
      } catch {
        return false;
      }
    })();
    record(
      'PZ-T-16',
      'PERSOZ E2 à C6 (intermédiaire) → accepté',
      r,
      'Accepté à C6',
      r ? 'accepté' : 'rejet inattendu'
    );
  }

  // --- PZ-T-17 : panneau non identifiable E1/E2/E3 → rejet ---
  {
    const trial = buildLockTrial();
    const r = attemptPersoz(trial, 12, 'W4');
    record(
      'PZ-T-17',
      "Panneau ambigu (code 'E' générique) → rejet IntegrityViolationError",
      r.threw && r.isIntegrity && r.code === 'INTEGRITY_VIOLATION',
      'Rejet (non identifiable E1/E2/E3)',
      `threw=${String(r.threw)}, integrity=${String(r.isIntegrity)}, code=${r.code}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
