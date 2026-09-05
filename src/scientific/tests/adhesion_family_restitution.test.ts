/**
 * QUV-Lab — Suite de Tests RESTITUTION ADHÉSION T0/T (régression PR #66).
 *
 * La restitution Family/Batch utilise la population dépendante du jalon
 * (isAdhesionEligiblePanel : T0→T, C12→E1-E3), jamais la population exposée
 * générique qui faisait disparaître T0/T. Valeur restituée : panelMean puis
 * repli scalaire legacy, moyennée à 1 décimale comme la vue Family.
 */

import { generateStandardExposureStages, globalTrialStore, IntegrityViolationError } from '../../services/trialStore';
import { isAdhesionEligiblePanel, getActiveE1E2E3Panels } from '../panelUtils';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { AdhesionRawData, AdhesionComputedData } from '../../types/scientific';

export interface AdhesionFamilyRestitutionTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-fam-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-FAM-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['ADHESION', 'PERSOZ', 'COLOR', 'GLOSS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [
      {
        id: batchId, trialId, reference: `LOT FAM-${trialSeq}`, orderIndex: 1,
        dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
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

function seedAdh(trial: Trial, cycleIndex: number, panelSuffix: string, adhesionClass: number): void {
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
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId: 'ADHESION',
    raw, computed: null, status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  const ruleSet = getDefaultScientificRuleSet();
  const { updatedRecord } = recalculateAcquisition(record, trial, ruleSet);
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__ADHESION`] = updatedRecord;
}

/**
 * Réplique le chemin de restitution Family : population éligible au jalon,
 * valeur panelMean puis scalaire, moyenne à 1 décimale, absent si vide.
 */
function restitutionPoint(trial: Trial, cycleIndex: number): number | undefined {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const batch = trial.batches[0];
  const values: number[] = [];
  batch.panels
    .filter((p) => p.status === 'ACTIVE' && isAdhesionEligiblePanel(p, stage))
    .forEach((p) => {
      const acq = trial.acquisitions[`${stage.id}__${p.id}__ADHESION`];
      if (acq?.computed) {
        const comp = acq.computed as AdhesionComputedData;
        const v = comp.panelMean ?? comp.adhesionClass;
        if (typeof v === 'number') values.push(v);
      }
    });
  if (values.length === 0) return undefined;
  return +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

export function runAdhesionFamilyRestitutionTests(): {
  results: AdhesionFamilyRestitutionTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionFamilyRestitutionTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- FAM-01 : T0/T restitué ---
  {
    const trial = buildTrial();
    seedAdh(trial, 0, 'T', 1);
    const point = restitutionPoint(trial, 0);
    record('FAM-01', 'ADHÉSION T0/T restituée', point === 1, 'point=1', `point=${String(point)}`);
  }

  // --- FAM-02 : T0/E1-E3 interdits ignorés ---
  {
    const trial = buildTrial();
    seedAdh(trial, 0, 'T', 1);
    seedAdh(trial, 0, 'E1', 5);
    seedAdh(trial, 0, 'E2', 5);
    seedAdh(trial, 0, 'E3', 5);
    const point = restitutionPoint(trial, 0);
    record('FAM-02', 'ADHÉSION T0/E1-E3 ignorées (T seul fait foi)', point === 1, 'point=1', `point=${String(point)}`);
  }

  // --- FAM-03 : C1-C11 non applicables ---
  {
    const trial = buildTrial();
    seedAdh(trial, 6, 'E1', 3);
    const c1 = restitutionPoint(trial, 1);
    const c6 = restitutionPoint(trial, 6);
    const c11 = restitutionPoint(trial, 11);
    const ok = c1 === undefined && c6 === undefined && c11 === undefined;
    record('FAM-03', 'ADHÉSION C1/C6/C11 non applicables (même avec donnée interdite)',
      ok, 'aucun point', `C1=${String(c1)}, C6=${String(c6)}, C11=${String(c11)}`);
  }

  // --- FAM-04 : C12 E1-E3 utilisés ---
  {
    const trial = buildTrial();
    seedAdh(trial, 0, 'T', 0);
    seedAdh(trial, 12, 'E1', 2);
    seedAdh(trial, 12, 'E2', 4);
    seedAdh(trial, 12, 'E3', 3);
    const point = restitutionPoint(trial, 12);
    record('FAM-04', 'ADHÉSION C12/E1-E3 restituée (moyenne 3)', point === 3, 'point=3', `point=${String(point)}`);
  }

  // --- FAM-05 : C12/T exclu ---
  {
    const trial = buildTrial();
    seedAdh(trial, 0, 'T', 0);
    seedAdh(trial, 12, 'E1', 2);
    seedAdh(trial, 12, 'E2', 2);
    seedAdh(trial, 12, 'E3', 2);
    seedAdh(trial, 12, 'T', 5);
    const point = restitutionPoint(trial, 12);
    record('FAM-05', 'ADHÉSION C12/T exclue (moyenne E inchangée)', point === 2, 'point=2', `point=${String(point)}`);
  }

  // --- FAM-06 : PERSOZ non-régression (store) ---
  {
    const trial = buildTrial();
    globalTrialStore.saveTrial(trial);
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const persozRaw = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: 85 },
        { pointIndex: 2, dampingTimeSeconds: 85 },
        { pointIndex: 3, dampingTimeSeconds: 85 }
      ],
      unit: 'SECONDS'
    };
    let rejected = false;
    try {
      globalTrialStore.recordAcquisition({
        trialId: trial.id, stageId: stageT0.id, batchId: trial.batches[0].id,
        panelId: `${trial.id}-p-T`, familyId: 'PERSOZ', raw: persozRaw, operatorId: 'TEST_OP'
      });
    } catch (err) {
      rejected = err instanceof IntegrityViolationError;
    }
    record('FAM-06', 'PERSOZ/T toujours rejeté (non-régression)', rejected,
      'IntegrityViolationError', rejected ? 'rejeté' : 'ACCEPTÉ (régression)');
  }

  // --- FAM-07 : COLOR/GLOSS E1-E3 uniquement ---
  {
    const panels = [
      { id: 't', label: 'T', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' },
      { id: 'e1', label: '1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' },
      { id: 'e2', label: '2', roleCode: 'E2', role: 'EXPOSED_2', status: 'ACTIVE' },
      { id: 'e3', label: '3', roleCode: 'E3', role: 'EXPOSED_3', status: 'ACTIVE' },
      { id: 'x', label: 'X', roleCode: 'E', role: 'EXPOSED_CUSTOM', status: 'ACTIVE' }
    ];
    const ids = getActiveE1E2E3Panels(panels).map((p) => p.id);
    const ok = JSON.stringify(ids) === JSON.stringify(['e1', 'e2', 'e3']);
    record('FAM-07', 'COLOR/GLOSS : population E1-E3 uniquement (custom exclu)',
      ok, '[e1,e2,e3]', JSON.stringify(ids));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
