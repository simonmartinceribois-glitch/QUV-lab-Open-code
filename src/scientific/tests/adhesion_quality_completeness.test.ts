/**
 * QUV-Lab — Suite de Tests COMPLÉTUDE ADHÉSION T0/C12 dans qualityEngine.
 *
 * assessStageQuality() évalue ADHÉSION sur les seuls panneaux éligibles au jalon
 * via isAdhesionEligiblePanel (T0→T, C12→E1/E2/E3, C1-C11→aucun).
 * Les absences normales (E à T0, T à C12) ne sont jamais des manquants ;
 * les acquisitions interdites historiques ne satisfont jamais la couverture
 * et ne sont jamais supprimées.
 */

import { generateStandardExposureStages, globalTrialStore, IntegrityViolationError } from '../../services/trialStore';
import { assessStageQuality } from '../qualityEngine';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { AdhesionRawData, MeasurementAlert } from '../../types/scientific';

export interface AdhesionQualityCompletenessTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;
const TRIAL_BASE = 'trial-aqc';

function buildQualityTrial(): Trial {
  trialSeq += 1;
  const trialId = `${TRIAL_BASE}-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-AQC-${trialSeq}`, createdBy: 'TEST_OP' },
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
        reference: `LOT AQC-${trialSeq}`,
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
  return trial;
}

function adhAcq(
  trial: Trial,
  cycleIndex: number,
  panelSuffix: string,
  adhesionClass: number,
  alerts: MeasurementAlert[] = []
): void {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const raw: AdhesionRawData = {
    adhesionClass,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020'
  };
  const record: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}`,
    trialId: trial.id,
    stageId: stage.id,
    batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`,
    familyId: 'ADHESION',
    raw,
    computed: null,
    status: 'COMPLETE',
    alerts,
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' },
    mediaIds: []
  };
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__ADHESION`] = record;
}

function assessAdh(trial: Trial, cycleIndex: number) {
  const ruleSet = getDefaultScientificRuleSet();
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  return assessStageQuality(stage.id, trial, ruleSet);
}

export function runAdhesionQualityCompletenessTests(): {
  results: AdhesionQualityCompletenessTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionQualityCompletenessTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- AQC-01 : T0 complet (T seul) → GOOD ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 0, 'T', 0);
    const a = assessAdh(trial, 0);
    record(
      'AQC-01',
      'T0 complet (T présent) → ADHESION GOOD',
      a.familyAssessments['ADHESION'] === 'GOOD' &&
        a.panelsComplete === 1 &&
        a.panelsWithWarnings === 0 &&
        a.panelsInvalid === 0,
      'GOOD, complete=1, warnings=0, invalid=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}, warnings=${a.panelsWithWarnings}, invalid=${a.panelsInvalid}`
    );
  }

  // --- AQC-02 : T0 T absent → non-GOOD, T requis ---
  {
    const trial = buildQualityTrial();
    const a = assessAdh(trial, 0);
    record(
      'AQC-02',
      'T0 T absent → ADHESION non-GOOD (T requis)',
      a.familyAssessments['ADHESION'] !== 'GOOD' &&
        a.familyAssessments['ADHESION'] === 'ACCEPTABLE' &&
        a.panelsComplete === 0,
      'ACCEPTABLE, complete=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}`
    );
  }

  // --- AQC-03 : E absents à T0 = normal ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 0, 'T', 1);
    const a = assessAdh(trial, 0);
    record(
      'AQC-03',
      'T0 E1/E2/E3 absents → normal (ni manquants ni anomalie)',
      a.familyAssessments['ADHESION'] === 'GOOD' &&
        a.panelsWithWarnings === 0 &&
        a.panelsInvalid === 0,
      'GOOD, warnings=0, invalid=0',
      `${a.familyAssessments['ADHESION']}, warnings=${a.panelsWithWarnings}, invalid=${a.panelsInvalid}`
    );
  }

  // --- AQC-04/05/06 : C1/C6/C11 non applicables ---
  ([[1, '04', 'C1'], [6, '05', 'C6'], [11, '06', 'C11']] as const).forEach(([cycle, num, label]) => {
    const trial = buildQualityTrial();
    const a = assessAdh(trial, cycle);
    record(
      `AQC-${num}`,
      `${label} sans ADHESION → non applicable (jamais ACCEPTABLE par absence)`,
      !('ADHESION' in a.familyAssessments) && a.globalStatus === 'GOOD',
      'pas de clé ADHESION, GOOD',
      `clé=${String('ADHESION' in a.familyAssessments)}, global=${a.globalStatus}`
    );
  });

  // --- AQC-07 : C12 complet → GOOD ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 12, 'E1', 2);
    adhAcq(trial, 12, 'E2', 3);
    adhAcq(trial, 12, 'E3', 2);
    const a = assessAdh(trial, 12);
    record(
      'AQC-07',
      'C12 complet (E1/E2/E3, T absent) → ADHESION GOOD',
      a.familyAssessments['ADHESION'] === 'GOOD' &&
        a.panelsComplete === 3 &&
        a.panelsWithWarnings === 0 &&
        a.panelsInvalid === 0,
      'GOOD, complete=3, warnings=0, invalid=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}, warnings=${a.panelsWithWarnings}, invalid=${a.panelsInvalid}`
    );
  }

  // --- AQC-08 : C12 partiel (E3 manquant) → non-GOOD ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 12, 'E1', 2);
    adhAcq(trial, 12, 'E2', 3);
    const a = assessAdh(trial, 12);
    record(
      'AQC-08',
      'C12 partiel (E3 manquant) → ADHESION non-GOOD',
      a.familyAssessments['ADHESION'] !== 'GOOD' &&
        a.panelsComplete === 2 &&
        a.panelsWithWarnings === 1,
      'ACCEPTABLE, complete=2, warnings=1 (E3)',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}, warnings=${a.panelsWithWarnings}`
    );
  }

  // --- AQC-09 : C12 une seule mesure → non-GOOD ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 12, 'E1', 2);
    const a = assessAdh(trial, 12);
    record(
      'AQC-09',
      'C12 une seule mesure → ADHESION non-GOOD',
      a.familyAssessments['ADHESION'] !== 'GOOD' && a.panelsComplete === 1,
      'non-GOOD, complete=1',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}`
    );
  }

  // --- AQC-10 : C12 aucune mesure → non-GOOD ---
  {
    const trial = buildQualityTrial();
    const a = assessAdh(trial, 12);
    record(
      'AQC-10',
      'C12 aucune mesure → ADHESION non-GOOD',
      a.familyAssessments['ADHESION'] !== 'GOOD' && a.panelsComplete === 0,
      'non-GOOD, complete=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}`
    );
  }

  // --- AQC-11 : C12 T absent → normal ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 12, 'E1', 2);
    adhAcq(trial, 12, 'E2', 3);
    adhAcq(trial, 12, 'E3', 2);
    const a = assessAdh(trial, 12);
    record(
      'AQC-11',
      'C12 T absent → normal (T jamais requis à C12)',
      a.panelsWithWarnings === 0 && a.panelsInvalid === 0,
      'warnings=0, invalid=0',
      `warnings=${a.panelsWithWarnings}, invalid=${a.panelsInvalid}`
    );
  }

  // --- AQC-12 : données historiques interdites (T0/E1, C12/T) ---
  {
    const trial = buildQualityTrial();
    adhAcq(trial, 0, 'E1', 2);
    adhAcq(trial, 12, 'T', 1);
    const aT0 = assessAdh(trial, 0);
    const aC12 = assessAdh(trial, 12);
    const forbiddenKept =
      Object.keys(trial.acquisitions).filter((k) => k.endsWith('__ADHESION')).length === 2;
    record(
      'AQC-12',
      'Historiques interdits : ne satisfont rien, jamais supprimés',
      aT0.familyAssessments['ADHESION'] !== 'GOOD' &&
        aC12.familyAssessments['ADHESION'] !== 'GOOD' &&
        forbiddenKept,
      'T0≠GOOD, C12≠GOOD, 2 acquisitions conservées',
      `T0=${aT0.familyAssessments['ADHESION']}, C12=${aC12.familyAssessments['ADHESION']}, conservées=${String(forbiddenKept)}`
    );
  }

  // --- AQC-13 : référence C12 = T0/T (leurre T0/E1 ignoré) ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const trial = buildQualityTrial();
    adhAcq(trial, 0, 'T', 1);
    adhAcq(trial, 0, 'E1', 5);
    adhAcq(trial, 12, 'E1', 3);
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__ADHESION`];
    const { updatedRecord, rawUnchanged } = recalculateAcquisition(rec, trial, ruleSet);
    const computed = updatedRecord.computed as { initialAdhesionClass?: unknown; deltaAdhesionClass?: unknown } | null;
    record(
      'AQC-13',
      'Référence C12 = T0/T (leurre T0/E1=5 ignoré)',
      rawUnchanged === true &&
        computed?.initialAdhesionClass === 1 &&
        computed?.deltaAdhesionClass === 2,
      'initial=1 (témoin), Δ=+2',
      `initial=${String(computed?.initialAdhesionClass)}, Δ=${String(computed?.deltaAdhesionClass)}`
    );
  }

  // --- AQC-14 : T0 absent + C12 complet → aucune référence fabriquée ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const trial = buildQualityTrial();
    adhAcq(trial, 12, 'E1', 2);
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__ADHESION`];
    const { updatedRecord } = recalculateAcquisition(rec, trial, ruleSet);
    const computed = updatedRecord.computed as {
      adhesionClass?: unknown;
      initialAdhesionClass?: unknown;
      initialPanelMean?: unknown;
      deltaAdhesionClass?: unknown;
    } | null;
    record(
      'AQC-14',
      'T0 absent : mesure C12 calculée, référence à null (jamais 0 fabriqué)',
      computed?.adhesionClass === 2 &&
        (computed?.initialAdhesionClass ?? null) === null &&
        (computed?.initialPanelMean ?? null) === null &&
        (computed?.deltaAdhesionClass ?? null) === null,
      'classe=2, initial=null, Δ=null',
      `classe=${String(computed?.adhesionClass)}, initial=${String(computed?.initialAdhesionClass)}, Δ=${String(computed?.deltaAdhesionClass)}`
    );
  }

  // --- AQC-15 : non-régression PERSOZ/T ---
  {
    const trial = buildQualityTrial();
    trial.config.activeFamilies = ['ADHESION', 'PERSOZ'];
    globalTrialStore.saveTrial(trial);
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const batchId = trial.batches[0].id;
    const persozRaw = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: 85.2 },
        { pointIndex: 2, dampingTimeSeconds: 84.8 },
        { pointIndex: 3, dampingTimeSeconds: 85.5 }
      ],
      unit: 'SECONDS'
    };
    let exposedOk = false;
    let witnessRejected = false;
    try {
      globalTrialStore.recordAcquisition({
        trialId: trial.id,
        stageId: stageT0.id,
        batchId,
        panelId: `${trial.id}-p-E1`,
        familyId: 'PERSOZ',
        raw: persozRaw,
        operatorId: 'TEST_OP'
      });
      exposedOk = true;
    } catch {
      exposedOk = false;
    }
    try {
      globalTrialStore.recordAcquisition({
        trialId: trial.id,
        stageId: stageT0.id,
        batchId,
        panelId: `${trial.id}-p-T`,
        familyId: 'PERSOZ',
        raw: persozRaw,
        operatorId: 'TEST_OP'
      });
    } catch (err) {
      witnessRejected = err instanceof IntegrityViolationError;
    }
    record(
      'AQC-15',
      'Non-régression PERSOZ : E1 accepté, T rejeté',
      exposedOk && witnessRejected,
      'E1 accepté + T IntegrityViolationError',
      `E1=${String(exposedOk)}, T rejeté=${String(witnessRejected)}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
