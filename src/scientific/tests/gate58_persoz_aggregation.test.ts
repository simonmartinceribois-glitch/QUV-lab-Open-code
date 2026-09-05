/**
 * QUV-Lab — Suite de Tests GATE 58 : AGRÉGATION INTER-PANNEAUX PERSOZ CANONIQUE
 *
 * `aggregateBatchPersoz()` unifie la moyenne inter-panneaux (anciennement calculée
 * inline dans ResultsBatchAnalysisView et ResultsAdvancedComparisonsView) et ajoute
 * l'écart-type inter-panneaux (échantillon n−1), comme COLOR/GLOSS/ADHESION.
 * Contrat : liste de panneaux exposés fournie par l'appelant (témoin filtré en
 * amont via getActiveExposedPanels), RAW jamais touché, moyenne à 1 décimale.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { AdhesionRawData, PersozComputedData } from '../../types/scientific';
import { aggregateBatchPersoz } from '../aggregations';
import { getActiveExposedPanels } from '../panelUtils';
import { exportRawDataToCsv } from '../../services/reportGenerator';

export interface Gate58TestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const TRIAL_ID = 'trial-g58-persoz';

function mkPersoz(meanDampingTime: number | null, validCount = 3): PersozComputedData {
  return {
    pointsCount: 3,
    validCount,
    meanDampingTime,
    stdDevDampingTime: 0.5,
    coefficientOfVariationPercent: 0.6,
    deltaDampingTime: null,
    relativeHardnessVariationPercent: null,
    qualityAssessment: {
      expectedCount: 3,
      actualCount: 3,
      validCount,
      suspectCount: 0,
      invalidCount: 0,
      missingCount: 0,
      completenessPercent: 100,
      status: 'GOOD',
      warnings: []
    },
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  } as PersozComputedData;
}

function buildCsvTrial(): Trial {
  const stages = generateStandardExposureStages(TRIAL_ID);
  const stageT0 = stages.find((s) => s.cycleIndex === 0)!;
  const stageC12 = stages.find((s) => s.cycleIndex === 12)!;
  const batchId = `${TRIAL_ID}-batch-1`;
  const trial: Trial = {
    id: TRIAL_ID,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: 'QUV-G58', createdBy: 'TEST_OP' },
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
        trialId: TRIAL_ID,
        reference: 'LOT G58',
        orderIndex: 1,
        panels: [
          { id: `${TRIAL_ID}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${TRIAL_ID}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const }
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

  seed(stageT0.id, `${TRIAL_ID}-p-T`, {
    measurements: [
      { measurementIndex: 1, adhesionClass: 0 },
      { measurementIndex: 2, adhesionClass: 1 }
    ],
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-08-30T14:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020',
    elapsedTimeHours: 696
  } as AdhesionRawData);
  seed(stageC12.id, `${TRIAL_ID}-p-E1`, {
    adhesionClass: 2,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020',
    observation: 'Legacy C12',
    elapsedTimeHours: 2160
  } as AdhesionRawData);
  return trial;
}

export function runGate58PersozAggregationTests(): {
  results: Gate58TestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Gate58TestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- G58-AGG-01 : agrégation nominale ---
  {
    const agg = aggregateBatchPersoz('batch-g58', 'stage-c12', [
      mkPersoz(84.5),
      mkPersoz(86.0),
      mkPersoz(85.5)
    ]);
    record(
      'G58-AGG-01',
      'Agrégation nominale : moyenne à 1 décimale, familyId PERSOZ',
      agg.familyId === 'PERSOZ' &&
        agg.interPanelMean === 85.3 &&
        agg.panelsCount === 3 &&
        agg.activePanelsCount === 3,
      'PERSOZ, mean=85.3, 3/3 panneaux',
      `${agg.familyId}, mean=${String(agg.interPanelMean)}, ${agg.activePanelsCount}/${agg.panelsCount} panneaux`
    );
  }

  // --- G58-AGG-02 : écart-type échantillon n−1 ---
  // [80, 90, 100] : moyenne 90 ; n−1 → sqrt((100+0+100)/2) = 10 ;
  // population (n) → sqrt(200/3) ≈ 8.2. Le résultat doit être 10, pas 8.2.
  {
    const agg = aggregateBatchPersoz('batch-g58', 'stage-c12', [
      mkPersoz(80),
      mkPersoz(90),
      mkPersoz(100)
    ]);
    record(
      'G58-AGG-02',
      'Écart-type inter-panneaux échantillon (n−1), pas population',
      agg.interPanelStdDev === 10,
      's=10 (n−1), pas 8.2 (n)',
      `s=${String(agg.interPanelStdDev)}`
    );
  }

  // --- G58-AGG-03 : témoin exclu (contrat d'appel) ---
  // Le témoin (120 s, valeur leurre qui fausserait la moyenne à 97) est
  // filtré en amont par getActiveExposedPanels ; l'agrégation ne reçoit que E1/E2.
  {
    const panels = [
      { id: 'p-T', batchId: 'b', index: 1, label: 'T', role: 'WITNESS', roleCode: 'T', status: 'ACTIVE' },
      { id: 'p-E1', batchId: 'b', index: 2, label: '1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' },
      { id: 'p-E2', batchId: 'b', index: 3, label: '2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' }
    ];
    const exposed = getActiveExposedPanels(panels);
    const byPanel: Record<string, PersozComputedData> = {
      'p-T': mkPersoz(120),
      'p-E1': mkPersoz(85),
      'p-E2': mkPersoz(86)
    };
    const agg = aggregateBatchPersoz(
      'batch-g58',
      'stage-c12',
      exposed.map((p) => byPanel[p.id])
    );
    record(
      'G58-AGG-03',
      'Témoin exclu : moyenne des seuls exposés via getActiveExposedPanels',
      exposed.length === 2 &&
        agg.panelsCount === 2 &&
        agg.interPanelMean === 85.5,
      '2 exposés, mean=85.5 (pas 97 avec témoin)',
      `${exposed.length} exposés, mean=${String(agg.interPanelMean)}`
    );
  }

  // --- G58-AGG-04 : non-régression numérique vs ancien inline ---
  // Ancien calcul : (85.2+84.8+85.5)/3 = 85.1667 → toFixed(1) = '85.2'.
  {
    const agg = aggregateBatchPersoz('batch-g58', 'stage-c12', [
      mkPersoz(85.2),
      mkPersoz(84.8),
      mkPersoz(85.5)
    ]);
    record(
      'G58-AGG-04',
      'Non-régression : identique à l’ancien calcul inline à la précision affichée',
      agg.interPanelMean === 85.2,
      'mean=85.2 (ancien inline : 85.2)',
      `mean=${String(agg.interPanelMean)}`
    );
  }

  // --- G58-AGG-05 : valeurs invalides (cohérent avec aggregateBatchGloss) ---
  {
    const agg = aggregateBatchPersoz('batch-g58', 'stage-c12', [
      mkPersoz(NaN),
      mkPersoz(Infinity),
      mkPersoz(-Infinity),
      mkPersoz(99, 0),
      mkPersoz(85)
    ]);
    record(
      'G58-AGG-05',
      'Invalides écartés : NaN/±Infinity ignorés, validCount=0 exclu',
      agg.interPanelMean === 85 &&
        agg.panelsCount === 5 &&
        agg.activePanelsCount === 4,
      'mean=85, 5 reçus / 4 actifs (validCount>0)',
      `mean=${String(agg.interPanelMean)}, ${agg.activePanelsCount}/${agg.panelsCount}`
    );
  }

  // --- G58-AGG-06 : cas limites ---
  {
    const empty = aggregateBatchPersoz('batch-g58', 'stage-c12', []);
    const single = aggregateBatchPersoz('batch-g58', 'stage-c12', [mkPersoz(87.3)]);
    record(
      'G58-AGG-06',
      'Limites : vide → null/null ; unique → moyenne sans écart-type',
      empty.interPanelMean === null &&
        empty.interPanelStdDev === null &&
        empty.panelsCount === 0 &&
        empty.activePanelsCount === 0 &&
        single.interPanelMean === 87.3 &&
        single.interPanelStdDev === null,
      'vide=null/null, unique=87.3/s=null',
      `vide=${String(empty.interPanelMean)}/${String(empty.interPanelStdDev)}, unique=${String(single.interPanelMean)}/${String(single.interPanelStdDev)}`
    );
  }

  // --- G58-EXP-07 : CSV RAW, elapsedTimeHours harmonisé ---
  {
    const csv = exportRawDataToCsv(buildCsvTrial());
    const lines = csv.split('\n').filter((l) => l.includes(';ADHESION;'));
    const multiLines = lines.filter((l) => l.includes('Mesure '));
    const legacyLines = lines.filter((l) => l.includes('"Classe '));
    const multiOk = multiLines.length === 2 && multiLines.every((l) => l.includes(';696;'));
    const legacyOk = legacyLines.length === 1 && legacyLines[0].includes(';2160;');
    record(
      'G58-EXP-07',
      'CSV RAW : elapsedTimeHours présent en multi-mesures comme en legacy',
      multiOk && legacyOk,
      '2 lignes multi avec ;696; + 1 ligne legacy avec ;2160;',
      `${multiLines.length} lignes multi (${multiOk ? '696 OK' : '696 MANQUANT'}), ${legacyLines.length} ligne legacy (${legacyOk ? '2160 OK' : '2160 MANQUANT'})`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
