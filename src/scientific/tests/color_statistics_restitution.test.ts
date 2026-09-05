/**
 * QUV-Lab — Suite de Tests RESTITUTION COLOR L, a, b (PR #67bis).
 *
 * Les six statistiques (moyennes + SD n−1) calculées par aggregateBatchColor
 * sont effectivement consommées : tableau de synthèse du lot, section rapport
 * CSV dédiée. Population E1/E2/E3 stricte, T exclu, ΔE inchangé, rien fabriqué.
 */

import { generateStandardExposureStages, globalTrialStore } from '../../services/trialStore';
import { aggregateBatchColor } from '../aggregations';
import { getActiveE1E2E3Panels, isPersozEligiblePanel, isAdhesionEligiblePanel } from '../panelUtils';
import { exportReportToCsv } from '../../services/reportGenerator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';
import type { ColorComputedData, ScientificReport } from '../../types/scientific';

export interface ColorRestitutionTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function mkColor(meanL: number | null, meanA: number | null, meanB: number | null, deltaE: number | null): ColorComputedData {
  return {
    pointsCount: 4,
    validCount: 4,
    meanL, meanA, meanB,
    stdDevL: 0.1, stdDevA: 0.1, stdDevB: 0.1,
    chromaC: null, hueH: null,
    deltaL: null, deltaA: null, deltaB: null, deltaE,
    qualityAssessment: {
      expectedCount: 4, actualCount: 4, validCount: 4, suspectCount: 0,
      invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
    },
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  } as ColorComputedData;
}

function colorRaw(L: number, a: number, b: number) {
  return {
    readings: [1, 2, 3, 4].map((i) => ({ pointIndex: i, L, a, b }))
  };
}

function minimalReport(trialId: string): ScientificReport {
  return {
    id: 'rep-crest',
    metadata: {
      reportId: 'rep-crest', trialId, generatedAt: '2026-09-05T00:00:00Z', generatedBy: 'TEST_OP',
      reportVersion: '1.0', schemaVersion: '1.2.0', calculationVersion: 'test', scientificRuleSetId: 'rs'
    },
    status: 'GENERATED', title: 'T', executiveSummary: 'S', normativeReference: 'NF EN 927-6',
    protocolStatus: 'STANDARD', isComplete: true, missingCriticalElements: [],
    sections: {
      identification: 'a', studyPurpose: 'a', normativeReferences: 'a', materialsAndBatches: 'a',
      panelsDefinition: 'a', experimentalConditions: 'a', exposureSchedule: 'a', measurementPlan: 'a',
      colorResults: 'a', glossResults: 'a', persozResults: 'a', visualObservations: 'a',
      kineticsAnalysis: 'a', qualityControl: 'a', deviationsAndAdaptations: 'a',
      calculationTraceability: 'a', scientificSynthesis: 'a', factualConclusion: 'Conclusion.'
    },
    annexes: {
      annexA_RawDataSummary: 'A', annexB_ComputedResultsSummary: 'B', annexC_QualityAssessmentSummary: 'C',
      annexD_ProtocolAdaptationsSummary: 'D', annexE_AuditTrailSummary: 'E', annexF_ScientificVersionSummary: 'F'
    },
    reviewComments: []
  } as ScientificReport;
}

function buildColorTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-crest-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId, schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-CREST-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS', configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT CREST-${trialSeq}`, orderIndex: 1,
      panels: [
        { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  };
  globalTrialStore.saveTrial(trial);
  return trial;
}

function recordColor(trial: Trial, cycleIndex: number, suffix: string, L: number, a: number, b: number): void {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  globalTrialStore.recordAcquisition({
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${suffix}`, familyId: 'COLOR', raw: colorRaw(L, a, b), operatorId: 'TEST_OP'
  });
}

function exportSectionRow(trial: Trial, cycleIndex: number): string | undefined {
  const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  // Ligne de la section inter-panneaux (pas les lignes par-panneau ';COLOR;').
  return csv.split('\n').find((l) =>
    l.startsWith(`"${stage.name}"`) && l.includes(';"LOT CREST') && !l.includes(';COLOR;'));
}

export function runColorRestitutionTests(): {
  results: ColorRestitutionTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ColorRestitutionTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- COLOR-REST-01 : six valeurs consommées par la restitution ---
  {
    const trial = buildColorTrial();
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      // T0 aligné en a/b sur C12 : ΔE = |ΔL| pur (5/7/9 → moyenne 7.00, SD 2.000).
      recordColor(trial, 0, sfx, 55 + i, [2, 4, 6][i], [10, 12, 14][i]);
      recordColor(trial, 12, sfx, [60, 63, 66][i], [2, 4, 6][i], [10, 12, 14][i]);
    });
    const row = exportSectionRow(trial, 12);
    const ok = typeof row === 'string' &&
      row.includes(';63.000;3.000;4.000;2.000;12.000;2.000;');
    record('COLOR-REST-01', 'Six statistiques consommées par la restitution (section rapport)',
      ok === true, 'ligne avec 63.000;3.000;4.000;2.000;12.000;2.000',
      (row || 'ligne absente').slice(0, 200));
  }

  // --- COLOR-REST-02 : valeurs exactes E1(60,2,10) E2(63,4,12) E3(66,6,14) ---
  {
    const agg = aggregateBatchColor('b', 's', [
      mkColor(60, 2, 10, 1), mkColor(63, 4, 12, 2), mkColor(66, 6, 14, 3)
    ]);
    const c = agg.color;
    const ok = c?.meanL === 63 && c?.stdDevL === 3 &&
      c?.meanA === 4 && c?.stdDevA === 2 &&
      c?.meanB === 12 && c?.stdDevB === 2;
    record('COLOR-REST-02', 'Valeurs exactes L=63/3, a=4/2, b=12/2',
      ok === true, 'L 63/3, a 4/2, b 12/2',
      `L ${String(c?.meanL)}/${String(c?.stdDevL)}, a ${String(c?.meanA)}/${String(c?.stdDevA)}, b ${String(c?.meanB)}/${String(c?.stdDevB)}`);
  }

  // --- COLOR-REST-03 : T extrême sans effet ---
  {
    const panels = [
      { id: 't', label: 'T', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' },
      { id: 'e1', label: '1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' },
      { id: 'e2', label: '2', roleCode: 'E2', role: 'EXPOSED_2', status: 'ACTIVE' },
      { id: 'e3', label: '3', roleCode: 'E3', role: 'EXPOSED_3', status: 'ACTIVE' }
    ];
    const strict = getActiveE1E2E3Panels(panels);
    const byId: Record<string, ColorComputedData> = {
      t: mkColor(200, 50, 50, 99),
      e1: mkColor(60, 2, 10, 1), e2: mkColor(63, 4, 12, 2), e3: mkColor(66, 6, 14, 3)
    };
    const agg = aggregateBatchColor('b', 's', strict.map((p) => byId[p.id]));
    const ok = agg.color?.meanL === 63 && agg.meanDeltaE === 2;
    record('COLOR-REST-03', 'T extrême (200/50/50) sans effet sur E1-E3',
      ok, 'meanL=63, ΔE=2', `meanL=${String(agg.color?.meanL)}, ΔE=${String(agg.meanDeltaE)}`);
  }

  // --- COLOR-REST-04 : ΔE présent et inchangé ---
  {
    const trial = buildColorTrial();
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      recordColor(trial, 0, sfx, 55 + i, [2, 4, 6][i], [10, 12, 14][i]);
      recordColor(trial, 12, sfx, [60, 63, 66][i], [2, 4, 6][i], [10, 12, 14][i]);
    });
    const row = exportSectionRow(trial, 12);
    // ΔE par panneau : E1 |60−55|=5, E2 |63−56|=7, E3 |66−57|=9 → moyenne 7.00, SD 2.00 (format ΔE existant).
    const ok = typeof row === 'string' && row.includes(';7.00;2.00');
    record('COLOR-REST-04', 'ΔE présent et inchangé dans la section',
      ok === true, 'DeltaE_moy=7.00, SD=2.00', (row || 'ligne absente').slice(-60));
  }

  // --- COLOR-REST-05 : six valeurs dans les exports ---
  {
    const trial = buildColorTrial();
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      recordColor(trial, 0, sfx, 55 + i, [2, 4, 6][i], [10, 12, 14][i]);
      recordColor(trial, 12, sfx, [60, 63, 66][i], [2, 4, 6][i], [10, 12, 14][i]);
    });
    const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
    const headerOk = csv.includes('COLOR_L_moy;COLOR_L_SD;COLOR_a_moy;COLOR_a_SD;COLOR_b_moy;COLOR_b_SD');
    const row = exportSectionRow(trial, 12);
    const cells = (row || '').split(';');
    // 11 colonnes : Étape, Heures, Lot, L, sL, a, sa, b, sb, ΔE, sΔE.
    const ok = headerOk && cells.length === 11 && cells.slice(3, 9).every((c) => c !== '');
    record('COLOR-REST-05', 'Exports : six valeurs présentes, ΔE conservé',
      ok, 'header + 6 cellules non vides', `header=${String(headerOk)}, cols=${cells.length}`);
  }

  // --- COLOR-REST-06 : rien fabriqué sans données ---
  {
    const trial = buildColorTrial();
    const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
    const agg = aggregateBatchColor('b', 's', []);
    const ok = agg.color?.meanL === null && agg.color?.stdDevL === null &&
      !csv.includes('NaN') && csv.includes('COLOR_L_moy');
    record('COLOR-REST-06', 'Sans données : nulls, section présente, rien fabriqué',
      ok === true, 'nulls + pas de NaN', `meanL=${String(agg.color?.meanL)}, NaN=${String(csv.includes('NaN'))}`);
  }

  // --- COLOR-REST-07 : non-régression PERSOZ ---
  {
    const ok =
      isPersozEligiblePanel({ roleCode: 'E1', role: 'EXPOSED_1' }) &&
      isPersozEligiblePanel({ roleCode: 'E2', role: 'EXPOSED_2' }) &&
      isPersozEligiblePanel({ roleCode: 'E3', role: 'EXPOSED_3' }) &&
      !isPersozEligiblePanel({ roleCode: 'T', role: 'WITNESS' });
    record('COLOR-REST-07', 'PERSOZ : E1-E3 éligibles, T interdit (inchangé)',
      ok, 'E1-E3 oui, T non', String(ok));
  }

  // --- COLOR-REST-08 : non-régression ADHÉSION ---
  {
    const t0 = { cycleIndex: 0 };
    const c6 = { cycleIndex: 6 };
    const c12 = { cycleIndex: 12 };
    const T = { label: 'T', roleCode: 'T', role: 'WITNESS' };
    const E1 = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
    const ok =
      isAdhesionEligiblePanel(T, t0) &&
      !isAdhesionEligiblePanel(E1, t0) &&
      !isAdhesionEligiblePanel(T, c6) &&
      !isAdhesionEligiblePanel(E1, c6) &&
      isAdhesionEligiblePanel(E1, c12) &&
      !isAdhesionEligiblePanel(T, c12);
    record('COLOR-REST-08', 'ADHÉSION : T0/T, C1-C11 rien, C12/E1 (inchangé)',
      ok, 'matrice conforme', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
