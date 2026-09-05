/**
 * QUV-Lab — Suite de Tests STATISTIQUES COLOR + RESTITUTION ADHÉSION ISO 2409.
 *
 * COLOR : consolidation inter-panneaux des composantes L, a, b (moyenne +
 * écart-type n−1, 3 décimales) complétant ΔE ; référence ΔE = T0 du même
 * panneau ; T exclu.
 * ADHÉSION : ISO 2409 = 6 classes, jamais de moyenne vers classe ; moyennes et
 * deltas = indicateurs numériques complémentaires ; matrice T0/T, C12/E1-E3.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { calculateColor } from '../colorEngine';
import { calculateAdhesion } from '../adhesionEngine';
import { aggregateBatchColor, aggregateBatchAdhesion } from '../aggregations';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet, createCountConfiguration } from '../ruleSet';
import { isAdhesionEligiblePanel, isPersozEligiblePanel, getActiveE1E2E3Panels } from '../panelUtils';
import { exportReportToCsv } from '../../services/reportGenerator';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type {
  ColorRawData,
  ColorComputedData,
  AdhesionRawData,
  AdhesionComputedData,
  ScientificReport
} from '../../types/scientific';

export interface ColorAdhesionStatsTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

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

function mkAdhPanel(panelMean: number | null): AdhesionComputedData {
  return {
    adhesionClass: null,
    individualResults: [],
    panelMean,
    classDescription: 'Moyenne panneau',
    elapsedTimeHours: 216,
    delayCompliance: 'CONFORME',
    gridSpacingUsedMm: 2,
    qualityAssessment: {
      expectedCount: 2, actualCount: 2, validCount: 2, suspectCount: 0,
      invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
    },
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  } as AdhesionComputedData;
}

function colorRaw(L: number, a: number, b: number): ColorRawData {
  return {
    readings: [1, 2, 3, 4].map((i) => ({ pointIndex: i, L, a, b }))
  };
}

export function runColorAdhesionStatisticsTests(): {
  results: ColorAdhesionStatsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ColorAdhesionStatsTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const ruleSet = getDefaultScientificRuleSet();
  const colorConfig = ruleSet.measurementConfigurations.COLOR;

  // --- COLOR-STAT-01 : moyennes intra-panneau L*/a*/b* ---
  {
    const res = calculateColor(
      { readings: [
        { pointIndex: 1, L: 62.5, a: 8.4, b: 24.2 },
        { pointIndex: 2, L: 62.3, a: 8.5, b: 24.1 },
        { pointIndex: 3, L: 62.6, a: 8.3, b: 24.3 },
        { pointIndex: 4, L: 62.4, a: 8.4, b: 24.2 }
      ] },
      colorConfig, ruleSet, {}
    );
    const ok = res.computed.meanL === 62.45 && res.computed.meanA === 8.4 && res.computed.meanB === 24.2;
    record('COLOR-STAT-01', 'Moyennes intra-panneau L*/a*/b* (4 points)',
      ok, 'L=62.45, a=8.4, b=24.2',
      `L=${String(res.computed.meanL)}, a=${String(res.computed.meanA)}, b=${String(res.computed.meanB)}`);
  }

  // --- COLOR-STAT-02 : consolidation inter-panneaux L*/a*/b* ---
  // L [60,63,66] → mean 63, s 3 ; a [2,4,6] → mean 4, s 2 ; b [10,12,14] → mean 12, s 2.
  {
    const agg = aggregateBatchColor('b', 's', [
      mkColor(60, 2, 10, 1), mkColor(63, 4, 12, 2), mkColor(66, 6, 14, 3)
    ]);
    const c = agg.color;
    const ok = c?.meanL === 63 && c?.stdDevL === 3 &&
      c?.meanA === 4 && c?.stdDevA === 2 &&
      c?.meanB === 12 && c?.stdDevB === 2;
    record('COLOR-STAT-02', 'Consolidation L*/a*/b* : moyennes + SD n−1',
      ok === true, 'L 63/3, a 4/2, b 12/2',
      `L ${String(c?.meanL)}/${String(c?.stdDevL)}, a ${String(c?.meanA)}/${String(c?.stdDevA)}, b ${String(c?.meanB)}/${String(c?.stdDevB)}`);
  }

  // --- COLOR-STAT-03 : non-régression ΔE ---
  {
    const agg = aggregateBatchColor('b', 's', [
      mkColor(60, 2, 10, 1.5), mkColor(63, 4, 12, 2.5), mkColor(66, 6, 14, 3.5)
    ]);
    const ok = agg.meanDeltaE === 2.5 && agg.interPanelMean === 2.5;
    record('COLOR-STAT-03', 'Consolidation ΔE inchangée',
      ok, 'meanDeltaE=2.5', `meanDeltaE=${String(agg.meanDeltaE)}`);
  }

  // --- COLOR-STAT-04 : T exclu (chemin strict) ---
  {
    const panels = [
      { id: 't', label: 'T', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' },
      { id: 'e1', label: '1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' },
      { id: 'e2', label: '2', roleCode: 'E2', role: 'EXPOSED_2', status: 'ACTIVE' },
      { id: 'e3', label: '3', roleCode: 'E3', role: 'EXPOSED_3', status: 'ACTIVE' }
    ];
    const strict = getActiveE1E2E3Panels(panels);
    const byId: Record<string, ColorComputedData> = {
      t: mkColor(200, 50, 50, 99), e1: mkColor(60, 2, 10, 1), e2: mkColor(63, 4, 12, 2), e3: mkColor(66, 6, 14, 3)
    };
    const agg = aggregateBatchColor('b', 's', strict.map((p) => byId[p.id]));
    const ok = strict.length === 3 && agg.color?.meanL === 63 && agg.meanDeltaE === 2;
    record('COLOR-STAT-04', 'T exclu des stats COLOR (chemin strict)',
      ok, '3 panneaux, meanL=63, ΔE=2', `${strict.length} panneaux, meanL=${String(agg.color?.meanL)}, ΔE=${String(agg.meanDeltaE)}`);
  }

  // --- COLOR-STAT-05 : ΔE vs T0 du même panneau ---
  {
    const trialId = 'trial-cstat05';
    const stages = generateStandardExposureStages(trialId);
    const batchId = `${trialId}-batch-1`;
    const trial: Trial = {
      id: trialId, schemaVersion: '1.2.0',
      createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z',
      metadata: { reference: 'QUV-CSTAT05', createdBy: 'TEST_OP' },
      status: 'IN_PROGRESS', configurationStatus: 'EDITABLE',
      config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR'], familyConfigs: {} },
      scheduleConfig: {
        cycleDurationHours: 168, maxCycles: 12,
        initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
        intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
      },
      stages,
      batches: [{
        id: batchId, trialId, reference: 'LOT CSTAT05', orderIndex: 1,
        panels: [
          { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const }
        ]
      }],
      acquisitions: {}, auditTrail: [], mediaReferences: []
    };
    const stageT0 = stages.find((s) => s.cycleIndex === 0)!;
    const stageC12 = stages.find((s) => s.cycleIndex === 12)!;
    const seed = (stageId: string, panelId: string, L: number) => {
      const rec: PanelAcquisitionRecord = {
        id: `acq-${stageId}-${panelId}`, trialId, stageId, batchId, panelId, familyId: 'COLOR',
        raw: colorRaw(L, 3, 15), computed: null, status: 'COMPLETE', alerts: [],
        trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
      };
      const { updatedRecord } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
      trial.acquisitions[`${stageId}__${panelId}__COLOR`] = updatedRecord;
    };
    seed(stageT0.id, `${trialId}-p-T`, 50);
    seed(stageT0.id, `${trialId}-p-E1`, 60);
    seed(stageC12.id, `${trialId}-p-E1`, 65);
    const rec = trial.acquisitions[`${stageC12.id}__${trialId}-p-E1__COLOR`];
    const computed = rec.computed as ColorComputedData | null;
    const ok = computed?.deltaE === 5;
    record('COLOR-STAT-05', 'ΔE C12/E1 vs T0 du même panneau (pas du témoin)',
      ok === true, 'ΔE=5 (65−60), pas 15 (65−50)', `ΔE=${String(computed?.deltaE)}`);
  }

  // --- ADH-STAT-01 : moyenne panneau 1.5 ---
  {
    const std2 = createCountConfiguration('ADHESION', 2, ruleSet);
    const res = calculateAdhesion({
      measurements: [
        { measurementIndex: 1, adhesionClass: 1 },
        { measurementIndex: 2, adhesionClass: 2 }
      ],
      gridSpacingMm: 2,
      measurementDateTime: '2026-10-24T00:00:00Z',
      requiredMinimumDelayHours: 168,
      normReference: 'NF EN ISO 2409:2020'
    }, std2, ruleSet, {});
    record('ADH-STAT-01', 'Moyenne panneau 1+2 → 1.5',
      res.computed.panelMean === 1.5, 'panelMean=1.5', `panelMean=${String(res.computed.panelMean)}`);
  }

  // --- ADH-STAT-02 : aucune conversion 1.5 → Classe 2 ---
  {
    const std2 = createCountConfiguration('ADHESION', 2, ruleSet);
    const res = calculateAdhesion({
      measurements: [
        { measurementIndex: 1, adhesionClass: 1 },
        { measurementIndex: 2, adhesionClass: 2 }
      ],
      gridSpacingMm: 2,
      measurementDateTime: '2026-10-24T00:00:00Z',
      requiredMinimumDelayHours: 168,
      normReference: 'NF EN ISO 2409:2020'
    }, std2, ruleSet, {});
    const desc = res.computed.classDescription || '';
    const ok = !desc.includes('Classe 2') && desc.includes('1.5');
    record('ADH-STAT-02', 'Aucune conversion moyenne → classe ISO',
      ok, 'description avec 1.5, sans « Classe 2 »', desc.slice(0, 80));
  }

  // --- ADH-STAT-03 : individuels = entiers 0..5 ---
  {
    const std2 = createCountConfiguration('ADHESION', 2, ruleSet);
    const res = calculateAdhesion({
      measurements: [
        { measurementIndex: 1, adhesionClass: 0 },
        { measurementIndex: 2, adhesionClass: 5 }
      ],
      gridSpacingMm: 2,
      measurementDateTime: '2026-10-24T00:00:00Z',
      requiredMinimumDelayHours: 168,
      normReference: 'NF EN ISO 2409:2020'
    }, std2, ruleSet, {});
    const indiv = res.computed.individualResults || [];
    const ok = indiv.length === 2 && indiv.every((m) =>
      typeof m.adhesionClass === 'number' && Number.isInteger(m.adhesionClass) &&
      m.adhesionClass >= 0 && m.adhesionClass <= 5);
    record('ADH-STAT-03', 'Résultats individuels = classes entières 0..5',
      ok, '[0,5] entiers', JSON.stringify(indiv.map((m) => m.adhesionClass)));
  }

  // --- ADH-STAT-04 : moyenne globale 1.5 ---
  {
    const agg = aggregateBatchAdhesion('b', 's', [mkAdhPanel(1.5), mkAdhPanel(1.0), mkAdhPanel(2.0)]);
    record('ADH-STAT-04', 'Moyenne globale E1-E3 = 1.5 (décimale, pas classe)',
      agg.adhesion?.overallMean === 1.5, 'overallMean=1.5', `overallMean=${String(agg.adhesion?.overallMean)}`);
  }

  // --- ADH-STAT-05 : écart-type complémentaire conservé ---
  {
    const agg = aggregateBatchAdhesion('b', 's', [mkAdhPanel(1.5), mkAdhPanel(1.0), mkAdhPanel(2.0)]);
    record('ADH-STAT-05', 'Écart-type inter-panneaux conservé (statistique complémentaire)',
      agg.adhesion?.standardDeviation === 0.5, 's=0.5 (complémentaire, non normatif)',
      `s=${String(agg.adhesion?.standardDeviation)}`);
  }

  // --- ADH-STAT-06 : delta = indicateur complémentaire (report) ---
  {
    const trialId = 'trial-astat06';
    const stages = generateStandardExposureStages(trialId);
    const batchId = `${trialId}-batch-1`;
    const trial: Trial = {
      id: trialId, schemaVersion: '1.2.0',
      createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z',
      metadata: { reference: 'QUV-ASTAT06', createdBy: 'TEST_OP' },
      status: 'IN_PROGRESS', configurationStatus: 'EDITABLE',
      config: { standardReference: 'NF EN 927-6', activeFamilies: ['ADHESION'], familyConfigs: {} },
      scheduleConfig: {
        cycleDurationHours: 168, maxCycles: 12,
        initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
        intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
      },
      stages,
      batches: [{
        id: batchId, trialId, reference: 'LOT ASTAT06', orderIndex: 1,
        dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
        panels: [
          { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const }
        ]
      }],
      acquisitions: {}, auditTrail: [], mediaReferences: []
    };
    const stageT0 = stages.find((s) => s.cycleIndex === 0)!;
    const stageC12 = stages.find((s) => s.cycleIndex === 12)!;
    const mkRaw = (classes: (number | null)[]): AdhesionRawData => ({
      measurements: classes.map((c, i) => ({ measurementIndex: i + 1, adhesionClass: c })),
      gridSpacingMm: 2,
      coatingThicknessMicrons: 90,
      measurementDateTime: '2026-10-24T00:00:00Z',
      applicationDateTime: '2026-08-01T00:00:00Z',
      requiredMinimumDelayHours: 168,
      normReference: 'NF EN ISO 2409:2020'
    });
    const seedC = (stageId: string, panelId: string, raw: AdhesionRawData) => {
      const rec: PanelAcquisitionRecord = {
        id: `acq-${stageId}-${panelId}`, trialId, stageId, batchId, panelId, familyId: 'ADHESION',
        raw, computed: null, status: 'COMPLETE', alerts: [],
        trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
      };
      const { updatedRecord } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
      trial.acquisitions[`${stageId}__${panelId}__ADHESION`] = updatedRecord;
    };
    seedC(stageT0.id, `${trialId}-p-T`, mkRaw([0, 0]));
    seedC(stageC12.id, `${trialId}-p-E1`, mkRaw([1, 2]));
    const report = {
      id: 'rep-astat06',
      metadata: {
        reportId: 'rep-astat06', trialId, generatedAt: '2026-09-05T00:00:00Z', generatedBy: 'TEST_OP',
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
    const csv = exportReportToCsv(trial, report, getDefaultScientificRuleSet());
    const adhLine = csv.split('\n').find((l) => l.includes(';ADHESION;') && l.includes('M1=1, M2=2'));
    const ok = typeof adhLine === 'string' && adhLine.includes('Δmoy.(compl.)=') && !adhLine.includes('Classe 2');
    record('ADH-STAT-06', 'Δ reporté comme complémentaire, jamais comme classe ISO',
      ok === true, "préfixe 'Δmoy.(compl.)=', sans 'Classe 2'", (adhLine || 'ligne absente').slice(0, 160));
  }

  // --- ADH-STAT-07 : matrice d'éligibilité ---
  {
    const t0 = { cycleIndex: 0 };
    const c6 = { cycleIndex: 6 };
    const c12 = { cycleIndex: 12 };
    const T = { label: 'T', roleCode: 'T', role: 'WITNESS' };
    const E1 = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
    const E2 = { label: '2', roleCode: 'E2', role: 'EXPOSED_2' };
    const E3 = { label: '3', roleCode: 'E3', role: 'EXPOSED_3' };
    const ok =
      isAdhesionEligiblePanel(T, t0) &&
      ![E1, E2, E3].some((p) => isAdhesionEligiblePanel(p, t0)) &&
      ![T, E1, E2, E3].some((p) => isAdhesionEligiblePanel(p, c6)) &&
      [E1, E2, E3].every((p) => isAdhesionEligiblePanel(p, c12)) &&
      !isAdhesionEligiblePanel(T, c12);
    record('ADH-STAT-07', "Matrice T0/T, C1-C11/aucun, C12/E1-E3",
      ok, 'matrice conforme', String(ok));
  }

  // --- ADH-STAT-08 : PERSOZ strict inchangé ---
  {
    const ok =
      isPersozEligiblePanel({ roleCode: 'E1', role: 'EXPOSED_1' }) &&
      isPersozEligiblePanel({ roleCode: 'E2', role: 'EXPOSED_2' }) &&
      isPersozEligiblePanel({ roleCode: 'E3', role: 'EXPOSED_3' }) &&
      !isPersozEligiblePanel({ roleCode: 'T', role: 'WITNESS' });
    record('ADH-STAT-08', 'PERSOZ = E1/E2/E3, T interdit (inchangé)',
      ok, 'E1-E3 oui, T non', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
