/**
 * QUV-Lab — Suite de Tests GATE 57 : ADHÉSION 2 MESURES / PANNEAU
 *
 * Standard : 2 mesures indépendantes par panneau (GOOD en 2/2).
 * Adaptation justifiée : 1 mesure (WARNING + MEASUREMENT_MISSING en 1/2).
 * Legacy : RAW scalaire historique = 1/1, comportement conservé, jamais migré,
 * jamais rétrogradé par le référentiel live (D4).
 * Référence : T0 du panneau TÉMOIN du même lot (Gate 5.6), appariée par index
 * de mesure (C12 mN ↔ T0 témoin mN), sans mesure inventée.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type {
  AdhesionComputedData,
  AdhesionRawData,
  ScientificReport
} from '../../types/scientific';
import { getDefaultScientificRuleSet, createCountConfiguration } from '../ruleSet';
import { recalculateAcquisition } from '../recalculator';
import {
  calculateAdhesion,
  normalizeAdhesionMeasurements,
  resolveAdhesionCountConfig,
  ADHESION_CALCULATION_VERSION
} from '../adhesionEngine';
import { aggregateBatchAdhesion } from '../aggregations';
import { exportRawDataToCsv, exportReportToCsv } from '../../services/reportGenerator';

export interface Gate57TestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const TRIAL_ID = 'trial-g57-two-measures';

function baseRaw(overrides: Partial<AdhesionRawData> = {}): AdhesionRawData {
  return {
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020',
    ...overrides
  };
}

function twoMeasuresRaw(classes: [number | null, number | null], obs?: [string?, string?]): AdhesionRawData {
  return baseRaw({
    measurements: [
      { measurementIndex: 1, adhesionClass: classes[0], ...(obs?.[0] ? { observation: obs[0] } : {}) },
      { measurementIndex: 2, adhesionClass: classes[1], ...(obs?.[1] ? { observation: obs[1] } : {}) }
    ]
  });
}

function buildAdhesionTrial(opts: {
  t0TClasses: [number | null, number | null] | null;
  t0E1Class: number | null;
  c12EClasses: [number | null, number | null];
  withCountConfig: boolean;
}): Trial {
  const stages = generateStandardExposureStages(TRIAL_ID);
  const stageT0 = stages.find((s) => s.cycleIndex === 0)!;
  const stageC12 = stages.find((s) => s.cycleIndex === 12)!;
  const batchId = `${TRIAL_ID}-batch-1`;
  const ruleSet = getDefaultScientificRuleSet();
  const trial: Trial = {
    id: TRIAL_ID,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: 'QUV-G57', createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['ADHESION'],
      familyConfigs: opts.withCountConfig
        ? {
            ADHESION: {
              familyId: 'ADHESION',
              enabled: true,
              countConfig: createCountConfiguration('ADHESION', 2, ruleSet)
            }
          }
        : {}
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
        trialId: TRIAL_ID,
        reference: 'LOT G57',
        orderIndex: 1,
        dryFilmThicknessMicrons: 90,
        applicationDate: '2026-08-01T00:00:00Z',
        panels: [
          { id: `${TRIAL_ID}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${TRIAL_ID}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
          { id: `${TRIAL_ID}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
          { id: `${TRIAL_ID}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
        ]
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  };

  const seed = (stageId: string, panelId: string, raw: AdhesionRawData): void => {
    const record: PanelAcquisitionRecord = {
      id: `acq-${stageId}-${panelId}`,
      trialId: TRIAL_ID,
      stageId,
      batchId,
      panelId,
      familyId: 'ADHESION',
      raw,
      computed: null,
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
    trial.acquisitions[`${stageId}__${panelId}__ADHESION`] = record;
  };

  if (opts.t0TClasses) seed(stageT0.id, `${TRIAL_ID}-p-T`, twoMeasuresRaw(opts.t0TClasses));
  if (opts.t0E1Class !== null) {
    seed(stageT0.id, `${TRIAL_ID}-p-E1`, baseRaw({ adhesionClass: opts.t0E1Class }));
  }
  seed(stageC12.id, `${TRIAL_ID}-p-E1`, twoMeasuresRaw(opts.c12EClasses));
  return trial;
}

function recalcAdh(trial: Trial, stageCycle: number, panelSuffix: string): { computed: AdhesionComputedData | null; rawUnchanged: boolean; alerts: { code: string; severity: string }[] } {
  const ruleSet = getDefaultScientificRuleSet();
  const stage = trial.stages.find((s) => s.cycleIndex === stageCycle)!;
  const rec = trial.acquisitions[`${stage.id}__${TRIAL_ID}-p-${panelSuffix}__ADHESION`];
  const { updatedRecord, rawUnchanged } = recalculateAcquisition(rec, trial, ruleSet);
  return {
    computed: updatedRecord.computed as AdhesionComputedData | null,
    rawUnchanged,
    alerts: (updatedRecord.alerts || []).map((a) => ({ code: String(a.code), severity: String(a.severity) }))
  };
}

function minimalReport(): ScientificReport {
  return {
    id: 'rep-g57',
    metadata: {
      reportId: 'rep-g57',
      trialId: TRIAL_ID,
      generatedAt: '2026-09-05T00:00:00Z',
      generatedBy: 'TEST_OP',
      reportVersion: '1.0',
      schemaVersion: '1.2.0',
      calculationVersion: ADHESION_CALCULATION_VERSION,
      scientificRuleSetId: 'ruleset-test'
    },
    status: 'GENERATED',
    title: 'Rapport Gate 57',
    executiveSummary: 'Synthèse',
    normativeReference: 'NF EN 927-6',
    protocolStatus: 'STANDARD',
    isComplete: true,
    missingCriticalElements: [],
    sections: {
      identification: 'id',
      studyPurpose: 'but',
      normativeReferences: 'normes',
      materialsAndBatches: 'lots',
      panelsDefinition: 'panneaux',
      experimentalConditions: 'conditions',
      exposureSchedule: 'calendrier',
      measurementPlan: 'plan',
      colorResults: 'couleur',
      glossResults: 'brillance',
      persozResults: 'persoz',
      adhesionResults: 'adhérence',
      visualObservations: 'observations',
      kineticsAnalysis: 'cinétique',
      qualityControl: 'qualité',
      deviationsAndAdaptations: 'écarts',
      calculationTraceability: 'traçabilité',
      scientificSynthesis: 'synthèse',
      factualConclusion: 'Conclusion factuelle Gate 57.'
    },
    annexes: {
      annexA_RawDataSummary: 'A',
      annexB_ComputedResultsSummary: 'B',
      annexC_QualityAssessmentSummary: 'C',
      annexD_ProtocolAdaptationsSummary: 'D',
      annexE_AuditTrailSummary: 'E',
      annexF_ScientificVersionSummary: 'F'
    },
    reviewComments: []
  };
}

export function runGate57AdhesionTwoMeasurementsTests(): {
  results: Gate57TestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Gate57TestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const ruleSet = getDefaultScientificRuleSet();
  const std2 = createCountConfiguration('ADHESION', 2, ruleSet);

  // --- RAW ---
  {
    const raw = twoMeasuresRaw([2, 4], ['Éclats M1', 'Éclats M2']);
    const norm = normalizeAdhesionMeasurements(raw);
    record(
      'G57-RAW-01',
      '2 mesures indépendantes conservées (classe + observation chacune)',
      norm.length === 2 &&
        norm[0].adhesionClass === 2 && norm[0].observation === 'Éclats M1' &&
        norm[1].adhesionClass === 4 && norm[1].observation === 'Éclats M2',
      '2 mesures (2/Éclats M1, 4/Éclats M2)',
      `${norm.length} mesures (${norm.map((m) => `${m.adhesionClass}/${m.observation || ''}`).join(', ')})`
    );
  }
  {
    const raw = twoMeasuresRaw([1, 3]);
    Object.freeze(raw);
    (raw.measurements || []).forEach((m) => Object.freeze(m));
    const before = JSON.stringify(raw);
    let threw = false;
    try {
      calculateAdhesion(raw, std2, ruleSet, {});
    } catch {
      threw = true;
    }
    record(
      'G57-RAW-02',
      'RAW gelé : le moteur ne mute jamais le RAW (aucune écriture)',
      !threw && JSON.stringify(raw) === before,
      'Aucune exception, RAW identique',
      threw ? 'Exception levée (mutation tentée)' : (JSON.stringify(raw) === before ? 'RAW identique' : 'RAW modifié')
    );
  }
  {
    const raw = baseRaw({ adhesionClass: 1, observation: 'Legacy' });
    calculateAdhesion(raw, std2, ruleSet, {});
    record(
      'G57-RAW-03',
      'Ancien scalaire jamais converti en tableau par le calcul',
      !Array.isArray((raw as AdhesionRawData).measurements) && raw.adhesionClass === 1,
      'Pas de clé measurements, scalaire intact',
      `measurements=${String((raw as AdhesionRawData).measurements)}, adhesionClass=${String(raw.adhesionClass)}`
    );
  }

  // --- CALCUL ---
  {
    const res = calculateAdhesion(twoMeasuresRaw([2, 4]), std2, ruleSet, {});
    const indiv = res.computed.individualResults || [];
    record(
      'G57-CALC-04',
      'Deux résultats individuels avec index préservés',
      indiv.length === 2 &&
        indiv[0].measurementIndex === 1 && indiv[0].adhesionClass === 2 &&
        indiv[1].measurementIndex === 2 && indiv[1].adhesionClass === 4,
      '[(1,2),(2,4)]',
      JSON.stringify(indiv.map((m) => [m.measurementIndex, m.adhesionClass]))
    );
  }
  {
    const res = calculateAdhesion(twoMeasuresRaw([2, 4]), std2, ruleSet, {});
    record(
      'G57-CALC-05',
      'panelMean = moyenne des mesures valides',
      res.computed.panelMean === 3,
      'panelMean=3',
      `panelMean=${String(res.computed.panelMean)}`
    );
  }
  {
    const res = calculateAdhesion(twoMeasuresRaw([1, 2]), std2, ruleSet, {});
    record(
      'G57-CALC-06',
      'Moyenne arrondie à 1 décimale',
      res.computed.panelMean === 1.5,
      'panelMean=1.5',
      `panelMean=${String(res.computed.panelMean)}`
    );
  }
  {
    const res = calculateAdhesion(twoMeasuresRaw([2, 4]), std2, ruleSet, {});
    record(
      'G57-CALC-07',
      'adhesionClass null en modèle multi-mesures (la moyenne fait foi)',
      res.computed.adhesionClass === null && res.computed.panelMean === 3,
      'adhesionClass=null, panelMean=3',
      `adhesionClass=${String(res.computed.adhesionClass)}, panelMean=${String(res.computed.panelMean)}`
    );
  }

  // --- T0 TÉMOIN ---
  {
    const t0 = twoMeasuresRaw([1, 1]);
    const c12 = twoMeasuresRaw([2, 4]);
    const res = calculateAdhesion(c12, std2, ruleSet, { referenceRaw: t0 });
    record(
      'G57-T0-08',
      'T0 témoin 2 mesures → initialPanelMean',
      res.computed.initialPanelMean === 1,
      'initialPanelMean=1',
      `initialPanelMean=${String(res.computed.initialPanelMean)}`
    );
  }
  {
    const t0 = twoMeasuresRaw([1, 2]);
    const c12 = twoMeasuresRaw([3, 5]);
    const res = calculateAdhesion(c12, std2, ruleSet, { referenceRaw: t0 });
    const indiv = res.computed.individualResults || [];
    record(
      'G57-T0-09',
      'Delta mesure 1 : C12 m1 ↔ T0 témoin m1',
      indiv[0]?.deltaAdhesionClass === 2,
      'Δm1=+2 (3−1)',
      `Δm1=${String(indiv[0]?.deltaAdhesionClass)}`
    );
  }
  {
    const t0 = twoMeasuresRaw([1, 2]);
    const c12 = twoMeasuresRaw([3, 5]);
    const res = calculateAdhesion(c12, std2, ruleSet, { referenceRaw: t0 });
    const indiv = res.computed.individualResults || [];
    record(
      'G57-T0-10',
      'Delta mesure 2 : C12 m2 ↔ T0 témoin m2',
      indiv[1]?.deltaAdhesionClass === 3,
      'Δm2=+3 (5−2)',
      `Δm2=${String(indiv[1]?.deltaAdhesionClass)}`
    );
  }
  {
    const t0 = twoMeasuresRaw([1, 2]);
    const c12 = twoMeasuresRaw([3, 5]);
    const res = calculateAdhesion(c12, std2, ruleSet, { referenceRaw: t0 });
    record(
      'G57-T0-11',
      'Delta moyen = panelMean − initialPanelMean',
      res.computed.deltaAdhesionClass === 2.5,
      'Δmoy=+2.5 (4−1.5)',
      `Δmoy=${String(res.computed.deltaAdhesionClass)}`
    );
  }
  {
    // T0 exposé leurre (classe 5) + T0 témoin (1,1) : la référence doit rester le témoin.
    const trial = buildAdhesionTrial({ t0TClasses: [1, 1], t0E1Class: 5, c12EClasses: [2, 4], withCountConfig: true });
    const { computed, rawUnchanged } = recalcAdh(trial, 12, 'E1');
    record(
      'G57-T0-12',
      'T0 exposé jamais utilisé comme référence (témoin imposé, même à 2 mesures)',
      rawUnchanged === true &&
        computed?.initialPanelMean === 1 &&
        computed?.deltaAdhesionClass === 2,
      'initialPanelMean=1 (témoin), Δmoy=+2',
      `initialPanelMean=${String(computed?.initialPanelMean)}, Δmoy=${String(computed?.deltaAdhesionClass)}`
    );
  }

  // --- QUALITY ---
  {
    const t0 = twoMeasuresRaw([1, 1]);
    const res = calculateAdhesion(twoMeasuresRaw([2, 3]), std2, ruleSet, { referenceRaw: t0 });
    record(
      'G57-QLT-13',
      '2/2 → GOOD',
      res.computed.qualityAssessment.status === 'GOOD' &&
        res.computed.qualityAssessment.completenessPercent === 100,
      'GOOD, 100 %',
      `${res.computed.qualityAssessment.status}, ${res.computed.qualityAssessment.completenessPercent} %`
    );
  }
  {
    const t0 = twoMeasuresRaw([1, 1]);
    const partial: AdhesionRawData = baseRaw({
      measurements: [{ measurementIndex: 1, adhesionClass: 2 }]
    });
    const res = calculateAdhesion(partial, std2, ruleSet, { referenceRaw: t0 });
    record(
      'G57-QLT-14',
      '1/2 → WARNING (50 %)',
      res.computed.qualityAssessment.status === 'WARNING' &&
        res.computed.qualityAssessment.completenessPercent === 50,
      'WARNING, 50 %',
      `${res.computed.qualityAssessment.status}, ${res.computed.qualityAssessment.completenessPercent} %`
    );
  }
  {
    const t0 = twoMeasuresRaw([1, 1]);
    const partial: AdhesionRawData = baseRaw({
      measurements: [{ measurementIndex: 1, adhesionClass: 2 }]
    });
    const res = calculateAdhesion(partial, std2, ruleSet, { referenceRaw: t0 });
    record(
      'G57-QLT-15',
      '1/2 → alerte MEASUREMENT_MISSING réellement présente',
      res.alerts.some((a) => a.code === 'MEASUREMENT_MISSING' && a.severity === 'WARNING'),
      'MEASUREMENT_MISSING/WARNING présent',
      res.alerts.map((a) => `${a.code}/${a.severity}`).join(', ') || 'aucune alerte'
    );
  }
  {
    const empty: AdhesionRawData = baseRaw({
      measurements: [
        { measurementIndex: 1, adhesionClass: null },
        { measurementIndex: 2, adhesionClass: null }
      ]
    });
    const res = calculateAdhesion(empty, std2, ruleSet, {});
    record(
      'G57-QLT-16',
      '0/2 → INVALID',
      res.computed.qualityAssessment.status === 'INVALID',
      'INVALID',
      res.computed.qualityAssessment.status
    );
  }
  {
    const res = calculateAdhesion(twoMeasuresRaw([2, 7]), std2, ruleSet, {});
    record(
      'G57-QLT-17',
      'Mesure hors borne (7) → BLOCKING + INVALID',
      res.computed.qualityAssessment.status === 'INVALID' &&
        res.alerts.some((a) => a.code === 'PHYSICAL_BOUNDS_EXCEEDED' && a.severity === 'BLOCKING'),
      'INVALID + PHYSICAL_BOUNDS_EXCEEDED/BLOCKING',
      `${res.computed.qualityAssessment.status} + ${res.alerts.map((a) => `${a.code}/${a.severity}`).join(', ')}`
    );
  }

  // --- CONFIGURATION ---
  {
    record(
      'G57-CFG-18',
      'Nouvelle config 2/2 = STANDARD',
      std2.mode === 'STANDARD_DEFAULT' &&
        std2.configuredCount === 2 &&
        std2.standardRecommendedCount === 2 &&
        std2.deviationFromStandard === false,
      'STANDARD_DEFAULT, 2/2, sans écart',
      `${std2.mode}, ${std2.configuredCount}/${std2.standardRecommendedCount}, écart=${String(std2.deviationFromStandard)}`
    );
  }
  {
    const adapted = createCountConfiguration('ADHESION', 1, ruleSet, { justification: 'Éprouvette réduite, justification métrologique.', operatorId: 'TEST_OP' });
    const res = calculateAdhesion(
      baseRaw({ measurements: [{ measurementIndex: 1, adhesionClass: 2 }] }),
      adapted,
      ruleSet,
      {}
    );
    record(
      'G57-CFG-19',
      'Adaptation 1 mesure justifiée → CUSTOM_JUSTIFIED + ADAPTED_JUSTIFIED + GOOD',
      adapted.mode === 'CUSTOM_JUSTIFIED' &&
        res.computed.protocolStatus === 'ADAPTED_JUSTIFIED' &&
        res.computed.qualityAssessment.status === 'GOOD',
      'CUSTOM_JUSTIFIED / ADAPTED_JUSTIFIED / GOOD',
      `${adapted.mode} / ${res.computed.protocolStatus} / ${res.computed.qualityAssessment.status}`
    );
  }
  {
    const unjustified = createCountConfiguration('ADHESION', 1, ruleSet);
    const res = calculateAdhesion(
      baseRaw({ measurements: [{ measurementIndex: 1, adhesionClass: 2 }] }),
      unjustified,
      ruleSet,
      {}
    );
    record(
      'G57-CFG-20',
      '1/2 sans justification → ADAPTED_UNJUSTIFIED (contrat existant)',
      res.computed.protocolStatus === 'ADAPTED_UNJUSTIFIED',
      'ADAPTED_UNJUSTIFIED',
      String(res.computed.protocolStatus)
    );
  }
  {
    // Essai historique : aucun countConfig enregistré → 1/1, scalaire GOOD.
    const trial = buildAdhesionTrial({ t0TClasses: null, t0E1Class: null, c12EClasses: [2, 2], withCountConfig: false });
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const legacyT0: AdhesionRawData = baseRaw({ adhesionClass: 1 });
    const legacyC12: AdhesionRawData = baseRaw({ adhesionClass: 2 });
    trial.acquisitions[`${stageT0.id}__${TRIAL_ID}-p-T__ADHESION`] = {
      id: 'acq-legacy-t0', trialId: TRIAL_ID, stageId: stageT0.id, batchId: `${TRIAL_ID}-batch-1`,
      panelId: `${TRIAL_ID}-p-T`, familyId: 'ADHESION', raw: legacyT0, computed: null, status: 'COMPLETE',
      alerts: [], trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
    };
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    trial.acquisitions[`${stageC12.id}__${TRIAL_ID}-p-E1__ADHESION`] = {
      id: 'acq-legacy-c12', trialId: TRIAL_ID, stageId: stageC12.id, batchId: `${TRIAL_ID}-batch-1`,
      panelId: `${TRIAL_ID}-p-E1`, familyId: 'ADHESION', raw: legacyC12, computed: null, status: 'COMPLETE',
      alerts: [], trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
    };
    const { computed, rawUnchanged } = recalcAdh(trial, 12, 'E1');
    record(
      'G57-CFG-21',
      'Essai sans countConfig : scalaire historique = 1/1 GOOD (jamais 1/2 WARNING)',
      rawUnchanged === true &&
        computed?.adhesionClass === 2 &&
        computed?.qualityAssessment.status === 'GOOD' &&
        computed?.qualityAssessment.expectedCount === 1 &&
        computed?.deltaAdhesionClass === 1,
      '1/1 GOOD, classe 2, Δ+1',
      `classe=${String(computed?.adhesionClass)}, ${computed?.qualityAssessment.status} ${computed?.qualityAssessment.actualCount}/${computed?.qualityAssessment.expectedCount}, Δ=${String(computed?.deltaAdhesionClass)}`
    );
  }

  // --- AGRÉGATION ---
  {
    const mk = (panelMean: number | null): AdhesionComputedData =>
      ({
        adhesionClass: null,
        individualResults: [],
        panelMean,
        classDescription: 'Classe test',
        elapsedTimeHours: 216,
        delayCompliance: 'CONFORME',
        gridSpacingUsedMm: 2,
        qualityAssessment: {
          expectedCount: 2, actualCount: 2, validCount: 2, suspectCount: 0,
          invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
        },
        protocolStatus: 'STANDARD',
        computation: { calculationVersion: ADHESION_CALCULATION_VERSION, calculatedAt: '2026-09-05T00:00:00Z' }
      } as AdhesionComputedData);
    const agg = aggregateBatchAdhesion('batch-g57', 'stage-c12', [mk(2.5), mk(3.0), mk(3.5)]);
    record(
      'G57-AGG-22',
      'E1/E2/E3 agrégés par moyennes panneau (témoin exclu par l’appelant)',
      agg.familyId === 'ADHESION' &&
        agg.panelsCount === 3 &&
        agg.adhesion?.overallMean === 3 &&
        JSON.stringify(agg.adhesion?.panelMeans) === JSON.stringify([2.5, 3, 3.5]),
      'overallMean=3, moyennes=[2.5,3,3.5]',
      `overallMean=${String(agg.adhesion?.overallMean)}, moyennes=${JSON.stringify(agg.adhesion?.panelMeans)}`
    );
  }
  {
    // Panneau incomplet : panelMean=1 (1 seule valide). Moyenne des moyennes =
    // (1+2.5+4.5)/3 = 2.7 ≠ moyenne poolée des 5 valides (3.0). Preuve anti-double-comptage.
    const mk = (panelMean: number | null): AdhesionComputedData =>
      ({
        adhesionClass: null,
        individualResults: [],
        panelMean,
        classDescription: 'Classe test',
        elapsedTimeHours: 216,
        delayCompliance: 'CONFORME',
        gridSpacingUsedMm: 2,
        qualityAssessment: {
          expectedCount: 2, actualCount: 2, validCount: 2, suspectCount: 0,
          invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
        },
        protocolStatus: 'STANDARD',
        computation: { calculationVersion: ADHESION_CALCULATION_VERSION, calculatedAt: '2026-09-05T00:00:00Z' }
      } as AdhesionComputedData);
    const agg = aggregateBatchAdhesion('batch-g57', 'stage-c12', [mk(1), mk(2.5), mk(4.5)]);
    record(
      'G57-AGG-23',
      'Agrégation sur moyennes panneau, pas sur mesures individuelles poolées',
      agg.adhesion?.overallMean === 2.7,
      'overallMean=2.7 (≠ 3.0 poolé)',
      `overallMean=${String(agg.adhesion?.overallMean)}`
    );
  }
  {
    const mk = (panelMean: number | null): AdhesionComputedData =>
      ({
        adhesionClass: null,
        individualResults: [],
        panelMean,
        classDescription: 'Classe test',
        elapsedTimeHours: 216,
        delayCompliance: 'CONFORME',
        gridSpacingUsedMm: 2,
        qualityAssessment: {
          expectedCount: 2, actualCount: 2, validCount: 2, suspectCount: 0,
          invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
        },
        protocolStatus: 'STANDARD',
        computation: { calculationVersion: ADHESION_CALCULATION_VERSION, calculatedAt: '2026-09-05T00:00:00Z' }
      } as AdhesionComputedData);
    const agg = aggregateBatchAdhesion('batch-g57', 'stage-c12', [mk(2.5), mk(3), mk(3.5)]);
    record(
      'G57-AGG-24',
      'Écart-type inter-panneaux échantillon (n−1)',
      agg.adhesion?.standardDeviation === 0.5,
      's=0.5',
      `s=${String(agg.adhesion?.standardDeviation)}`
    );
  }

  // --- COMPATIBILITÉ ---
  {
    const raw = baseRaw({ adhesionClass: 2, observation: 'Legacy' });
    const t0 = baseRaw({ adhesionClass: 1 });
    const res = calculateAdhesion(raw, resolveAdhesionCountConfig(undefined), ruleSet, { referenceRaw: t0 });
    record(
      'G57-CMP-25',
      'RAW scalaire historique → calcul inchangé (classe, GOOD, Δ)',
      res.computed.adhesionClass === 2 &&
        res.computed.initialAdhesionClass === 1 &&
        res.computed.deltaAdhesionClass === 1 &&
        res.computed.qualityAssessment.status === 'GOOD',
      'classe 2, init 1, Δ+1, GOOD',
      `classe=${String(res.computed.adhesionClass)}, init=${String(res.computed.initialAdhesionClass)}, Δ=${String(res.computed.deltaAdhesionClass)}, ${res.computed.qualityAssessment.status}`
    );
  }
  {
    // T0 scalaire legacy + C12 2 mesures : m1 appariée, m2 sans référence (null, pas de faux delta).
    const t0 = baseRaw({ adhesionClass: 1 });
    const c12 = twoMeasuresRaw([3, 5]);
    const res = calculateAdhesion(c12, std2, ruleSet, { referenceRaw: t0 });
    const indiv = res.computed.individualResults || [];
    record(
      'G57-CMP-26',
      'Référence legacy 1 mesure : m1 appariée, m2 sans faux delta, moyenne correcte',
      indiv[0]?.deltaAdhesionClass === 2 &&
        indiv[1]?.deltaAdhesionClass === null &&
        res.computed.panelMean === 4 &&
        res.computed.initialPanelMean === 1 &&
        res.computed.deltaAdhesionClass === 3,
      'Δm1=+2, Δm2=null, moy=4, init=1, Δmoy=+3',
      `Δm1=${String(indiv[0]?.deltaAdhesionClass)}, Δm2=${String(indiv[1]?.deltaAdhesionClass)}, moy=${String(res.computed.panelMean)}, Δmoy=${String(res.computed.deltaAdhesionClass)}`
    );
  }

  // --- UI / EXPORT ---
  {
    const t0 = twoMeasuresRaw([1, 2]);
    const res = calculateAdhesion(twoMeasuresRaw([3, 5]), std2, ruleSet, { referenceRaw: t0 });
    const indiv = res.computed.individualResults || [];
    record(
      'G57-EXP-27',
      'Contrat d’affichage : 2 mesures + moyenne + deltas exposés aux vues',
      indiv.length === 2 &&
        res.computed.panelMean === 4 &&
        indiv[0]?.deltaAdhesionClass === 2 &&
        indiv[1]?.deltaAdhesionClass === 3,
      '2 résultats, moy=4, Δ=+2/+3',
      `${indiv.length} résultats, moy=${String(res.computed.panelMean)}, Δ=${indiv.map((m) => String(m.deltaAdhesionClass)).join('/')}`
    );
  }
  {
    const trial = buildAdhesionTrial({ t0TClasses: [0, 1], t0E1Class: null, c12EClasses: [2, 4], withCountConfig: true });
    // Le CSV brut n'exige que le RAW (immuabilité vérifiée par ailleurs).
    const csv = exportRawDataToCsv(trial);
    const hasM1 = csv.includes('ADHESION;"Mesure 1 Classe 2"');
    const hasM2 = csv.includes('ADHESION;"Mesure 2 Classe 4"');
    record(
      'G57-EXP-28',
      'CSV : les deux mesures multi-mesures sont exportées (aucune perdue)',
      hasM1 && hasM2,
      'Lignes Mesure 1 Classe 2 + Mesure 2 Classe 4',
      hasM1 && hasM2 ? '2 lignes présentes' : csv.split('\n').filter((l) => l.includes('ADHESION')).join(' | ').slice(0, 200)
    );
  }
  {
    const trial = buildAdhesionTrial({ t0TClasses: [0, 1], t0E1Class: null, c12EClasses: [2, 4], withCountConfig: true });
    const ruleSetLocal = getDefaultScientificRuleSet();
    // Fige les computed via le pipeline réel (référence T0 témoin résolue par le recalculateur).
    Object.values(trial.acquisitions).forEach((rec) => {
      const { updatedRecord } = recalculateAcquisition(rec, trial, ruleSetLocal);
      trial.acquisitions[`${rec.stageId}__${rec.panelId}__${rec.familyId}`] = updatedRecord;
    });
    const csv = exportReportToCsv(trial, minimalReport(), ruleSetLocal);
    const hasBoth = csv.includes('M1=2') && csv.includes('M2=4') && csv.includes('moy. 3');
    record(
      'G57-EXP-29',
      'Rapport imprimable/CSV : mesures 1+2 et moyenne visibles',
      hasBoth,
      'Contient M1=2, M2=4, moy. 3',
      hasBoth ? '3 marqueurs présents' : csv.split('\n').filter((l) => l.includes('ADHESION')).join(' | ').slice(0, 220)
    );
  }

  // --- P0 ---
  {
    // RAW gelé de bout en bout : toute mutation illégitime lèverait (mode strict)
    // ou ferait échouer rawUnchanged. Le rejet transactionnel store est couvert par Gate 3.1.
    const trial = buildAdhesionTrial({ t0TClasses: [1, 1], t0E1Class: null, c12EClasses: [2, 3], withCountConfig: true });
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${TRIAL_ID}-p-E1__ADHESION`];
    Object.freeze(rec.raw);
    const before = JSON.stringify(rec.raw);
    let threw = false;
    let rawUnchanged = false;
    let hasComputed = false;
    try {
      const out = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
      rawUnchanged = out.rawUnchanged;
      hasComputed = Boolean(out.updatedRecord.computed);
    } catch {
      threw = true;
    }
    const after = JSON.stringify(rec.raw);
    record(
      'G57-P0-30',
      'P0 : pipeline sans mutation du RAW multi-mesures (gelé, flag intact)',
      !threw && rawUnchanged === true && hasComputed && before === after,
      'rawUnchanged=true, computed présent, RAW identique',
      threw ? 'Exception levée' : `rawUnchanged=${String(rawUnchanged)}, computed=${String(hasComputed)}, identique=${String(before === after)}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
