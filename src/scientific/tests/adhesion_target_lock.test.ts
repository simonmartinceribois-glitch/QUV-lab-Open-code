/**
 * QUV-Lab — Suite de Tests VERROU ADHÉSION T0/C12 : matrice métier des cibles.
 *
 * Matrice canonique :
 * - T0 : témoin T UNIQUEMENT (E1/E2/E3 interdits).
 * - C12 : E1/E2/E3 strictement (T interdit).
 * - C1..C11 : aucun panneau.
 * Tout rejet intervient AVANT mutation (IntegrityViolationError).
 */

import { generateStandardExposureStages, globalTrialStore, IntegrityViolationError } from '../../services/trialStore';
import type { Trial } from '../../types/trial';
import type { AdhesionRawData } from '../../types/scientific';

export interface AdhesionTargetLockTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildAdhTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-adh-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-ADH-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['ADHESION'],
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
        reference: `LOT ADH-${trialSeq}`,
        orderIndex: 1,
        dryFilmThicknessMicrons: 90,
        applicationDate: '2026-08-01T00:00:00Z',
        panels: [
          { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
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

function adhRaw(): AdhesionRawData {
  return {
    adhesionClass: 1,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020'
  };
}

function attemptAdh(trial: Trial, cycleIndex: number, panelSuffix: string): { ok: boolean; threwIntegrity: boolean } {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  try {
    globalTrialStore.recordAcquisition({
      trialId: trial.id,
      stageId: stage.id,
      batchId: trial.batches[0].id,
      panelId: `${trial.id}-p-${panelSuffix}`,
      familyId: 'ADHESION',
      raw: adhRaw(),
      operatorId: 'TEST_OP'
    });
    return { ok: true, threwIntegrity: false };
  } catch (err) {
    return { ok: false, threwIntegrity: err instanceof IntegrityViolationError };
  }
}

export function runAdhesionTargetLockTests(): {
  results: AdhesionTargetLockTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionTargetLockTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const cases: { id: string; name: string; cycle: number; panel: string; expectOk: boolean; scheduleOnly?: boolean }[] = [
    { id: 'ADH-T-01', name: 'T0 / T → ACCEPTÉ', cycle: 0, panel: 'T', expectOk: true },
    { id: 'ADH-T-02', name: 'T0 / E1 → REJETÉ', cycle: 0, panel: 'E1', expectOk: false },
    { id: 'ADH-T-03', name: 'T0 / E2 → REJETÉ', cycle: 0, panel: 'E2', expectOk: false },
    { id: 'ADH-T-04', name: 'T0 / E3 → REJETÉ', cycle: 0, panel: 'E3', expectOk: false },
    // C1..C11 : rejet calendaire pré-existant (Error) avant mutation — le verrou
    // cible (IntegrityViolationError) s'applique aux jalons T0/C12.
    { id: 'ADH-T-05', name: 'C1 / T → REJETÉ', cycle: 1, panel: 'T', expectOk: false, scheduleOnly: true },
    { id: 'ADH-T-06', name: 'C6 / E1 → REJETÉ', cycle: 6, panel: 'E1', expectOk: false, scheduleOnly: true },
    { id: 'ADH-T-07', name: 'C11 / E3 → REJETÉ', cycle: 11, panel: 'E3', expectOk: false, scheduleOnly: true },
    { id: 'ADH-T-08', name: 'C12 / T → REJETÉ', cycle: 12, panel: 'T', expectOk: false },
    { id: 'ADH-T-09', name: 'C12 / E1 → ACCEPTÉ', cycle: 12, panel: 'E1', expectOk: true },
    { id: 'ADH-T-10', name: 'C12 / E2 → ACCEPTÉ', cycle: 12, panel: 'E2', expectOk: true },
    { id: 'ADH-T-11', name: 'C12 / E3 → ACCEPTÉ', cycle: 12, panel: 'E3', expectOk: true }
  ];

  cases.forEach((c) => {
    const trial = buildAdhTrial();
    const beforeAcq = JSON.stringify(globalTrialStore.getTrial(trial.id)?.acquisitions || {});
    const beforeAudit = (globalTrialStore.getTrial(trial.id)?.auditTrail || []).length;
    const beforeLock = globalTrialStore.getTrial(trial.id)?.configurationStatus;
    const r = attemptAdh(trial, c.cycle, c.panel);
    const stored = globalTrialStore.getTrial(trial.id);
    const afterAcq = JSON.stringify(stored?.acquisitions || {});
    const afterAudit = (stored?.auditTrail || []).length;
    const unmutated = beforeAcq === afterAcq || c.expectOk;
    const auditOk = beforeAudit === afterAudit || c.expectOk;
    const lockOk = stored?.configurationStatus === beforeLock || c.expectOk;
    const verdictOk = c.expectOk ? r.ok : !r.ok && (c.scheduleOnly ? true : r.threwIntegrity);
    const passed = verdictOk && (c.expectOk || (unmutated && auditOk && lockOk));
    record(
      c.id,
      `${c.name} (rejet avant mutation si interdit)`,
      passed,
      c.expectOk ? 'accepté' : c.scheduleOnly ? 'rejet calendaire, rien muté' : 'IntegrityViolationError, rien muté',
      c.expectOk
        ? (r.ok ? 'accepté' : 'rejet inattendu')
        : `rejet=${String(!r.ok)}, intégrité=${String(r.threwIntegrity)}, intact=${String(unmutated && auditOk && lockOk)}`
    );
  });

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
