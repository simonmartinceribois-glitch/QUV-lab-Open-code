/**
 * QUV-Lab — Suite de Tests VERROU RÉFÉRENCES recalculator (P2).
 *
 * recalculateAcquisition() ne résout une référence (referenceRaw + trace)
 * que pour une acquisition admissible : ADHÉSION selon matrice T0/T–C12/E,
 * PERSOZ E1-E3, autres familles inchangées. Sinon NONE + nulls, RAW intact.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { ReferenceTrace } from '../../types/scientific';

export interface ReferenceEligibilityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-rte-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-RTE-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['ADHESION', 'PERSOZ'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT RTE-${trialSeq}`, orderIndex: 1,
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

function adhRaw(cls: number) {
  return {
    adhesionClass: cls,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020'
  };
}

function persozRaw() {
  return {
    readings: [85.2, 84.8, 85.5].map((v, i) => ({ pointIndex: i + 1, dampingTimeSeconds: v })),
    unit: 'SECONDS'
  };
}

function seed(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string, raw: unknown): PanelAcquisitionRecord {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const rec: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw, computed: null, status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  const { updatedRecord, rawUnchanged } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = updatedRecord;
  if (!rawUnchanged) throw new Error('RAW muté pendant le recalcul');
  return updatedRecord;
}

function traceOf(rec: PanelAcquisitionRecord): ReferenceTrace | undefined {
  return (rec.computed as { referenceTrace?: ReferenceTrace } | null)?.referenceTrace;
}

export function runReferenceEligibilityTests(): {
  results: ReferenceEligibilityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ReferenceEligibilityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const noneOk = (t: ReferenceTrace | undefined): boolean =>
    t?.referenceRule === 'NONE' &&
    t?.referenceStageId === null && t?.referencePanelId === null && t?.referenceAcquisitionId === null;

  // --- RT-E01 : T0/T → NONE ---
  {
    const trial = buildTrial();
    const rec = seed(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const t = traceOf(rec);
    record('RT-E01', 'ADHÉSION T0/T → NONE (mesure initiale)', noneOk(t), 'NONE + nulls', JSON.stringify(t));
  }

  // --- RT-E02/03/04 : C1/C6/C11 → aucun calcul (verrou population) ---
  ([[1, 'T', '02', 'C1/T'], [6, 'E1', '03', 'C6/E1'], [11, 'E3', '04', 'C11/E3']] as const).forEach(
    ([cycle, panel, num, label]) => {
      const trial = buildTrial();
      seed(trial, 0, 'T', 'ADHESION', adhRaw(0));
      const rec = seed(trial, cycle, panel, 'ADHESION', adhRaw(2));
      record(`RT-E${num}`, `ADHÉSION ${label} → aucun COMPUTED (verrou population)`,
        rec.computed === null && rec.status === 'EMPTY',
        'computed=null, EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
    }
  );

  // --- RT-E05 : C12/T → aucun calcul ---
  {
    const trial = buildTrial();
    seed(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = seed(trial, 12, 'T', 'ADHESION', adhRaw(1));
    record('RT-E05', 'ADHÉSION C12/T → aucun COMPUTED',
      rec.computed === null && rec.status === 'EMPTY',
      'computed=null, EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  }

  // --- RT-E06/07/08 : C12/E → T0_WITNESS_REFERENCE ---
  {
    const trial = buildTrial();
    seed(trial, 0, 'T', 'ADHESION', adhRaw(1));
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      const rec = seed(trial, 12, sfx, 'ADHESION', adhRaw(2 + i));
      const t = traceOf(rec);
      const ok = t?.referenceRule === 'T0_WITNESS_REFERENCE' &&
        t?.referenceStageId === stageT0.id &&
        t?.referencePanelId === `${trial.id}-p-T` &&
        t?.referenceAcquisitionId === `acq-${stageT0.id}-T-ADHESION`;
      record(`RT-E0${6 + i}`, `ADHÉSION C12/${sfx} → T0_WITNESS_REFERENCE`,
        ok, 'T0/T tracé', JSON.stringify(t));
    });
  }

  // --- RT-E09 : PERSOZ/T → aucun calcul ---
  {
    const trial = buildTrial();
    seed(trial, 0, 'T', 'PERSOZ', persozRaw());
    seed(trial, 12, 'T', 'PERSOZ', persozRaw());
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-T__PERSOZ`];
    record('RT-E09', 'PERSOZ/T (C12) → aucun COMPUTED',
      rec.computed === null && rec.status === 'EMPTY',
      'computed=null, EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  }

  // --- RT-E10/11/12 : PERSOZ E → SAME_PANEL_T0 ---
  {
    const trial = buildTrial();
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      seed(trial, 0, sfx, 'PERSOZ', persozRaw());
      const rec = seed(trial, 12, sfx, 'PERSOZ', persozRaw());
      const t = traceOf(rec);
      const ok = t?.referenceRule === 'SAME_PANEL_T0' &&
        t?.referenceStageId === stageT0.id &&
        t?.referencePanelId === `${trial.id}-p-${sfx}` &&
        t?.referenceAcquisitionId === `acq-${stageT0.id}-${sfx}-PERSOZ`;
      record(`RT-E${10 + i}`, `PERSOZ/${sfx} → SAME_PANEL_T0`,
        ok, `T0/${sfx} tracé`, JSON.stringify(t));
    });
  }

  // --- RT-E13 : T0 absent → rien d'inventé, mesure intacte ---
  {
    const trial = buildTrial();
    const rec = seed(trial, 12, 'E1', 'ADHESION', adhRaw(2));
    const t = traceOf(rec);
    const computed = rec.computed as { adhesionClass?: unknown; deltaAdhesionClass?: unknown } | null;
    record('RT-E13', 'T0 absent : NONE + mesure intacte (classe 2, Δ null)',
      noneOk(t) && computed?.adhesionClass === 2 && (computed?.deltaAdhesionClass ?? null) === null,
      'NONE, classe=2, Δ=null',
      `${t?.referenceRule}, classe=${String(computed?.adhesionClass)}, Δ=${String(computed?.deltaAdhesionClass)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
