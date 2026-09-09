/**
 * QUV-Lab — Suite de Tests INTÉGRITÉ DES OBSERVATIONS VISUELLES.
 *
 * P0 : une cotation manquante (undefined, null, "") ou invalide (hors domaine
 * 0..5, NaN, non finie) n'est JAMAIS interprétée comme une cotation 0.
 * Validation individuelle (valid/missing/invalid), complétude réellement calculée
 * sur les cotations valides, cotation maximale « non évaluée » (null) quand rien
 * de valide n'est enregistré.
 * P1 : le comparateur multi-systèmes restitue « non évalué » (null) par catégorie
 * sans cotation valide — jamais 0 — et un vrai 0 enregistré reste 0 et compte
 * comme donnée enregistrée (hasRecordedData). null ≠ 0 ≠ 2.
 */

import { calculateObservations } from '../observationsEngine';
import { compareSystemsAtStage } from '../analysis/MultiSystemComparator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';
import type { VisualObservationsRawData } from '../../types/scientific';

export interface ObservationsIntegrityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

type RatingInput = string | number | null | undefined;

function buildObsRaw(ratings: RatingInput[]): VisualObservationsRawData {
  const categories = ['BLISTERING', 'FLAKING', 'CRACKING', 'CHALKING', 'GENERAL_APPEARANCE', 'OTHER_DEFECT'];
  return {
    observations: ratings.map((rating, i) => ({
      category: (categories[i % categories.length] ?? 'OTHER_DEFECT') as VisualObservationsRawData['observations'][number]['category'],
      categoryLabel: `Catégorie ${i + 1}`,
      rating,
      status: 'CONFORME' as const
    }))
  } as unknown as VisualObservationsRawData;
}

function buildComparatorTrial(
  trialId: string,
  observations: Array<{ category: string; rating: RatingInput }>
): Trial {
  const stageId = `${trialId}-st-c12`;
  const batchId = `${trialId}-batch-1`;
  const panelId = `${trialId}-p-1-E1`;
  const batch = {
    id: batchId,
    trialId,
    reference: `LOT ${trialId}`,
    orderIndex: 1,
    panels: [{
      id: panelId, batchId, index: 1, label: '1',
      role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const
    }]
  };
  const acquisitions: Trial['acquisitions'] = {};
  acquisitions[`${stageId}__${panelId}__OBSERVATIONS`] = {
    id: `${trialId}-a-obs`, trialId, stageId, batchId, panelId,
    familyId: 'OBSERVATIONS',
    raw: { observations },
    status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
  } as unknown as Trial['acquisitions'][string];

  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-OI-${trialId}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['OBSERVATIONS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [{
      id: stageId, trialId, cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE',
      name: 'C12', scheduledExposureHours: 2016, status: 'VALIDATED'
    }],
    batches: [batch],
    acquisitions, auditTrail: [], mediaReferences: []
  } as Trial;
}

export function runObservationsIntegrityTests(): {
  results: ObservationsIntegrityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const ruleSet = getDefaultScientificRuleSet();
  const results: ObservationsIntegrityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  {
    const res = calculateObservations(buildObsRaw([undefined, undefined, undefined]), ruleSet);
    record('OBS-MISSING-01',
      'rating = undefined → non évalué, compté manquant, jamais 0',
      res.computed.totalEvaluated === 3 &&
      res.computed.qualityAssessment.validCount === 0 &&
      res.computed.qualityAssessment.missingCount === 3 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.defectsCount === 0 &&
      res.computed.maxRating === null &&
      res.computed.qualityAssessment.completenessPercent === 0 &&
      res.computed.protocolStatus === 'INCOMPLETE',
      'total=3, valid=0, missing=3, invalid=0, defects=0, maxRating=null, complétude=0, protocol=INCOMPLETE',
      `total=${res.computed.totalEvaluated}, valid=${res.computed.qualityAssessment.validCount}, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, defects=${res.computed.defectsCount}, maxRating=${String(res.computed.maxRating)}, complétude=${res.computed.qualityAssessment.completenessPercent}%, protocol=${res.computed.protocolStatus}`);
  }

  {
    const res = calculateObservations(buildObsRaw([null, null]), ruleSet);
    record('OBS-MISSING-02',
      'rating = null → non évalué, compté manquant, jamais 0',
      res.computed.totalEvaluated === 2 &&
      res.computed.qualityAssessment.validCount === 0 &&
      res.computed.qualityAssessment.missingCount === 2 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.maxRating === null &&
      res.computed.defectsCount === 0 &&
      res.computed.qualityAssessment.completenessPercent === 0 &&
      res.computed.protocolStatus === 'INCOMPLETE',
      'total=2, valid=0, missing=2, invalid=0, maxRating=null, defects=0, complétude=0, protocol=INCOMPLETE',
      `total=${res.computed.totalEvaluated}, valid=${res.computed.qualityAssessment.validCount}, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, maxRating=${String(res.computed.maxRating)}, defects=${res.computed.defectsCount}, complétude=${res.computed.qualityAssessment.completenessPercent}%, protocol=${res.computed.protocolStatus}`);
  }

  {
    const res = calculateObservations(buildObsRaw(['', 1, '   ', 2]), ruleSet);
    record('OBS-MISSING-03',
      'rating = "" (ou blancs) → manquant, jamais 0, complétude sur valides uniquement',
      res.computed.totalEvaluated === 4 &&
      res.computed.qualityAssessment.missingCount === 2 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.qualityAssessment.validCount === 2 &&
      res.computed.maxRating === 2 &&
      res.computed.defectsCount === 2 &&
      res.computed.qualityAssessment.completenessPercent === 50 &&
      res.computed.protocolStatus === 'INCOMPLETE',
      'total=4, missing=2 ("" et blancs), invalid=0, valid=2, maxRating=2, complétude=50%, protocol=INCOMPLETE',
      `total=${res.computed.totalEvaluated}, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, valid=${res.computed.qualityAssessment.validCount}, maxRating=${String(res.computed.maxRating)}, complétude=${res.computed.qualityAssessment.completenessPercent}%, protocol=${res.computed.protocolStatus}`);
  }

  {
    const res = calculateObservations(buildObsRaw(['abc']), ruleSet);
    record('OBS-INVALID-01',
      'rating = "abc" → INVALID + alerte MEASUREMENT_INVALID, jamais 0',
      res.computed.qualityAssessment.invalidCount === 1 &&
      res.computed.qualityAssessment.validCount === 0 &&
      res.computed.defectsCount === 0 &&
      res.computed.maxRating === null &&
      res.alerts.some((a) => a.code === 'MEASUREMENT_INVALID') &&
      res.computed.protocolStatus === 'INCOMPLETE',
      'invalid=1, valid=0, defects=0, maxRating=null, alerte MEASUREMENT_INVALID, protocol=INCOMPLETE',
      `invalid=${res.computed.qualityAssessment.invalidCount}, valid=${res.computed.qualityAssessment.validCount}, defects=${res.computed.defectsCount}, maxRating=${String(res.computed.maxRating)}, alertes=${res.alerts.map((a) => a.code).join(',')}, protocol=${res.computed.protocolStatus}`);
  }

  {
    const res = calculateObservations(buildObsRaw([NaN]), ruleSet);
    record('OBS-INVALID-02',
      'rating = NaN → INVALID + alerte, jamais 0',
      res.computed.qualityAssessment.invalidCount === 1 &&
      res.computed.qualityAssessment.validCount === 0 &&
      res.computed.maxRating === null &&
      res.alerts.some((a) => a.code === 'MEASUREMENT_INVALID'),
      'invalid=1, valid=0, maxRating=null, alerte MEASUREMENT_INVALID',
      `invalid=${res.computed.qualityAssessment.invalidCount}, valid=${res.computed.qualityAssessment.validCount}, maxRating=${String(res.computed.maxRating)}, alertes=${res.alerts.map((a) => a.code).join(',')}`);
  }

  {
    const res = calculateObservations(buildObsRaw([-1, 7, Infinity]), ruleSet);
    record('OBS-INVALID-03',
      'Valeur négative, hors domaine (7) et non finie (Infinity) → INVALID, jamais 0',
      res.computed.qualityAssessment.invalidCount === 3 &&
      res.computed.qualityAssessment.validCount === 0 &&
      res.computed.maxRating === null &&
      res.alerts.filter((a) => a.code === 'MEASUREMENT_INVALID').length === 3,
      'invalid=3, valid=0, maxRating=null, 3 alertes MEASUREMENT_INVALID',
      `invalid=${res.computed.qualityAssessment.invalidCount}, valid=${res.computed.qualityAssessment.validCount}, maxRating=${String(res.computed.maxRating)}, alertesInvalid=${res.alerts.filter((a) => a.code === 'MEASUREMENT_INVALID').length}`);
  }

  {
    const res = calculateObservations(buildObsRaw([0]), ruleSet);
    record('OBS-ZERO-01',
      'rating = 0 → VALID, vrai zéro conservé (0 réel mesuré/coté)',
      res.computed.qualityAssessment.validCount === 1 &&
      res.computed.qualityAssessment.missingCount === 0 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.maxRating === 0 &&
      res.computed.defectsCount === 0 &&
      res.computed.protocolStatus === 'STANDARD' &&
      res.computed.qualityAssessment.completenessPercent === 100 &&
      res.computed.qualityAssessment.status === 'GOOD',
      'valid=1, missing=0, invalid=0, maxRating=0, defects=0, protocol=STANDARD, complétude=100%, status=GOOD',
      `valid=${res.computed.qualityAssessment.validCount}, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, maxRating=${String(res.computed.maxRating)}, defects=${res.computed.defectsCount}, protocol=${res.computed.protocolStatus}, complétude=${res.computed.qualityAssessment.completenessPercent}%, status=${res.computed.qualityAssessment.status}`);
  }

  {
    const res = calculateObservations(buildObsRaw([0, 1, undefined, 'abc', 2]), ruleSet);
    record('OBS-MIXED-01',
      '[0, 1, undefined, "abc", 2] → valid=3, missing=1, invalid=1, max=2, le 0 reste 0',
      res.computed.totalEvaluated === 5 &&
      res.computed.qualityAssessment.validCount === 3 &&
      res.computed.qualityAssessment.missingCount === 1 &&
      res.computed.qualityAssessment.invalidCount === 1 &&
      res.computed.defectsCount === 2 &&
      res.computed.maxRating === 2 &&
      res.computed.qualityAssessment.completenessPercent === 60 &&
      res.computed.protocolStatus === 'INCOMPLETE',
      'total=5, valid=3, missing=1, invalid=1, defects=2, maxRating=2, complétude=60%, protocol=INCOMPLETE',
      `total=${res.computed.totalEvaluated}, valid=${res.computed.qualityAssessment.validCount}, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, defects=${res.computed.defectsCount}, maxRating=${String(res.computed.maxRating)}, complétude=${res.computed.qualityAssessment.completenessPercent}%, protocol=${res.computed.protocolStatus}`);
  }

  {
    const res = calculateObservations(buildObsRaw([0, 1, 2, 3, 4, 5]), ruleSet);
    record('OBS-COMPLETE-01',
      'Jeu entièrement valide → completenessPercent = 100, protocol STANDARD',
      res.computed.qualityAssessment.completenessPercent === 100 &&
      res.computed.qualityAssessment.missingCount === 0 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.protocolStatus === 'STANDARD' &&
      res.computed.maxRating === 5,
      'complétude=100%, missing=0, invalid=0, protocol=STANDARD, maxRating=5',
      `complétude=${res.computed.qualityAssessment.completenessPercent}%, missing=${res.computed.qualityAssessment.missingCount}, invalid=${res.computed.qualityAssessment.invalidCount}, protocol=${res.computed.protocolStatus}, maxRating=${String(res.computed.maxRating)}`);
  }

  {
    const res = calculateObservations(buildObsRaw([0, 1, 2, undefined]), ruleSet);
    record('OBS-INCOMPLETE-01',
      'Présence d\'une donnée manquante → completenessPercent < 100 et statut non complet',
      res.computed.qualityAssessment.completenessPercent === 75 &&
      res.computed.qualityAssessment.completenessPercent < 100 &&
      res.computed.protocolStatus === 'INCOMPLETE' &&
      res.computed.qualityAssessment.validCount === 3 &&
      res.computed.qualityAssessment.missingCount === 1,
      'complétude=75% (<100%), protocol=INCOMPLETE, valid=3, missing=1',
      `complétude=${res.computed.qualityAssessment.completenessPercent}%, protocol=${res.computed.protocolStatus}, valid=${res.computed.qualityAssessment.validCount}, missing=${res.computed.qualityAssessment.missingCount}`);
  }

  {
    const res = calculateObservations(buildObsRaw(['3']), ruleSet);
    record('OBS-STRNUM-01',
      '(bonus) Chaîne numérique « 3 » du domaine → VALID, cotation 3 conservée',
      res.computed.qualityAssessment.validCount === 1 &&
      res.computed.qualityAssessment.invalidCount === 0 &&
      res.computed.maxRating === 3 &&
      res.computed.defectsCount === 1 &&
      res.computed.qualityAssessment.status === 'WARNING',
      'valid=1, invalid=0, maxRating=3, defects=1, status=WARNING',
      `valid=${res.computed.qualityAssessment.validCount}, invalid=${res.computed.qualityAssessment.invalidCount}, maxRating=${String(res.computed.maxRating)}, defects=${res.computed.defectsCount}, status=${res.computed.qualityAssessment.status}`);
  }

  {
    const res = calculateObservations({ observations: [] }, ruleSet);
    record('OBS-EMPTY-01',
      '(bonus) Collection vide → INCOMPLETE, maxRating non évalué, alerte MEASUREMENT_MISSING, aucune série de 0',
      res.computed.totalEvaluated === 0 &&
      res.computed.maxRating === null &&
      res.computed.protocolStatus === 'INCOMPLETE' &&
      res.alerts.some((a) => a.code === 'MEASUREMENT_MISSING'),
      'total=0, maxRating=null, protocol=INCOMPLETE, alerte MEASUREMENT_MISSING',
      `total=${res.computed.totalEvaluated}, maxRating=${String(res.computed.maxRating)}, protocol=${res.computed.protocolStatus}, alertes=${res.alerts.map((a) => a.code).join(',')}`);
  }

  // ---------------------------------------------------------------
  // P1 — Comparateur multi-systèmes : « non évalué » (null), jamais 0
  // ---------------------------------------------------------------
  {
    const trial = buildComparatorTrial('oi-cmp-1', [
      { category: 'BLISTERING', rating: undefined },
      { category: 'FLAKING', rating: null },
      { category: 'CRACKING', rating: '' },
      { category: 'CHALKING', rating: '   ' }
    ]);
    const comp = compareSystemsAtStage(trial, trial.stages[0].id, ruleSet);
    const obs = comp.items[0].observations;
    record('OBS-COMPARATOR-01',
      'Aucune observation valide → cotations non évaluées (null), hasRecordedData=false, jamais 0',
      obs !== undefined &&
      obs.blisteringRating === null &&
      obs.flakingRating === null &&
      obs.crackingRating === null &&
      obs.chalkingRating === null &&
      obs.hasRecordedData === false &&
      obs.summary === 'Données non renseignées',
      'blistering=null, flaking=null, cracking=null, chalking=null, hasRecordedData=false',
      `blistering=${String(obs?.blisteringRating)}, flaking=${String(obs?.flakingRating)}, cracking=${String(obs?.crackingRating)}, chalking=${String(obs?.chalkingRating)}, hasRecordedData=${String(obs?.hasRecordedData)}`);
  }

  {
    const trial = buildComparatorTrial('oi-cmp-2', [
      { category: 'BLISTERING', rating: 0 },
      { category: 'FLAKING', rating: 0 }
    ]);
    const comp = compareSystemsAtStage(trial, trial.stages[0].id, ruleSet);
    const obs = comp.items[0].observations;
    record('OBS-COMPARATOR-02',
      'Observation réelle rating=0 → hasRecordedData=true, cotation 0 conservée',
      obs !== undefined &&
      obs.blisteringRating === 0 &&
      obs.flakingRating === 0 &&
      obs.hasRecordedData === true,
      'blistering=0, flaking=0, hasRecordedData=true',
      `blistering=${String(obs?.blisteringRating)}, flaking=${String(obs?.flakingRating)}, hasRecordedData=${String(obs?.hasRecordedData)}`);
  }

  {
    const trial = buildComparatorTrial('oi-cmp-3', [
      { category: 'BLISTERING', rating: undefined },
      { category: 'FLAKING', rating: 0 },
      { category: 'CRACKING', rating: 2 }
    ]);
    const comp = compareSystemsAtStage(trial, trial.stages[0].id, ruleSet);
    const obs = comp.items[0].observations;
    record('OBS-COMPARATOR-03',
      'Mélange non évalué / 0 / 2 → null ≠ 0 ≠ 2 conservés',
      obs !== undefined &&
      obs.blisteringRating === null &&
      obs.flakingRating === 0 &&
      obs.crackingRating === 2 &&
      obs.chalkingRating === null &&
      obs.hasRecordedData === true,
      'blistering=null, flaking=0, cracking=2, chalking=null, hasRecordedData=true',
      `blistering=${String(obs?.blisteringRating)}, flaking=${String(obs?.flakingRating)}, cracking=${String(obs?.crackingRating)}, chalking=${String(obs?.chalkingRating)}, hasRecordedData=${String(obs?.hasRecordedData)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}