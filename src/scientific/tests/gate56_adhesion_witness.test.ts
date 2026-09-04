/**
 * QUV-Lab — Suite de Tests GATE 5.6 : RÉFÉRENCE T0 ADHÉSION = TÉMOIN T
 *
 * Règle : ADHESION C12 d'une éprouvette exposée (E1/E2/E3) se compare à
 * ADHESION T0 du panneau TÉMOIN (T), jamais au T0 du même panneau exposé.
 * - G56-WIT-01 : cas nominal E1=3 vs T=1 → initial=1, delta=+2.
 * - G56-WIT-02/03/04 : E1=2→+1, E2=3→+2, E3=4→+3, même référence T0 témoin.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { AdhesionComputedData, AdhesionRawData } from '../../types/scientific';
import { getDefaultScientificRuleSet } from '../ruleSet';
import { recalculateAcquisition } from '../recalculator';

export interface Gate56TestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function buildWitnessTrial(): Trial {
  const trialId = 'trial-g56-witness';
  const stages = generateStandardExposureStages(trialId);
  const stageT0 = stages.find((s) => s.cycleIndex === 0)!;
  const stageC12 = stages.find((s) => s.cycleIndex === 12)!;

  const panels = [
    { id: `${trialId}-p-T`, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const },
    { id: `${trialId}-p-E1`, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const },
    { id: `${trialId}-p-E2`, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const },
    { id: `${trialId}-p-E3`, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const }
  ];

  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    metadata: {
      reference: 'QUV-G56-WIT',
      createdBy: 'TEST_OP'
    },
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
        reference: 'LOT G56',
        orderIndex: 1,
        panels: panels.map((p, i) => ({
          id: p.id,
          batchId,
          index: i + 1,
          label: p.label,
          role: p.role,
          roleCode: p.roleCode,
          status: 'ACTIVE' as const
        }))
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  };

  const seedAdhesion = (
    stageId: string,
    panelId: string,
    adhesionClass: number
  ): void => {
    const raw: AdhesionRawData = {
      adhesionClass,
      gridSpacingMm: 2,
      measurementDateTime: '2026-09-04T00:00:00Z',
      requiredMinimumDelayHours: 168,
      normReference: 'NF EN ISO 2409:2020'
    };
    const record: PanelAcquisitionRecord = {
      id: `acq-${stageId}-${panelId}`,
      trialId,
      stageId,
      batchId,
      panelId,
      familyId: 'ADHESION',
      raw,
      computed: null,
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-04T00:00:00Z', source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
    trial.acquisitions[`${stageId}__${panelId}__ADHESION`] = record;
  };

  // T0/Témoin = classe 1 ; C12 exposées = classes 2/3/4.
  seedAdhesion(stageT0.id, `${trialId}-p-T`, 1);
  seedAdhesion(stageC12.id, `${trialId}-p-E1`, 2);
  seedAdhesion(stageC12.id, `${trialId}-p-E2`, 3);
  seedAdhesion(stageC12.id, `${trialId}-p-E3`, 4);

  return trial;
}

export function runGate56AdhesionWitnessTests(): {
  results: Gate56TestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Gate56TestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const ruleSet = getDefaultScientificRuleSet();
  const trial = buildWitnessTrial();
  const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;

  const checkExposed = (
    id: string,
    panelSuffix: string,
    expectedClass: number,
    expectedDelta: number
  ): void => {
    const key = `${stageC12.id}__trial-g56-witness-p-${panelSuffix}__ADHESION`;
    const rec = trial.acquisitions[key];
    const { updatedRecord, rawUnchanged } = recalculateAcquisition(rec, trial, ruleSet);
    const computed = updatedRecord.computed as AdhesionComputedData | null;
    const passed =
      rawUnchanged === true &&
      computed?.adhesionClass === expectedClass &&
      computed?.initialAdhesionClass === 1 &&
      computed?.deltaAdhesionClass === expectedDelta;
    record(
      id,
      `C12/${panelSuffix} vs T0/Témoin (classe ${expectedClass}, delta +${expectedDelta})`,
      passed,
      `initial=1, class=${expectedClass}, delta=+${expectedDelta}, rawUnchanged=true`,
      `initial=${String(computed?.initialAdhesionClass)}, class=${String(computed?.adhesionClass)}, delta=${String(computed?.deltaAdhesionClass)}, rawUnchanged=${String(rawUnchanged)}`
    );
  };

  checkExposed('G56-WIT-01', 'E1', 2, 1);
  checkExposed('G56-WIT-02', 'E2', 3, 2);
  checkExposed('G56-WIT-03', 'E3', 4, 3);

  // Garde : la référence utilisée est bien le T0 du témoin (présence effective de l'enregistrement T0/T).
  const witnessKey = `${trial.stages.find((s) => s.cycleIndex === 0)!.id}__trial-g56-witness-p-T__ADHESION`;
  const witnessPresent = Boolean(trial.acquisitions[witnessKey]?.raw);
  record(
    'G56-WIT-04',
    'Référence T0/Témoin présente et utilisée',
    witnessPresent,
    'T0/T ADHESION présent',
    witnessPresent ? 'T0/T ADHESION présent' : 'T0/T ADHESION manquant'
  );

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
