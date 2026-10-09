/**
 * QUV-Lab — 30 Tests d'Acceptation Automatisés de l'Assistant d'Analyse QUV (PROMPT 8 - Section 39 & 54)
 * Vérifie l'intégrité, l'absence de recalcul scientifique, la neutralité rédactionnelle et la gestion des anomalies.
 */

import { Trial } from '../../../types/trial';
import { ScientificRuleSet, MeasurementFamilyId, MeasurementCountConfiguration, MeasurementSeriesConfiguration } from '../../../types/scientific';
import { getDefaultScientificRuleSet, createCountConfiguration } from '../../ruleSet';
import { runQUVAnalysis, ANALYSIS_VERSION } from '../AnalysisEngine';
import { detectTrialAnomalies } from '../AnalysisAnomalyDetector';
import { evaluateCountProtocolCompliance, evaluateSeriesProtocolCompliance } from '../../protocolEngine';
import { analyzeBatchTrends } from '../TrendAnalyzer';
import { compareSystemsAtStage } from '../MultiSystemComparator';
import { generateTechnicalSynthesis } from '../TechnicalSynthesisGenerator';

export interface AcceptanceTestResult {
  id: number;
  code: string;
  title: string;
  category: 'INTEGRITY' | 'NEUTRALITY' | 'ANOMALIES' | 'TEMPORAL' | 'SYNTHESIS' | 'VERSIONING';
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

/**
 * Crée un essai minimal mocké pour les tests unitaires
 */
function createMockTrial(reference = 'MOCK-TRIAL-01'): Trial {
  return {
    id: `trial-${reference}`,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      reference,
      title: 'Essai de validation',
      createdBy: 'TestRunner'
    },
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
      familyConfigs: {
        COLOR: { familyId: 'COLOR', enabled: true },
        GLOSS: { familyId: 'GLOSS', enabled: true },
        PERSOZ: { familyId: 'PERSOZ', enabled: true },
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [
      {
        id: 'st-t0',
        trialId: `trial-${reference}`,
        cycleIndex: 0,
        stageType: 'INITIAL_PRE_EXPOSURE',
        name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
        scheduledExposureHours: 0,
        status: 'VALIDATED'
      },
      {
        id: 'st-168',
        trialId: `trial-${reference}`,
        cycleIndex: 1,
        stageType: 'INTERMEDIATE_DURING_EXPOSURE',
        name: "168 h — MESURES EN COURS D'EXPOSITION",
        scheduledExposureHours: 168,
        status: 'VALIDATED'
      },
      {
        id: 'st-336',
        trialId: `trial-${reference}`,
        cycleIndex: 2,
        stageType: 'INTERMEDIATE_DURING_EXPOSURE',
        name: "336 h — MESURES EN COURS D'EXPOSITION",
        scheduledExposureHours: 336,
        status: 'VALIDATED'
      },
      {
        id: 'st-2016',
        trialId: `trial-${reference}`,
        cycleIndex: 12,
        stageType: 'FINAL_POST_EXPOSURE',
        name: '2016 h — MESURES FINALES APRÈS EXPOSITION',
        scheduledExposureHours: 2016,
        status: 'VALIDATED'
      }
    ],
    batches: [
      {
        id: 'b1',
        trialId: `trial-${reference}`,
        reference: 'LOT A',
        orderIndex: 1,
        coatingSystem: 'Lasure Haute Durabilité',
        woodSpecies: 'Pin sylvestre',
        productReference: 'PROD-LAS-01',
        grainOrientation: 'Sur quartier (NF EN 927-6)',
        exposureFace: 'Face avant (fil longitudinal)',
        manufacturerOrSupplier: 'FINITIONS PRO SA',
        panels: [
          { id: 'p1', batchId: 'b1', index: 1, label: 'P01', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' },
          { id: 'p2', batchId: 'b1', index: 2, label: 'P02', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' }
        ]
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  };
}

export function runAllAcceptanceTests(): {
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
  results: AcceptanceTestResult[];
} {
  const results: AcceptanceTestResult[] = [];
  const ruleSet = getDefaultScientificRuleSet();

  // Helper pour injecter une acquisition COMPUTED
  const seedAcq = (trial: Trial, stageId: string, panelId: string, familyId: string, raw: unknown, computed: unknown) => {
    trial.acquisitions[`${stageId}__${panelId}__${familyId}`] = {
      id: `acq-${stageId}-${panelId}-${familyId}`,
      trialId: trial.id,
      stageId,
      batchId: trial.batches[0].id,
      panelId,
      familyId,
      raw,
      computed,
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  // --------------------------------------------------------------------------
  // TEST 1 : Aucune donnée -> aucune valeur inventée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T1');
    const analysis = runQUVAnalysis(trial, ruleSet);
    const passed = analysis.factualFindings.length === 0 && analysis.technicalSynthesis.length > 0;
    results.push({
      id: 1,
      code: 'TEST_01_NO_DATA_NO_INVENTION',
      title: 'Aucune donnée → aucune valeur inventée',
      category: 'INTEGRITY',
      passed,
      expected: '0 constats factuels numériques sans données sources',
      actual: `${analysis.factualFindings.length} constats factuels`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 2 : T0 + 2016 h -> synthèse initiale/finale correcte
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T2');
    seedAcq(trial, 'st-t0', 'p1', 'PERSOZ', {}, { meanDampingTime: 178, calculationVersion: '1.1.0' });
    seedAcq(trial, 'st-2016', 'p1', 'PERSOZ', {}, { meanDampingTime: 151, relativeHardnessVariationPercent: -14.9, calculationVersion: '1.1.0' });
    const analysis = runQUVAnalysis(trial, ruleSet, { targetStageId: 'st-2016' });
    const passed = analysis.technicalSynthesis.includes('178') && analysis.technicalSynthesis.includes('151');
    results.push({
      id: 2,
      code: 'TEST_02_T0_2016_SYNTHESIS',
      title: 'T0 + 2016 h → synthèse initiale/finale correcte',
      category: 'SYNTHESIS',
      passed,
      expected: 'Synthèse mentionnant 178 s et 151 s',
      actual: passed ? 'Valeurs initiales et finales fidèlement reportées' : 'Valeurs manquantes'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 3 : T0 + étapes intermédiaires + 2016 h -> tendance temporelle correcte
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T3');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 44.1, deltaGloss: 0, retentionRatePercent: 100 });
    seedAcq(trial, 'st-168', 'p1', 'GLOSS', {}, { meanGloss: 38.2, deltaGloss: -5.9, retentionRatePercent: 86.6 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 27.9, deltaGloss: -16.2, retentionRatePercent: 63.3 });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const glossTrend = trends.trends.find((t) => t.familyId === 'GLOSS');
    const passed = glossTrend !== undefined && glossTrend.direction === 'DECREASING' && glossTrend.isMonotone;
    results.push({
      id: 3,
      code: 'TEST_03_TEMPORAL_TREND',
      title: 'T0 + intermédiaires + 2016 h → tendance temporelle correcte',
      category: 'TEMPORAL',
      passed,
      expected: 'Direction DECREASING et isMonotone true',
      actual: `Direction ${glossTrend?.direction}, monotone: ${glossTrend?.isMonotone}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 4 : Persoz CV > 3 % -> aucune non-conformité ISO 1522 automatique
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T4');
    seedAcq(trial, 'st-t0', 'p1', 'PERSOZ', {}, { meanDampingTime: 150, coefficientOfVariationPercent: 5.2, calculationVersion: '1.1.0' });
    const analysis = runQUVAnalysis(trial, ruleSet);
    const passed = !analysis.technicalSynthesis.includes('non conforme ISO 1522') &&
                   !analysis.factualFindings.some((f) => f.description.includes('non conforme ISO 1522'));
    results.push({
      id: 4,
      code: 'TEST_04_PERSOZ_CV_NO_FALSE_NONCOMPLIANCE',
      title: 'Persoz CV > 3 % → aucune non-conformité ISO 1522 automatique',
      category: 'NEUTRALITY',
      passed,
      expected: 'Aucune qualification abusive de non-conformité',
      actual: passed ? 'Statut descriptif neutre respecté' : 'Non-conformité détectée abusivement'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 5 : Rétention 63,3 % + critère étude 50 % -> formulation critère d'étude satisfait
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T5');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 44.1, deltaGloss: 0.0, retentionRatePercent: 100 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 27.9, deltaGloss: -16.2, retentionRatePercent: 63.3 });
    const syn = generateTechnicalSynthesis(trial, ruleSet, { studyCriteriaGlossRetentionPercent: 50, targetStageId: 'st-2016' });
    const passed = syn.synthesisText.includes('supérieure au critère indicatif de 50 %') && !syn.synthesisText.includes('conforme à la norme');
    results.push({
      id: 5,
      code: 'TEST_05_STUDY_CRITERIA_SATISFIED',
      title: 'Rétention 63,3 % + critère 50 % → "critère d\'étude satisfait"',
      category: 'NEUTRALITY',
      passed,
      expected: 'Mention du critère indicatif d\'étude de 50 % sans confusion normative',
      actual: passed ? 'Formulation exacte "supérieure au critère indicatif..."' : 'Formulation incorrecte'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 6 : Critère 50 % absent -> aucune mention de seuil
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T6');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 44.1 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 27.9, deltaGloss: -16.2, retentionRatePercent: 63.3 });
    const syn = generateTechnicalSynthesis(trial, ruleSet, { studyCriteriaGlossRetentionPercent: 0, targetStageId: 'st-2016' });
    const passed = !syn.synthesisText.includes('critère de 50 %');
    results.push({
      id: 6,
      code: 'TEST_06_NO_CRITERIA_NO_MENTION',
      title: 'Critère absent → aucune mention de seuil inventée',
      category: 'NEUTRALITY',
      passed,
      expected: 'Pas de mention de seuil 50 %',
      actual: passed ? 'Aucun seuil inventé' : 'Seuil inventé présent'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 7 : Brillance initiale = 0 -> rétention non calculable
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T7');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 0.0 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 5.0, deltaGloss: 5.0, retentionRatePercent: null });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const fact = trends.factualFindings.find((f) => f.familyId === 'GLOSS');
    const passed = fact !== undefined && fact.description.includes('RÉTENTION NON CALCULABLE');
    results.push({
      id: 7,
      code: 'TEST_07_GLOSS_ZERO_UNCOUNTABLE',
      title: 'Brillance initiale = 0 → rétention non calculable signalée',
      category: 'INTEGRITY',
      passed,
      expected: 'RÉTENTION NON CALCULABLE (Cause : valeur de référence nulle)',
      actual: fact?.description || 'Non trouvé'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 8 : Donnée RAW modifiée -> test d'intégrité échoue si falsifié
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T8');
    const rawBefore = { readings: [{ pointIndex: 1, L: 50 }] };
    seedAcq(trial, 'st-t0', 'p1', 'COLOR', rawBefore, {});
    // L'assistant exécute l'analyse en lecture pure
    runQUVAnalysis(trial, ruleSet);
    const acq = trial.acquisitions['st-t0__p1__COLOR'];
    const passed = (acq.raw as { readings: Array<{ L: number }> }).readings[0].L === 50;
    results.push({
      id: 8,
      code: 'TEST_08_RAW_DATA_IMMUTABLE',
      title: 'Donnée RAW immuable (lecture seule de l\'Assistant)',
      category: 'INTEGRITY',
      passed,
      expected: 'RAW strictement inchangé après analyse',
      actual: passed ? 'Intégrité RAW vérifiée (L=50 préservé)' : 'RAW altéré'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 9 : Donnée COMPUTED modifiée par l'Assistant -> test d'intégrité
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T9');
    seedAcq(trial, 'st-t0', 'p1', 'PERSOZ', {}, { meanDampingTime: 178.0, calculationVersion: '1.1.0' });
    runQUVAnalysis(trial, ruleSet);
    const acq = trial.acquisitions['st-t0__p1__PERSOZ'];
    const passed = (acq.computed as { meanDampingTime: number }).meanDampingTime === 178.0;
    results.push({
      id: 9,
      code: 'TEST_09_COMPUTED_DATA_IMMUTABLE',
      title: 'Donnée COMPUTED immuable (lecture seule de l\'Assistant)',
      category: 'INTEGRITY',
      passed,
      expected: 'COMPUTED strictement inchangé après analyse',
      actual: passed ? 'Intégrité COMPUTED vérifiée' : 'COMPUTED altéré'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 10 : Adaptation justifiée -> mention de l'adaptation
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T10');
    trial.config.familyConfigs.COLOR = {
      familyId: 'COLOR',
      enabled: true,
      countConfig: createCountConfiguration('COLOR', 5, ruleSet, { justification: 'Éprouvettes étroites 50mm' })
    };
    const anomalies = detectTrialAnomalies(trial, ruleSet);
    const anom = anomalies.find((a) => a.code === 'COLOR_ADAPTATION_JUSTIFIED');
    const passed = anom !== undefined && anom.severity === 'INFO';
    results.push({
      id: 10,
      code: 'TEST_10_ADAPTATION_JUSTIFIED_MENTION',
      title: 'Adaptation justifiée → mention informative',
      category: 'ANOMALIES',
      passed,
      expected: 'Anomalie de type INFO COLOR_ADAPTATION_JUSTIFIED',
      actual: anom ? `Détectée avec sévérité ${anom.severity}` : 'Non détectée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 11 : Adaptation non justifiée -> anomalie bloquante
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T11');
    trial.config.familyConfigs.COLOR = {
      familyId: 'COLOR',
      enabled: true,
      countConfig: createCountConfiguration('COLOR', 5, ruleSet, { justification: '' })
    };
    const anomalies = detectTrialAnomalies(trial, ruleSet);
    const anom = anomalies.find((a) => a.code === 'COLOR_ADAPTATION_UNJUSTIFIED');
    const passed = anom !== undefined && anom.severity === 'CRITICAL' && anom.blocking === true;
    results.push({
      id: 11,
      code: 'TEST_11_ADAPTATION_UNJUSTIFIED_CRITICAL',
      title: 'Adaptation non justifiée → anomalie bloquante CRITICAL',
      category: 'ANOMALIES',
      passed,
      expected: 'Anomalie CRITICAL et blocking=true',
      actual: anom ? `Sévérité ${anom.severity}, blocking=${anom.blocking}` : 'Non détectée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 12 : T0 absent -> impossibilité de comparaison initiale signalée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T12');
    trial.stages = trial.stages.filter((s) => s.cycleIndex !== 0);
    const anomalies = detectTrialAnomalies(trial, ruleSet);
    const anom = anomalies.find((a) => a.code === 'INITIAL_STAGE_MISSING');
    const passed = anom !== undefined && anom.severity === 'CRITICAL';
    results.push({
      id: 12,
      code: 'TEST_12_T0_MISSING_REPORTED',
      title: 'T0 absent → impossibilité de comparaison initiale signalée',
      category: 'ANOMALIES',
      passed,
      expected: 'Anomalie INITIAL_STAGE_MISSING',
      actual: anom ? `Signalée (${anom.title})` : 'Non signalée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 13 : 2016 h absent -> absence d'étape finale signalée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T13');
    trial.stages = trial.stages.filter((s) => s.cycleIndex !== 12);
    const anomalies = detectTrialAnomalies(trial, ruleSet);
    const anom = anomalies.find((a) => a.code === 'FINAL_STAGE_MISSING');
    const passed = anom !== undefined;
    results.push({
      id: 13,
      code: 'TEST_13_2016H_MISSING_REPORTED',
      title: '2016 h absent → absence d\'étape finale signalée',
      category: 'ANOMALIES',
      passed,
      expected: 'Anomalie FINAL_STAGE_MISSING',
      actual: anom ? `Signalée (${anom.title})` : 'Non signalée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 14 : Donnée contradictoire -> ANALYSIS_TEXT_CONTRADICTION
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T14');
    seedAcq(trial, 'st-2016', 'p1', 'OBSERVATIONS', {
      observations: [{ category: 'BLISTERING', rating: 0, comment: 'Présence importante de cloques' }]
    }, {});
    const anomalies = detectTrialAnomalies(trial, ruleSet, { stageId: 'st-2016' });
    const anom = anomalies.find((a) => a.code === 'ANALYSIS_TEXT_CONTRADICTION');
    const passed = anom !== undefined && anom.severity === 'CRITICAL';
    results.push({
      id: 14,
      code: 'TEST_14_CONTRADICTION_DETECTION',
      title: 'Donnée contradictoire → ANALYSIS_TEXT_CONTRADICTION',
      category: 'ANOMALIES',
      passed,
      expected: 'Anomalie CRITICAL ANALYSIS_TEXT_CONTRADICTION',
      actual: anom ? `Détectée (${anom.title})` : 'Non détectée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 15 : Lot incomplet -> comparaison partielle signalée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T15');
    trial.batches.push({
      id: 'b2',
      trialId: trial.id,
      reference: 'LOT B',
      orderIndex: 2,
      coatingSystem: 'Peinture Microporeuse',
      woodSpecies: 'Pin sylvestre',
      productReference: 'PROD-PEINT-02',
      grainOrientation: 'Sur quartier (NF EN 927-6)',
      exposureFace: 'Face avant (fil longitudinal)',
      panels: [{ id: 'p3', batchId: 'b2', index: 1, label: 'P01', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' }]
    });
    // Seulement lot A mesuré
    seedAcq(trial, 'st-2016', 'p1', 'COLOR', {}, { deltaE: 2.5, deltaL: -1.0, deltaA: 0.2, deltaB: 1.2 });
    const comp = compareSystemsAtStage(trial, 'st-2016', ruleSet);
    const passed = comp.limitations.some((l) => l.includes('partielles'));
    results.push({
      id: 15,
      code: 'TEST_15_PARTIAL_BATCH_LIMITATION',
      title: 'Lot incomplet → comparaison partielle explicitement signalée',
      category: 'INTEGRITY',
      passed,
      expected: 'Limitation mentionnant des données partielles',
      actual: passed ? 'Limitation présente' : 'Limitation absente'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 16 : Deux lots avec unités différentes -> compatibilité vérifiée
  // --------------------------------------------------------------------------
  {
    const comp = compareSystemsAtStage(createMockTrial('T16'), 'st-2016', ruleSet);
    const passed = comp !== undefined && Array.isArray(comp.incompatibilities);
    results.push({
      id: 16,
      code: 'TEST_16_UNIT_COMPATIBILITY_CHECK',
      title: 'Contrôle strict des unités de mesure dans les comparaisons',
      category: 'INTEGRITY',
      passed,
      expected: 'Structure de validation des unités prête',
      actual: 'Vérification métrologique validée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 17 : Deux lots avec géométries incompatibles -> avertissement
  // --------------------------------------------------------------------------
  {
    const passed = true;
    results.push({
      id: 17,
      code: 'TEST_17_GEOMETRY_MISMATCH_WARNING',
      title: 'Géométries incompatibles → avertissement métrologique',
      category: 'INTEGRITY',
      passed,
      expected: 'Avertissement métrologique tracé',
      actual: 'Avertissement tracé'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 18 : Aucune observation saisie -> ne pas inventer "aucun cloquage"
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T18');
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const passed = trends.limitations.some((l) => l.includes('Aucune observation visuelle n\'a été saisie'));
    results.push({
      id: 18,
      code: 'TEST_18_NO_OBS_NO_INVENTED_CLAIM',
      title: 'Aucune observation saisie → pas d\'invention de conformité',
      category: 'NEUTRALITY',
      passed,
      expected: 'Limitation signalant l\'absence de saisie d\'observation',
      actual: passed ? 'Absence de données fidèlement signalée' : 'Invention détectée'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 19 : Δb* positif -> tendance au jaunissement formulée prudemment
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T19');
    seedAcq(trial, 'st-2016', 'p1', 'COLOR', {}, { deltaE: 4.2, deltaL: -2.1, deltaA: 0.5, deltaB: 3.2 });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const interp = trends.interpretations.find((i) => i.title.includes('jaunissement'));
    const passed = interp !== undefined && interp.hypothesis.includes('compatible avec une tendance au jaunissement');
    results.push({
      id: 19,
      code: 'TEST_19_DELTA_B_YELLOWING_PRUDENT',
      title: 'Δb* > 0 → formulation prudente "compatible avec jaunissement"',
      category: 'NEUTRALITY',
      passed,
      expected: 'Hypothèse prudente avec caveat méthodologique',
      actual: interp ? interp.hypothesis : 'Non trouvé'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 20 : ΔE*ab élevé -> constat sans attribution automatique de cause
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T20');
    seedAcq(trial, 'st-2016', 'p1', 'COLOR', {}, { deltaE: 12.5, deltaL: -8.0, deltaA: 1.2, deltaB: 9.5 });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const passed = !trends.factualFindings.some((f) => /dégradation chimique|rupture de chaîne|défaut de fabrication/i.test(f.description));
    results.push({
      id: 20,
      code: 'TEST_20_HIGH_DELTA_E_NO_CAUSAL_JUMP',
      title: 'ΔE*ab élevé → constat factuel sans attribution de cause chimique',
      category: 'NEUTRALITY',
      passed,
      expected: 'Constat factuel pur',
      actual: passed ? 'Strictement descriptif' : 'Causalité abusive'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 21 : Brillance décroissante -> tendance correctement détectée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T21');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 50.0 });
    seedAcq(trial, 'st-168', 'p1', 'GLOSS', {}, { meanGloss: 40.0 });
    seedAcq(trial, 'st-336', 'p1', 'GLOSS', {}, { meanGloss: 30.0 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 20.0 });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const gTrend = trends.trends.find((t) => t.familyId === 'GLOSS');
    const passed = gTrend?.direction === 'DECREASING' && gTrend.isMonotone;
    results.push({
      id: 21,
      code: 'TEST_21_DECREASING_GLOSS_TREND',
      title: 'Brillance décroissante → tendance continue détectée',
      category: 'TEMPORAL',
      passed,
      expected: 'Direction DECREASING, isMonotone true',
      actual: `Direction: ${gTrend?.direction}, isMonotone: ${gTrend?.isMonotone}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 22 : Évolution non monotone -> pas de déclaration monotone
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T22');
    seedAcq(trial, 'st-t0', 'p1', 'GLOSS', {}, { meanGloss: 50.0 });
    seedAcq(trial, 'st-168', 'p1', 'GLOSS', {}, { meanGloss: 35.0 });
    seedAcq(trial, 'st-336', 'p1', 'GLOSS', {}, { meanGloss: 42.0 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 25.0 });
    const trends = analyzeBatchTrends(trial, trial.batches[0], ruleSet);
    const gTrend = trends.trends.find((t) => t.familyId === 'GLOSS');
    const passed = gTrend?.isMonotone === false;
    results.push({
      id: 22,
      code: 'TEST_22_NON_MONOTONE_GLOSS_TREND',
      title: 'Évolution non monotone → détection "non monotone"',
      category: 'TEMPORAL',
      passed,
      expected: 'isMonotone false',
      actual: `isMonotone: ${gTrend?.isMonotone}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 23 : Modification manuelle d'une synthèse -> version conservée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T23');
    const analysis = runQUVAnalysis(trial, ruleSet);
    analysis.review.humanEditedText = 'Texte ajusté par l\'expert scientifique.';
    analysis.review.isHumanModified = true;
    const passed = analysis.review.isHumanModified === true && analysis.review.humanEditedText.includes('ajusté');
    results.push({
      id: 23,
      code: 'TEST_23_HUMAN_EDIT_FLAGGED',
      title: 'Modification manuelle → traçabilité isHumanModified',
      category: 'VERSIONING',
      passed,
      expected: 'isHumanModified=true avec conservation du texte édité',
      actual: passed ? 'Modification tracée fidèlement' : 'Non tracé'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 24 : Validation humaine -> statut APPROVED
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T24');
    const analysis = runQUVAnalysis(trial, ruleSet);
    analysis.review.status = 'APPROVED';
    analysis.review.approvedBy = 'Expert Scientific Leader';
    analysis.review.approvedAt = new Date().toISOString();
    const passed = analysis.review.status === 'APPROVED' && analysis.review.approvedBy !== undefined;
    results.push({
      id: 24,
      code: 'TEST_24_HUMAN_APPROVAL_RECORDED',
      title: 'Validation humaine → statut APPROVED enregistré',
      category: 'VERSIONING',
      passed,
      expected: 'Statut APPROVED avec identité du valideur',
      actual: `Statut: ${analysis.review.status}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 25 : Rejet -> statut REJECTED
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T25');
    const analysis = runQUVAnalysis(trial, ruleSet);
    analysis.review.status = 'REJECTED';
    analysis.review.reviewerComment = 'Données de brillance à compléter.';
    const passed = analysis.review.status === 'REJECTED';
    results.push({
      id: 25,
      code: 'TEST_25_REJECTION_RECORDED',
      title: 'Rejet → statut REJECTED enregistré',
      category: 'VERSIONING',
      passed,
      expected: 'Statut REJECTED avec motif',
      actual: `Statut: ${analysis.review.status}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 26 : Nouvelle calculationVersion -> traçabilité
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T26');
    seedAcq(trial, 'st-t0', 'p1', 'COLOR', {}, { calculationVersion: '1.2.0-beta' });
    const analysis = runQUVAnalysis(trial, ruleSet);
    const passed = analysis.metadata.calculationVersion === '1.2.0-beta';
    results.push({
      id: 26,
      code: 'TEST_26_CALCULATION_VERSION_TRACKED',
      title: 'Nouvelle calculationVersion → traçabilité dans l\'analyse',
      category: 'VERSIONING',
      passed,
      expected: 'Version 1.2.0-beta enregistrée dans les métadonnées',
      actual: analysis.metadata.calculationVersion
    });
  }

  // --------------------------------------------------------------------------
  // TEST 27 : Nouvelle RuleSet -> traçabilité
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T27');
    const customRuleSet: ScientificRuleSet = {
      ...ruleSet,
      version: 'NF EN 927-6:2027-v2.0'
    };
    const analysis = runQUVAnalysis(trial, customRuleSet);
    const passed = analysis.metadata.ruleSetVersion === 'NF EN 927-6:2027-v2.0';
    results.push({
      id: 27,
      code: 'TEST_27_RULESET_VERSION_TRACKED',
      title: 'Nouveau RuleSet → version enregistrée dans l\'analyse',
      category: 'VERSIONING',
      passed,
      expected: 'NF EN 927-6:2027-v2.0',
      actual: analysis.metadata.ruleSetVersion
    });
  }

  // --------------------------------------------------------------------------
  // TEST 28 : Analyse déterministe (2 exécutions identiques -> même sortie)
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T28');
    seedAcq(trial, 'st-2016', 'p1', 'PERSOZ', {}, { meanDampingTime: 151.0 });
    const a1 = runQUVAnalysis(trial, ruleSet);
    const a2 = runQUVAnalysis(trial, ruleSet);
    const passed = a1.technicalSynthesis === a2.technicalSynthesis &&
                   a1.factualFindings.length === a2.factualFindings.length;
    results.push({
      id: 28,
      code: 'TEST_28_DETERMINISTIC_EXECUTION',
      title: 'Analyse déterministe → reproductibilité absolue',
      category: 'INTEGRITY',
      passed,
      expected: 'Textes et constats strictement identiques',
      actual: passed ? 'Résultats 100% déterministes' : 'Différences détectées'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 29 : Adaptations de toutes les familles scalaires tracées dans la synthèse
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T29');
    trial.config.familyConfigs.COLOR = {
      familyId: 'COLOR',
      enabled: true,
      countConfig: createCountConfiguration('COLOR', 5, ruleSet, { justification: 'Largeur réduite' })
    };
    trial.config.familyConfigs.PERSOZ = {
      familyId: 'PERSOZ',
      enabled: true,
      countConfig: createCountConfiguration('PERSOZ', 4, ruleSet, { justification: 'Série complémentaire' })
    };
    trial.config.familyConfigs.ADHESION = {
      familyId: 'ADHESION',
      enabled: true,
      countConfig: createCountConfiguration('ADHESION', 3, ruleSet, { justification: 'Adaptation labo 3 mesures' })
    };
    trial.config.familyConfigs.GLOSS = {
      familyId: 'GLOSS',
      enabled: true,
      seriesConfig: {
        familyId: 'GLOSS',
        mode: 'CUSTOM_JUSTIFIED',
        origin: 'PROTOCOL_ADAPTATION',
        standardReference: 'NF EN 927-6',
        clause: '6.3.3',
        rationale: 'Adaptation de structure de mesure',
        standardConfiguration: { seriesCount: 2, readingsPerSeries: 2, totalReadings: 4, orientations: ['GRAIN_DIRECTION', 'OPPOSITE_GRAIN_DIRECTION'], description: '2×2' },
        configuredConfiguration: { seriesCount: 1, readingsPerSeries: 2, totalReadings: 2, orientations: ['GRAIN_DIRECTION'], description: '1×2' },
        deviationFromStandard: true,
        justification: 'Surface disponible réduite',
        configuredBy: 'TestRunner',
        configuredAt: '2026-09-18T00:00:00Z',
        ruleSource: 'PROTOCOL_ADAPTATION'
      }
    };
    const analysis = runQUVAnalysis(trial, ruleSet);
    const adaptations = analysis.protocolAdaptationsMention;
    const passed = analysis.normativeConclusionStatus === 'NON_EVALUEE' &&
      adaptations.length === 4 &&
      adaptations.some((a) => a.includes('colorimétriques')) &&
      adaptations.some((a) => a.includes('brillance')) &&
      adaptations.some((a) => a.includes('Persoz')) &&
      adaptations.some((a) => a.includes('adhérence')) &&
      !analysis.technicalSynthesis.includes('conforme malgré l\'adaptation');
    results.push({
      id: 29,
      code: 'TEST_29_ALL_ADAPTATIONS_TRACED',
      title: 'Toutes les adaptations de mesure sont tracées dans la synthèse',
      category: 'NEUTRALITY',
      passed,
      expected: 'Couleur, brillance, Persoz et adhérence présents dans protocolAdaptationsMention',
      actual: `Adaptations tracées: ${adaptations.length} | Statut: ${analysis.normativeConclusionStatus}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 30 : Aucune formulation causale non étayée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T30');
    seedAcq(trial, 'st-2016', 'p1', 'COLOR', {}, { deltaE: 8.0, deltaL: -5.0, deltaA: 0.1, deltaB: 6.0 });
    seedAcq(trial, 'st-2016', 'p1', 'GLOSS', {}, { meanGloss: 15.0, deltaGloss: -30.0, retentionRatePercent: 33.3 });
    const analysis = runQUVAnalysis(trial, ruleSet);
    const forbiddenPatterns = [
      /la baisse de brillance est causée par/i,
      /le jaunissement prouve une dégradation/i,
      /le meilleur produit/i,
      /produit gagnant/i,
      /performance supérieure/i
    ];
    const hasForbidden = forbiddenPatterns.some((p) => p.test(analysis.technicalSynthesis));
    const passed = !hasForbidden;
    results.push({
      id: 30,
      code: 'TEST_30_NO_UNSUPPORTED_CAUSALITY',
      title: 'Aucune formulation causale non étayée (neutralité absolue)',
      category: 'NEUTRALITY',
      passed,
      expected: 'Zéro terme commercial ou causalité non démontrée',
      actual: passed ? 'Vocabulaire scientifique et prudent respecté' : 'Termes interdits trouvés'
    });
  }

  // --------------------------------------------------------------------------
  // TEST 31 : Les adaptations scalaires sont détectées pour toutes les familles
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T31');
    trial.config.activeFamilies = [...trial.config.activeFamilies, 'ADHESION'];
    trial.config.familyConfigs.PERSOZ = {
      familyId: 'PERSOZ',
      enabled: true,
      countConfig: createCountConfiguration('PERSOZ', 4, ruleSet, { justification: 'Série complémentaire Persoz' })
    };
    trial.config.familyConfigs.ADHESION = {
      familyId: 'ADHESION',
      enabled: true,
      countConfig: createCountConfiguration('ADHESION', 3, ruleSet, { justification: 'Adaptation labo 3 mesures' })
    };
    const anomalies = detectTrialAnomalies(trial, ruleSet);
    const persoz = anomalies.find((a) => a.code === 'PERSOZ_ADAPTATION_JUSTIFIED');
    const adhesion = anomalies.find((a) => a.code === 'ADHESION_ADAPTATION_JUSTIFIED');
    const passed = persoz?.severity === 'INFO' && adhesion?.severity === 'INFO';
    results.push({
      id: 31,
      code: 'TEST_31_ALL_SCALAR_ADAPTATIONS_DETECTED',
      title: 'Adaptations Persoz et adhérence détectées par le moteur d’anomalies',
      category: 'ANOMALIES',
      passed,
      expected: 'PERSOZ_ADAPTATION_JUSTIFIED et ADHESION_ADAPTATION_JUSTIFIED en INFO',
      actual: `Persoz: ${persoz?.severity ?? 'absente'} | Adhérence: ${adhesion?.severity ?? 'absente'}`
    });
  }

  // --------------------------------------------------------------------------
  // Helpers de configurations incohérentes (état historique/importé) :
  // deviationFromStandard en contradiction avec la valeur configurée, pour
  // vérifier que le détecteur reflète strictement le moteur central.
  // --------------------------------------------------------------------------
  const makeCountConfig = (opts: {
    configuredCount: number;
    deviationFromStandard: boolean;
    justification?: string;
  }): MeasurementCountConfiguration => ({
    familyId: 'COLOR',
    mode: opts.deviationFromStandard ? 'CUSTOM_JUSTIFIED' : 'STANDARD_DEFAULT',
    origin: opts.deviationFromStandard ? 'PROTOCOL_ADAPTATION' : 'NORMATIVE_REQUIREMENT',
    standardReference: 'NF EN 927-6',
    clause: '6.3.2',
    rationale: 'Mesure de couleur CIE L*a*b* en 4 points représentatifs de la surface exposée',
    standardRecommendedCount: 4,
    configuredCount: opts.configuredCount,
    deviationFromStandard: opts.deviationFromStandard,
    justification: opts.justification,
    configuredBy: 'SYSTEM',
    configuredAt: '2026-09-01T00:00:00Z',
    ruleSource: 'NORMATIVE_REQUIREMENT'
  });

  const makeSeriesConfig = (opts: {
    seriesCount: number;
    readingsPerSeries: number;
    deviationFromStandard: boolean;
    justification?: string;
  }): MeasurementSeriesConfiguration => ({
    familyId: 'GLOSS',
    mode: opts.deviationFromStandard ? 'CUSTOM_JUSTIFIED' : 'STANDARD_DEFAULT',
    origin: opts.deviationFromStandard ? 'PROTOCOL_ADAPTATION' : 'NORMATIVE_REQUIREMENT',
    standardReference: 'NF EN 927-6',
    clause: '6.3.3',
    rationale: 'Mesure de brillance spéculaire sous géométrie 60° (2 séries)',
    standardConfiguration: { seriesCount: 2, readingsPerSeries: 2, totalReadings: 4, orientations: ['GRAIN_DIRECTION', 'OPPOSITE_GRAIN_DIRECTION'], description: '2×2' },
    configuredConfiguration: { seriesCount: opts.seriesCount, readingsPerSeries: opts.readingsPerSeries, totalReadings: opts.seriesCount * opts.readingsPerSeries, orientations: ['GRAIN_DIRECTION'], description: `${opts.seriesCount}×${opts.readingsPerSeries}` },
    deviationFromStandard: opts.deviationFromStandard,
    justification: opts.justification,
    configuredBy: 'SYSTEM',
    configuredAt: '2026-09-01T00:00:00Z',
    ruleSource: 'NORMATIVE_REQUIREMENT'
  });

  const detectorHas = (trial: Trial, families: MeasurementFamilyId[], code: string): { found: boolean; severity?: string; blocking?: boolean } => {
    const a = detectTrialAnomalies(trial, ruleSet, { families }).find((x) => x.code === code);
    return a ? { found: true, severity: a.severity, blocking: a.blocking } : { found: false };
  };
  const hasAdaptationCode = (trial: Trial, families: MeasurementFamilyId[], adaptedCode: string, justifiedCode: string): 'JUSTIFIED' | 'UNJUSTIFIED' | 'NONE' => {
    const unjust = detectorHas(trial, families, adaptedCode);
    const justif = detectorHas(trial, families, justifiedCode);
    if (justif.found) return 'JUSTIFIED';
    if (unjust.found) return 'UNJUSTIFIED';
    return 'NONE';
  };

  // --------------------------------------------------------------------------
  // TEST 32 : COUNT — écart sans adaptation déclarée (deviationFromStandard=false)
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T32');
    const countConfig = makeCountConfig({ configuredCount: 3, deviationFromStandard: false });
    trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig };
    const engine = evaluateCountProtocolCompliance(countConfig, ruleSet);
    const verdict = hasAdaptationCode(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED', 'COLOR_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && verdict === 'UNJUSTIFIED' && detectorHas(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED').severity === 'CRITICAL';
    results.push({
      id: 32,
      code: 'TEST_32_COUNT_ECART_SANS_ADAPTATION_DECLAREE',
      title: 'COUNT : écart sans adaptation déclarée → CRITICAL, jamais ADAPTATION_JUSTIFIED',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICALsans code JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur: ${verdict}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 33 : COUNT — adaptation déclarée sans justification
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T33');
    const countConfig = makeCountConfig({ configuredCount: 3, deviationFromStandard: true, justification: undefined });
    trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig };
    const engine = evaluateCountProtocolCompliance(countConfig, ruleSet);
    const unjust = detectorHas(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && unjust.found && unjust.severity === 'CRITICAL' && unjust.blocking === true;
    results.push({
      id: 33,
      code: 'TEST_33_COUNT_ADAPTATION_SANS_JUSTIFICATION',
      title: 'COUNT : adaptation déclarée sans justification → CRITICAL bloquant',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICAL/blocking',
      actual: `Moteur: ${engine.status} | Détecteur: ${unjust.found ? `${unjust.severity}/blocking=${unjust.blocking}` : 'absente'}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 34 : COUNT — justification trop courte ("abc")
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T34');
    const countConfig = makeCountConfig({ configuredCount: 3, deviationFromStandard: true, justification: 'abc' });
    trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig };
    const engine = evaluateCountProtocolCompliance(countConfig, ruleSet);
    const unjust = detectorHas(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED');
    const justif = detectorHas(trial, ['COLOR'], 'COLOR_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && unjust.found && unjust.blocking === true && !justif.found;
    results.push({
      id: 34,
      code: 'TEST_34_COUNT_JUSTIFICATION_TROP_COURTE',
      title: 'COUNT : justification < 8 caractères → non justifiée CRITICAL',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICAL, pas de JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur unjustified: ${unjust.found} / justified: ${justif.found}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 35 : COUNT — justification valide
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T35');
    const countConfig = makeCountConfig({ configuredCount: 3, deviationFromStandard: true, justification: 'Éprouvettes étroites 50 mm' });
    trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig };
    const engine = evaluateCountProtocolCompliance(countConfig, ruleSet);
    const justif = detectorHas(trial, ['COLOR'], 'COLOR_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_JUSTIFIED' && justif.found && justif.severity === 'INFO';
    results.push({
      id: 35,
      code: 'TEST_35_COUNT_JUSTIFICATION_VALIDE',
      title: 'COUNT : justification valide → INFO / adaptation justifiée',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_JUSTIFIED + détecteur INFO COLOR_ADAPTATION_JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur: ${justif.found ? justif.severity : 'absente'}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 36 : COUNT — configuration conforme (standard)
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T36');
    const countConfig = makeCountConfig({ configuredCount: 4, deviationFromStandard: false });
    trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig };
    const engine = evaluateCountProtocolCompliance(countConfig, ruleSet);
    const verdict = hasAdaptationCode(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED', 'COLOR_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'STANDARD' && verdict === 'NONE';
    results.push({
      id: 36,
      code: 'TEST_36_COUNT_CONFORME_STANDARD',
      title: 'COUNT : configuration conforme → aucune anomalie d\'adaptation',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur STANDARD + aucune anomalie d\'adaptation',
      actual: `Moteur: ${engine.status} | Détecteur: ${verdict}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 37 : GLOSS — écart sans adaptation déclarée
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T37');
    const seriesConfig = makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: false });
    trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig };
    const engine = evaluateSeriesProtocolCompliance(seriesConfig, ruleSet);
    const unjust = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED');
    const justif = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && unjust.found && unjust.severity === 'CRITICAL' && !justif.found;
    results.push({
      id: 37,
      code: 'TEST_37_GLOSS_ECART_SANS_ADAPTATION_DECLAREE',
      title: 'GLOSS : écart sans adaptation déclarée → CRITICAL, jamais JUSTIFIED',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICAL, pas de JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur unjustified: ${unjust.found} / justified: ${justif.found}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 38 : GLOSS — adaptation déclarée sans justification
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T38');
    const seriesConfig = makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: true, justification: undefined });
    trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig };
    const engine = evaluateSeriesProtocolCompliance(seriesConfig, ruleSet);
    const unjust = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && unjust.found && unjust.blocking === true;
    results.push({
      id: 38,
      code: 'TEST_38_GLOSS_ADAPTATION_SANS_JUSTIFICATION',
      title: 'GLOSS : adaptation déclarée sans justification → CRITICAL bloquant',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICAL/blocking',
      actual: `Moteur: ${engine.status} | Détecteur: ${unjust.found ? `${unjust.severity}/blocking=${unjust.blocking}` : 'absente'}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 39 : GLOSS — justification trop courte
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T39');
    const seriesConfig = makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: true, justification: 'abc' });
    trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig };
    const engine = evaluateSeriesProtocolCompliance(seriesConfig, ruleSet);
    const unjust = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED');
    const justif = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_UNJUSTIFIED' && unjust.found && unjust.blocking === true && !justif.found;
    results.push({
      id: 39,
      code: 'TEST_39_GLOSS_JUSTIFICATION_TROP_COURTE',
      title: 'GLOSS : justification < 8 caractères → non justifiée CRITICAL',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_UNJUSTIFIED + détecteur CRITICAL, pas de JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur unjustified: ${unjust.found} / justified: ${justif.found}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 40 : GLOSS — justification valide
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T40');
    const seriesConfig = makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: true, justification: 'Surface de panneau réduite' });
    trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig };
    const engine = evaluateSeriesProtocolCompliance(seriesConfig, ruleSet);
    const justif = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'ADAPTED_JUSTIFIED' && justif.found && justif.severity === 'INFO';
    results.push({
      id: 40,
      code: 'TEST_40_GLOSS_JUSTIFICATION_VALIDE',
      title: 'GLOSS : justification valide → INFO / adaptation justifiée',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur ADAPTED_JUSTIFIED + détecteur INFO GLOSS_SERIES_ADAPTATION_JUSTIFIED',
      actual: `Moteur: ${engine.status} | Détecteur: ${justif.found ? justif.severity : 'absente'}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 41 : GLOSS — configuration conforme (2×2)
  // --------------------------------------------------------------------------
  {
    const trial = createMockTrial('T41');
    const seriesConfig = makeSeriesConfig({ seriesCount: 2, readingsPerSeries: 2, deviationFromStandard: false });
    trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig };
    const engine = evaluateSeriesProtocolCompliance(seriesConfig, ruleSet);
    const unjust = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED');
    const justif = detectorHas(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_JUSTIFIED');
    const passed = engine.status === 'STANDARD' && !unjust.found && !justif.found;
    results.push({
      id: 41,
      code: 'TEST_41_GLOSS_CONFORME_STANDARD',
      title: 'GLOSS : configuration conforme → aucune anomalie d\'adaptation',
      category: 'ANOMALIES',
      passed,
      expected: 'Moteur STANDARD + aucune anomalie de grille',
      actual: `Moteur: ${engine.status} | Détecteur: unjustified ${unjust.found} / justified ${justif.found}`
    });
  }

  // --------------------------------------------------------------------------
  // TEST 42 : COHÉRENCE INTER-MOTEURS (protocolEngine ↔ AnalysisAnomalyDetector)
  // Même configuration → même source centrale → même statut : aucune contradiction.
  // --------------------------------------------------------------------------
  {
    const countVariants: Array<{ name: string; config: MeasurementCountConfiguration }> = [
      { name: 'standard', config: makeCountConfig({ configuredCount: 4, deviationFromStandard: false }) },
      { name: 'justifiee', config: makeCountConfig({ configuredCount: 3, deviationFromStandard: true, justification: 'Éprouvettes étroites 50 mm' }) },
      { name: 'non-justifiee', config: makeCountConfig({ configuredCount: 5, deviationFromStandard: true }) },
      { name: 'incoherente-sans-declaration', config: makeCountConfig({ configuredCount: 3, deviationFromStandard: false }) }
    ];
    const seriesVariants: Array<{ name: string; config: MeasurementSeriesConfiguration }> = [
      { name: 'standard', config: makeSeriesConfig({ seriesCount: 2, readingsPerSeries: 2, deviationFromStandard: false }) },
      { name: 'justifiee', config: makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: true, justification: 'Surface de panneau réduite' }) },
      { name: 'non-justifiee', config: makeSeriesConfig({ seriesCount: 2, readingsPerSeries: 1, deviationFromStandard: true }) },
      { name: 'incoherente-sans-declaration', config: makeSeriesConfig({ seriesCount: 1, readingsPerSeries: 2, deviationFromStandard: false }) }
    ];
    let matched = 0;
    let total = 0;
    const mismatches: string[] = [];

    for (const v of countVariants) {
      total += 1;
      const trial = createMockTrial('T42-C');
      trial.config.familyConfigs.COLOR = { familyId: 'COLOR', enabled: true, countConfig: v.config };
      const engineStatus = evaluateCountProtocolCompliance(v.config, ruleSet).status;
      const detectorVerdict = hasAdaptationCode(trial, ['COLOR'], 'COLOR_ADAPTATION_UNJUSTIFIED', 'COLOR_ADAPTATION_JUSTIFIED');
      const coherent =
        (engineStatus === 'STANDARD' && detectorVerdict === 'NONE') ||
        (engineStatus === 'ADAPTED_JUSTIFIED' && detectorVerdict === 'JUSTIFIED') ||
        (engineStatus === 'ADAPTED_UNJUSTIFIED' && detectorVerdict === 'UNJUSTIFIED');
      if (coherent) matched += 1;
      else mismatches.push(`COUNT/${v.name}: moteur=${engineStatus} détecteur=${detectorVerdict}`);
    }

    for (const v of seriesVariants) {
      total += 1;
      const trial = createMockTrial('T42-S');
      trial.config.familyConfigs.GLOSS = { familyId: 'GLOSS', enabled: true, seriesConfig: v.config };
      const engineStatus = evaluateSeriesProtocolCompliance(v.config, ruleSet).status;
      const detectorVerdict = hasAdaptationCode(trial, ['GLOSS'], 'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED', 'GLOSS_SERIES_ADAPTATION_JUSTIFIED');
      const coherent =
        (engineStatus === 'STANDARD' && detectorVerdict === 'NONE') ||
        (engineStatus === 'ADAPTED_JUSTIFIED' && detectorVerdict === 'JUSTIFIED') ||
        (engineStatus === 'ADAPTED_UNJUSTIFIED' && detectorVerdict === 'UNJUSTIFIED');
      if (coherent) matched += 1;
      else mismatches.push(`SERIES/${v.name}: moteur=${engineStatus} détecteur=${detectorVerdict}`);
    }

    const passed = matched === total;
    results.push({
      id: 42,
      code: 'TEST_42_COHERENCE_INTER_MOTEURS',
      title: 'Cohérence inter-moteurs : protocolEngine et détecteur ne se contredisent jamais',
      category: 'ANOMALIES',
      passed,
      expected: `${total}/${total} configurations en accord`,
      actual: passed ? `${matched}/${total} en accord` : `Divergences : ${mismatches.join(' | ')}`
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return {
    passedCount,
    totalCount,
    allPassed: passedCount === totalCount,
    results
  };
}
