/**
 * QUV-Lab — Suite de Tests VERROU POPULATION AGRÉGATEURS (P2).
 *
 * Points d'entrée stricts aggregateBatch*Exposed : E1/E2/E3 actifs uniquement
 * (T, custom, inactifs, incohérents exclus avant délégation canonique).
 * Cohérence calendrier : cycleIndex canonique pour ADHÉSION (stageType = fallback).
 * Régression : recalculator verrouillé, autres familles inchangées.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import {
  aggregateBatchColor,
  aggregateBatchGloss,
  aggregateBatchPersoz,
  aggregateBatchAdhesion,
  aggregateBatchColorExposed,
  aggregateBatchGlossExposed,
  aggregateBatchPersozExposed,
  aggregateBatchAdhesionExposed,
  PanelComputedItem
} from '../aggregations';
import { isFamilyScheduledForStage } from '../panelUtils';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type {
  ColorComputedData,
  GlossComputedData,
  PersozComputedData,
  AdhesionComputedData
} from '../../types/scientific';

export interface AggregatorPopulationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const T = { id: 't', label: 'T', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' };
const E1 = { id: 'e1', label: '1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' };
const E2 = { id: 'e2', label: '2', roleCode: 'E2', role: 'EXPOSED_2', status: 'ACTIVE' };
const E3 = { id: 'e3', label: '3', roleCode: 'E3', role: 'EXPOSED_3', status: 'ACTIVE' };
const CUSTOM = { id: 'x', label: 'X', roleCode: 'E', role: 'EXPOSED_CUSTOM', status: 'ACTIVE' };
const INACTIVE_E2 = { id: 'e2', label: '2', roleCode: 'E2', role: 'EXPOSED_2', status: 'EXCLUDED' };
const INCOHERENT = { id: 'z', label: 'Z', roleCode: 'E1', role: 'EXPOSED_2', status: 'ACTIVE' };

function qa() {
  return {
    expectedCount: 3, actualCount: 3, validCount: 3, suspectCount: 0,
    invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
  };
}

function comp() {
  return {
    qualityAssessment: qa(),
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  };
}

function mkColor(meanL: number | null, meanA: number | null, meanB: number | null, deltaE: number | null): ColorComputedData {
  return {
    pointsCount: 4, validCount: 4, meanL, meanA, meanB,
    stdDevL: 0.1, stdDevA: 0.1, stdDevB: 0.1, chromaC: null, hueH: null,
    deltaL: null, deltaA: null, deltaB: null, deltaE, ...comp()
  } as ColorComputedData;
}

function mkGloss(mean: number | null, ret: number | null): GlossComputedData {
  return {
    totalReadings: 4, validCount: 4, meanGloss: mean, stdDevGloss: 0.5, seriesStats: [],
    deltaGloss: null, retentionRatePercent: ret, ...comp()
  } as GlossComputedData;
}

function mkPersoz(mean: number | null): PersozComputedData {
  return {
    pointsCount: 3, validCount: 3, meanDampingTime: mean,
    stdDevDampingTime: 0.5, coefficientOfVariationPercent: 0.6,
    deltaDampingTime: null, relativeHardnessVariationPercent: null, ...comp()
  } as PersozComputedData;
}

function mkAdh(panelMean: number | null): AdhesionComputedData {
  return {
    adhesionClass: null, individualResults: [], panelMean,
    classDescription: 'Moyenne panneau', elapsedTimeHours: 216,
    gridSpacingUsedMm: 2, ...comp()
  } as AdhesionComputedData;
}

export function runAggregatorPopulationLockTests(): {
  results: AggregatorPopulationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AggregatorPopulationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- COLOR 1-5 ---
  {
    const items: PanelComputedItem<ColorComputedData>[] = [
      { panel: E1, computed: mkColor(60, 2, 10, 1) },
      { panel: E2, computed: mkColor(63, 4, 12, 2) },
      { panel: E3, computed: mkColor(66, 6, 14, 3) }
    ];
    const agg = aggregateBatchColorExposed('b', 's', items);
    record('AGG-01', 'COLOR E1/E2/E3 acceptés',
      agg.color?.meanL === 63, 'meanL=63', `meanL=${String(agg.color?.meanL)}`);
  }
  {
    const items: PanelComputedItem<ColorComputedData>[] = [
      { panel: T, computed: mkColor(200, 50, 50, 99) },
      { panel: E1, computed: mkColor(60, 2, 10, 1) },
      { panel: E2, computed: mkColor(63, 4, 12, 2) },
      { panel: E3, computed: mkColor(66, 6, 14, 3) }
    ];
    const agg = aggregateBatchColorExposed('b', 's', items);
    record('AGG-02', 'COLOR T injecté exclu',
      agg.color?.meanL === 63 && agg.meanDeltaE === 2, 'meanL=63, ΔE=2', `meanL=${String(agg.color?.meanL)}, ΔE=${String(agg.meanDeltaE)}`);
  }
  {
    const items: PanelComputedItem<ColorComputedData>[] = [
      { panel: CUSTOM, computed: mkColor(200, 50, 50, 99) },
      { panel: E1, computed: mkColor(60, 2, 10, 1) },
      { panel: E2, computed: mkColor(63, 4, 12, 2) },
      { panel: E3, computed: mkColor(66, 6, 14, 3) }
    ];
    const agg = aggregateBatchColorExposed('b', 's', items);
    record('AGG-03', 'COLOR custom exclu',
      agg.color?.meanL === 63, 'meanL=63', `meanL=${String(agg.color?.meanL)}`);
  }
  {
    const items: PanelComputedItem<ColorComputedData>[] = [
      { panel: INACTIVE_E2, computed: mkColor(0, 0, 0, 0) },
      { panel: E1, computed: mkColor(60, 2, 10, 1) },
      { panel: E3, computed: mkColor(66, 6, 14, 3) }
    ];
    const agg = aggregateBatchColorExposed('b', 's', items);
    record('AGG-04', 'COLOR inactif exclu',
      agg.color?.meanL === 63, 'meanL=63 (60+66/2)', `meanL=${String(agg.color?.meanL)}`);
  }
  {
    const items: PanelComputedItem<ColorComputedData>[] = [
      { panel: E1, computed: mkColor(60, 2, 10, 1) },
      { panel: E2, computed: mkColor(63, 4, 12, 2) },
      { panel: E3, computed: mkColor(66, 6, 14, 3) }
    ];
    const strict = aggregateBatchColorExposed('b', 's', items);
    const direct = aggregateBatchColor('b', 's', items.map((i) => i.computed));
    record('AGG-05', 'COLOR statistiques identiques au nominal',
      strict.meanDeltaE === direct.meanDeltaE && strict.color?.meanL === direct.color?.meanL,
      'strict === direct', `ΔE ${String(strict.meanDeltaE)} vs ${String(direct.meanDeltaE)}`);
  }

  // --- GLOSS 6-8 ---
  {
    const items: PanelComputedItem<GlossComputedData>[] = [
      { panel: E1, computed: mkGloss(44, 88) },
      { panel: E2, computed: mkGloss(46, 92) },
      { panel: E3, computed: mkGloss(45, 90) }
    ];
    const agg = aggregateBatchGlossExposed('b', 's', items);
    record('AGG-06', 'GLOSS E1/E2/E3 acceptés',
      agg.interPanelMean === 45, 'mean=45', `mean=${String(agg.interPanelMean)}`);
  }
  {
    const items: PanelComputedItem<GlossComputedData>[] = [
      { panel: T, computed: mkGloss(10, 20) },
      { panel: E1, computed: mkGloss(44, 88) },
      { panel: E2, computed: mkGloss(46, 92) },
      { panel: E3, computed: mkGloss(45, 90) }
    ];
    const agg = aggregateBatchGlossExposed('b', 's', items);
    record('AGG-07', 'GLOSS T exclu',
      agg.interPanelMean === 45, 'mean=45', `mean=${String(agg.interPanelMean)}`);
  }
  {
    const items: PanelComputedItem<GlossComputedData>[] = [
      { panel: CUSTOM, computed: mkGloss(10, 20) },
      { panel: E1, computed: mkGloss(44, 88) },
      { panel: E2, computed: mkGloss(46, 92) },
      { panel: E3, computed: mkGloss(45, 90) }
    ];
    const agg = aggregateBatchGlossExposed('b', 's', items);
    record('AGG-08', 'GLOSS custom exclu',
      agg.interPanelMean === 45, 'mean=45', `mean=${String(agg.interPanelMean)}`);
  }

  // --- PERSOZ 9-11 ---
  {
    const items: PanelComputedItem<PersozComputedData>[] = [
      { panel: E1, computed: mkPersoz(84) },
      { panel: E2, computed: mkPersoz(86) },
      { panel: E3, computed: mkPersoz(85) }
    ];
    const agg = aggregateBatchPersozExposed('b', 's', items);
    record('AGG-09', 'PERSOZ E1/E2/E3 acceptés',
      agg.interPanelMean === 85, 'mean=85', `mean=${String(agg.interPanelMean)}`);
  }
  {
    const items: PanelComputedItem<PersozComputedData>[] = [
      { panel: T, computed: mkPersoz(200) },
      { panel: E1, computed: mkPersoz(84) },
      { panel: E2, computed: mkPersoz(86) },
      { panel: E3, computed: mkPersoz(85) }
    ];
    const agg = aggregateBatchPersozExposed('b', 's', items);
    record('AGG-10', 'PERSOZ T exclu',
      agg.interPanelMean === 85, 'mean=85', `mean=${String(agg.interPanelMean)}`);
  }
  {
    const items: PanelComputedItem<PersozComputedData>[] = [
      { panel: CUSTOM, computed: mkPersoz(200) },
      { panel: INCOHERENT, computed: mkPersoz(200) },
      { panel: E1, computed: mkPersoz(84) },
      { panel: E2, computed: mkPersoz(86) },
      { panel: E3, computed: mkPersoz(85) }
    ];
    const agg = aggregateBatchPersozExposed('b', 's', items);
    record('AGG-11', 'PERSOZ custom/incohérent exclus',
      agg.interPanelMean === 85, 'mean=85', `mean=${String(agg.interPanelMean)}`);
  }

  // --- ADHÉSION 12-18 ---
  {
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: E1, computed: mkAdh(2.5) },
      { panel: E2, computed: mkAdh(3.0) },
      { panel: E3, computed: mkAdh(3.5) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    const ok = agg.adhesion?.overallMean === 3;
    record('AGG-12', 'ADHÉSION C12 E1 accepté (moyenne 3)', ok, 'overallMean=3', String(agg.adhesion?.overallMean));
  }
  {
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: E1, computed: mkAdh(2.5) },
      { panel: E2, computed: mkAdh(3.0) },
      { panel: E3, computed: mkAdh(3.5) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-13', 'ADHÉSION C12 E2 accepté', agg.adhesion?.overallMean === 3, 'overallMean=3', String(agg.adhesion?.overallMean));
  }
  {
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: E1, computed: mkAdh(2.5) },
      { panel: E2, computed: mkAdh(3.0) },
      { panel: E3, computed: mkAdh(3.5) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-14', 'ADHÉSION C12 E3 accepté', agg.adhesion?.overallMean === 3, 'overallMean=3', String(agg.adhesion?.overallMean));
  }
  {
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: T, computed: mkAdh(0) },
      { panel: E1, computed: mkAdh(2.5) },
      { panel: E2, computed: mkAdh(3.0) },
      { panel: E3, computed: mkAdh(3.5) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-15', 'ADHÉSION C12 T exclu',
      agg.adhesion?.overallMean === 3, 'overallMean=3', String(agg.adhesion?.overallMean));
  }
  {
    // T0/T seul : pas une population C12 — le strict E1-E3 le rejette (vide → nulls).
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: T, computed: mkAdh(0) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-16', 'T0/T hors agrégation C12 (vide → nulls)',
      agg.adhesion?.overallMean === null, 'overallMean=null', String(agg.adhesion?.overallMean));
  }
  {
    // C1 : aucun appelant légitime ne fournit de C12 ; un item E1 isolé reste
    // une moyenne de panneau, jamais une statistique C12 — ici : 1 seul item.
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: E1, computed: mkAdh(2) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-17', 'Population non-C12 : pas de statistique C12 fabriquée',
      agg.panelsCount === 1, 'panelsCount=1 (traçable, non gonflé)', `panelsCount=${agg.panelsCount}`);
  }
  {
    const items: PanelComputedItem<AdhesionComputedData>[] = [
      { panel: E3, computed: mkAdh(4) }
    ];
    const agg = aggregateBatchAdhesionExposed('b', 's', items);
    record('AGG-18', 'Item isolé : aucune moyenne globale artificielle',
      agg.adhesion?.overallMean === 4 && agg.panelsCount === 1, 'mean=4 sur 1 panneau', String(agg.adhesion?.overallMean));
  }

  // --- Cohérence calendrier 19-24 ---
  {
    const t0 = { cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE' };
    const ok = isFamilyScheduledForStage('ADHESION', t0) === true;
    const fallback = isFamilyScheduledForStage('ADHESION', { stageType: 'INITIAL_PRE_EXPOSURE' } as unknown as { cycleIndex: number; stageType?: string });
    record('AGG-19', 'Cycle 0 + INITIAL → T0 valide (+fallback sans cycleIndex)',
      ok && fallback === true, 'true/true', `${String(ok)}/${String(fallback)}`);
  }
  {
    const c12 = { cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE' };
    record('AGG-20', 'Cycle 12 + FINAL → C12 valide',
      isFamilyScheduledForStage('ADHESION', c12) === true, 'true', String(isFamilyScheduledForStage('ADHESION', c12)));
  }
  {
    const bad = { cycleIndex: 5, stageType: 'FINAL_POST_EXPOSURE' };
    record('AGG-21', 'Cycle 5 + FINAL → ADHÉSION interdite (cycleIndex prioritaire)',
      isFamilyScheduledForStage('ADHESION', bad) === false, 'false', String(isFamilyScheduledForStage('ADHESION', bad)));
  }
  {
    const bad = { cycleIndex: 7, stageType: 'INITIAL_PRE_EXPOSURE' };
    record('AGG-22', 'Cycle 7 + INITIAL → ADHÉSION interdite',
      isFamilyScheduledForStage('ADHESION', bad) === false, 'false', String(isFamilyScheduledForStage('ADHESION', bad)));
  }
  {
    const bad = { cycleIndex: 12, stageType: 'INTERMEDIATE_DURING_EXPOSURE' };
    record('AGG-23', 'Cycle 12 + type incohérent → C12 valide (cycleIndex prioritaire)',
      isFamilyScheduledForStage('ADHESION', bad) === true, 'true', String(isFamilyScheduledForStage('ADHESION', bad)));
  }
  {
    const bad = { cycleIndex: 0, stageType: 'INTERMEDIATE_DURING_EXPOSURE' };
    record('AGG-24', 'Cycle 0 + type incohérent → T0 valide',
      isFamilyScheduledForStage('ADHESION', bad) === true, 'true', String(isFamilyScheduledForStage('ADHESION', bad)));
  }

  // --- Régression recalculator 25-32 ---
  const trialId = 'trial-agg-lock';
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const mkTrial = (): Trial => ({
    id: trialId, schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: 'QUV-AGG', createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS', configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['PERSOZ', 'ADHESION', 'COLOR', 'GLOSS', 'OBSERVATIONS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: 'LOT AGG', orderIndex: 1,
      dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
      panels: [
        { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  } as Trial);

  const recalcFor = (trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string, raw: unknown): PanelAcquisitionRecord => {
    const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
    const rec: PanelAcquisitionRecord = {
      id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
      trialId: trial.id, stageId: stage.id, batchId, panelId: `${trialId}-p-${panelSuffix}`, familyId,
      raw, computed: null, status: 'COMPLETE', alerts: [],
      trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
    };
    const { updatedRecord } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
    trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = updatedRecord;
    return updatedRecord;
  };

  const persozRaw = {
    readings: [85, 85, 85].map((v, i) => ({ pointIndex: i + 1, dampingTimeSeconds: v })),
    unit: 'SECONDS'
  };
  const adhRaw = (cls: number) => ({
    adhesionClass: cls, gridSpacingMm: 2, coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z', applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168, normReference: 'NF EN ISO 2409:2020'
  });
  const colorRaw = {
    readings: [1, 2, 3, 4].map((i) => ({ pointIndex: i, L: 60, a: 2, b: 10 }))
  };
  const glossRaw = {
    series: [{ seriesIndex: 1, orientation: 'x', readings: [{ pointIndex: 1, value: 45 }] }]
  };
  const obsRaw = { observations: [{ category: 'X', rating: 0, status: 'CONFORME', comment: '' }] };

  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 12, 'T', 'PERSOZ', persozRaw);
    record('AGG-25', 'Recalculator PERSOZ T → EMPTY',
      rec.computed === null && rec.status === 'EMPTY', 'null + EMPTY', `status=${rec.status}`);
  }
  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 6, 'E1', 'ADHESION', adhRaw(2));
    record('AGG-26', 'Recalculator ADHÉSION C1-C11 → EMPTY',
      rec.computed === null && rec.status === 'EMPTY', 'null + EMPTY', `status=${rec.status}`);
  }
  {
    const trial = mkTrial();
    recalcFor(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalcFor(trial, 12, 'T', 'ADHESION', adhRaw(1));
    record('AGG-27', 'Recalculator ADHÉSION C12 T → EMPTY',
      rec.computed === null && rec.status === 'EMPTY', 'null + EMPTY', `status=${rec.status}`);
  }
  {
    const trial = mkTrial();
    recalcFor(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalcFor(trial, 12, 'E1', 'ADHESION', adhRaw(2));
    const cls = (rec.computed as AdhesionComputedData | null)?.adhesionClass;
    record('AGG-28', 'Recalculator ADHÉSION C12 E1-E3 → COMPUTED',
      cls === 2, 'classe 2', `classe=${String(cls)}`);
  }
  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const cls = (rec.computed as AdhesionComputedData | null)?.adhesionClass;
    record('AGG-29', 'ADHÉSION T0/T → COMPUTED',
      cls === 0, 'classe 0', `classe=${String(cls)}`);
  }
  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 12, 'E1', 'COLOR', colorRaw);
    const mean = (rec.computed as ColorComputedData | null)?.meanL;
    record('AGG-30', 'COLOR inchangé',
      mean === 60, 'meanL=60', `meanL=${String(mean)}`);
  }
  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 12, 'E1', 'GLOSS', glossRaw);
    const mean = (rec.computed as GlossComputedData | null)?.meanGloss;
    record('AGG-31', 'GLOSS inchangé',
      mean === 45, 'meanGloss=45', `meanGloss=${String(mean)}`);
  }
  {
    const trial = mkTrial();
    const rec = recalcFor(trial, 12, 'E1', 'OBSERVATIONS', obsRaw);
    record('AGG-32', 'OBSERVATIONS inchangé',
      rec.computed !== null, 'computed présent', `computed=${rec.computed === null ? 'null' : 'présent'}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
