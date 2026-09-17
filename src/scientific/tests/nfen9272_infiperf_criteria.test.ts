/**
 * QUV-Lab — ÉVALUATEURS DE CRITÈRES NF EN 927-2:2022 & INFIPERF / FCBA (P5)
 *
 * Vérifie :
 *   T1  — Séparation des couches : preparation sans calcul, calculations sans
 *        seuil, evaluator qui orchestre.
 *   T2  — Jalon C12 : cycle 12 / 2016 h ; C1..C11 et T0 exclus.
 *   T3  — Catégorie Stable : seuils NF EN 927-2:2022 (Blistering 0,3 |
 *        Cracking 0,7 | Flaking 0,3 | Adhesion 1,0).
 *   T4  — Adhérence : BLOCAGE Cas B documenté → INSUFFICIENT_DATA (aucune force
 *        en MPa inventée, aucune conversion de classe ISO 2409).
 *   T5  — Statuts : NOT_APPLICABLE pour catégorie non documentée
 *        (Semi-stable / Non-stable) ; INSUFFICIENT_DATA pour données
 *        manquantes (jalon absent, éprouvette absente).
 *   T6  — totalValueCheck : NOT_APPLICABLE (règles 7/12/19 et 2/3/4 jamais
 *        réintroduites) ; aucun verdict combiné (hasGlobalVerdict: false).
 *   T7  — INFIPERF indépendant : seuil lu depuis le RuleSet, FAVORABLE /
 *        DEFAVORABLE au seuil, NOT_APPLICABLE sans seuil, INSUFFICIENT_DATA
 *        sans données. Indépendance NF/INFIPERF : FAVORABLE + DEFAVORABLE.
 *   T8  — Notice COMPLEMENTARY obligatoire sur les deux évaluateurs.
 *
 * Aucun accès à RAW/COMPUTED : évaluations en lecture seule.
 * Aucun pixel des moteurs (gloss/adhesion/observations) modifié.
 */

import {
  getDefaultScientificRuleSet
} from '../ruleSet';
import { Trial } from '../../types/trial';
import { evaluateNf9272Criteria, compareNf9272Mean } from '../criteria/en927/en9272Evaluator';
import { findNf9272Jalon, prepareNf9272DefectData, prepareNf9272AdhesionData } from '../criteria/en927/en9272Preparation';
import { defectMean, specimenAdhesionMean, systemAdhesionMean } from '../criteria/en927/en9272Calculations';
import { getNf9272CategoryRequirements } from '../criteria/en927/en9272Requirements';
import {
  evaluateInfiperfGlossRetention,
  compareInfiperfRetention
} from '../criteria/infiperf/infiperfEvaluator';
import { meanRetentionRate } from '../criteria/infiperf/infiperfCalculations';
import { getInfiperfGlossRetentionThreshold } from '../criteria/infiperf/infiperfRequirements';

export interface NfEn9272InfiperfTestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runNfEn9272InfiperfTests(): {
  results: NfEn9272InfiperfTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: NfEn9272InfiperfTestResult[] = [];
  const ruleSet = getDefaultScientificRuleSet();
  const record = (id: number, name: string, category: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, category, passed, expected, actual });
  };

  // ----------------------------------------------------------------------------
  // Fixtures
  // ----------------------------------------------------------------------------
  const C12_STAGE_ID = 'st-2016';
  const C11_STAGE_ID = 'st-1848';

  const P_E1 = { id: 'p-e1', batchId: 'b1', index: 1, label: 'E1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' } as const;
  const P_E2 = { id: 'p-e2', batchId: 'b1', index: 2, label: 'E2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' } as const;
  const P_E3 = { id: 'p-e3', batchId: 'b1', index: 3, label: 'E3', role: 'EXPOSED_3', roleCode: 'E3', status: 'ACTIVE' } as const;
  const P_T = { id: 'p-t', batchId: 'b1', index: 4, label: 'T', role: 'WITNESS', roleCode: 'T', status: 'ACTIVE' } as const;

  const createTrial = (overrides?: {
    stages?: Trial['stages'];
    acquisitions?: Trial['acquisitions'];
  }): Trial => ({
    id: 'trial-nf9272',
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { reference: 'NF9272-P5', title: 'Essai NF EN 927-2', createdBy: 'TestRunner' },
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS', 'ADHESION'],
      familyConfigs: {
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true },
        GLOSS: { familyId: 'GLOSS', enabled: true },
        ADHESION: { familyId: 'ADHESION', enabled: true }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: overrides?.stages ??
      [
        { id: C12_STAGE_ID, trialId: 'trial-nf9272', cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: '2016 h', scheduledExposureHours: 2016, status: 'VALIDATED' }
      ],
    batches: [
      {
        id: 'b1',
        trialId: 'trial-nf9272',
        reference: 'LOT A',
        orderIndex: 1,
        coatingSystem: 'Lasure',
        woodSpecies: 'Pin',
        productReference: 'PROD-01',
        panels: [P_T, P_E1, P_E2, P_E3]
      }
    ],
    acquisitions: overrides?.acquisitions ?? {},
    auditTrail: [],
    mediaReferences: []
  });

  const seedObservation = (
    trial: Trial,
    stageId: string,
    panelId: string,
    perCategoryMaxRating: Record<string, number>
  ) => {
    const key = `${stageId}__${panelId}__OBSERVATIONS`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId: 'b1',
      panelId,
      familyId: 'OBSERVATIONS',
      raw: {},
      computed: { perCategoryMaxRating },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedGloss = (trial: Trial, stageId: string, panelId: string, retentionRatePercent: number | null) => {
    const key = `${stageId}__${panelId}__GLOSS`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId: 'b1',
      panelId,
      familyId: 'GLOSS',
      raw: {},
      computed: { retentionRatePercent },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedFullDefects = (trial: Trial, ratings: { blistering?: number; cracking?: number; flaking?: number }) => {
    for (const panel of [P_E1, P_E2, P_E3]) {
      seedObservation(trial, C12_STAGE_ID, panel.id, {
        BLISTERING: ratings.blistering ?? 0,
        CRACKING: ratings.cracking ?? 0,
        FLAKING: ratings.flaking ?? 0
      });
    }
  };

  // ----------------------------------------------------------------------------
  // T1 — SÉPARATION DES COUCHES
  // ----------------------------------------------------------------------------
  {
    // Preparation : aucun calcul présent dans les fonctions de préparation.
    const adhesionPrepared = prepareNf9272AdhesionData(createTrial(), { id: C12_STAGE_ID, cycleIndex: 12, scheduledExposureHours: 2016 } as unknown as Trial['stages'][number]);
    const prepIsPure =
      typeof adhesionPrepared.available === 'boolean' &&
      adhesionPrepared.available === false &&
      adhesionPrepared.reason === 'FORCE_MEASURES_ABSENT';

    record(
      1,
      'T1 Adaptation adhérence : préparation signale le BLOCAGE Cas B sans fabriquer de donnée',
      'CRITERE_SEPARATION',
      prepIsPure,
      'available=false, reason=FORCE_MEASURES_ABSENT',
      `available=${String(adhesionPrepared.available)}, reason=${adhesionPrepared.reason}`
    );
  }

  // ----------------------------------------------------------------------------
  // T2 — JALON C12 UNIQUE
  // ----------------------------------------------------------------------------
  {
    // Jalon absent (C11, T0).
    const trialNoC12 = createTrial({
      stages: [
        { id: 'st-t0', trialId: 'trial-nf9272', cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE', name: 'T0', scheduledExposureHours: 0, status: 'VALIDATED' },
        { id: C11_STAGE_ID, trialId: 'trial-nf9272', cycleIndex: 11, stageType: 'INTERMEDIATE_DURING_EXPOSURE', name: '1848 h', scheduledExposureHours: 1848, status: 'VALIDATED' }
      ]
    });
    const jalon = findNf9272Jalon(trialNoC12);
    const evaluated = evaluateNf9272Criteria(trialNoC12);

    record(
      2,
      'T2 Jalon C12 absent (seulement T0 et C11) : jalon null et critères INSUFFICIENT_DATA',
      'JALON_C12',
      jalon === null && evaluated.jalon.stageId === null && evaluated.results.BLISTERING.status === 'INSUFFICIENT_DATA',
      'jalon=null, BLISTERING=INSUFFICIENT_DATA',
      `jalon=${String(jalon)}, jalonIsNull=${evaluated.jalon.stageId === null}, BLISTERING=${evaluated.results.BLISTERING.status}`
    );

    // C12 présent.
    const trialC12 = createTrial();
    const jalonC12 = findNf9272Jalon(trialC12);
    record(
      3,
      'T2 Jalon C12 retenu (cycle 12, 2016 h)',
      'JALON_C12',
      jalonC12 !== null && jalonC12.cycleIndex === 12 && jalonC12.scheduledExposureHours === 2016,
      'cycleIndex=12, exposureHours=2016',
      `cycleIndex=${String(jalonC12?.cycleIndex)}, exposureHours=${String(jalonC12?.scheduledExposureHours)}`
    );
  }

  // ----------------------------------------------------------------------------
  // T3 — CATÉGORIE STABLE : SEUILS DOCUMENTÉS
  // ----------------------------------------------------------------------------
  {
    const stable = getNf9272CategoryRequirements('STABLE');
    const ok =
      stable.documented &&
      stable.criteria.BLISTERING?.threshold === 0.3 &&
      stable.criteria.CRACKING?.threshold === 0.7 &&
      stable.criteria.FLAKING?.threshold === 0.3 &&
      stable.criteria.ADHESION?.threshold === 1.0;

    record(
      4,
      'T3 Seuils catégorie Stable (NF EN 927-2:2022) : 0,3 / 0,7 / 0,3 / 1,0',
      'EXIGENCES_STABLE',
      ok,
      'BLISTERING 0,3 | CRACKING 0,7 | FLAKING 0,3 | ADHESION 1,0',
      `B=${stable.criteria.BLISTERING?.threshold}, C=${stable.criteria.CRACKING?.threshold}, F=${stable.criteria.FLAKING?.threshold}, A=${stable.criteria.ADHESION?.threshold}`
    );

    const stableDirectionOk =
      stable.criteria.BLISTERING?.comparison === 'LESS_OR_EQUAL' &&
      stable.criteria.CRACKING?.comparison === 'LESS_OR_EQUAL' &&
      stable.criteria.FLAKING?.comparison === 'LESS_OR_EQUAL' &&
      stable.criteria.ADHESION?.comparison === 'GREATER_OR_EQUAL';
    record(
      5,
      'T3 Sens de comparaison Stable : défauts ≤ seuil, adhérence ≥ seuil',
      'EXIGENCES_STABLE',
      stableDirectionOk,
      'défauts LES_OR_EQUAL, adhérence GREATER_OR_EQUAL',
      `B=${stable.criteria.BLISTERING?.comparison}, A=${stable.criteria.ADHESION?.comparison}`
    );

    // Fonctions pures de calcul.
    const meanB = defectMean([0.2, 0.3, 0.4]);
    const oneDecimal = specimenAdhesionMean([1.4, 1.5]); // 1.45 → arrondi 1 décimale → 1.5
    record(
      6,
      'T3 Calculs : moyenne défauts 0,3 ; moyenne éprouvette adhérence arrondie à 1 décimale',
      'CALCULS',
      meanB === 0.3 && oneDecimal === 1.5,
      'defectMean([0.2,0.3,0.4])=0.3 ; specimenAdhesionMean([1.4,1.5])=1.45→1.5',
      `meanB=${String(meanB)}, oneDecimal=${String(oneDecimal)}`
    );
  }

  // ----------------------------------------------------------------------------
  // T4 — ADHÉRENCE : BLOCAGE CAS B
  // ----------------------------------------------------------------------------
  {
    const trial = createTrial();
    seedFullDefects(trial, {});
    const evaluated = evaluateNf9272Criteria(trial);
    const adhesion = evaluated.results.ADHESION;

    record(
      7,
      'T4 Adhérence NF EN 927-2 : INSUFFICIENT_DATA documenté (BLOCAGE Cas B, aucune force MPa)',
      'ADHERENCE_BLOCKER',
      adhesion.status === 'INSUFFICIENT_DATA' &&
        adhesion.threshold === 1.0 &&
        adhesion.value === null &&
        adhesion.message.includes('BLOCAGE'),
      'status=INSUFFICIENT_DATA, threshold=1.0, value=null, message BLOCAGE documenté',
      `status=${adhesion.status}, threshold=${String(adhesion.threshold)}, value=${String(adhesion.value)}, msg=${adhesion.message.slice(0, 60)}`
    );

    const noConversion = !adhesion.message.toLowerCase().includes('mpa')
      ? true
      : adhesion.message.includes('en MPa n’)est réalisée') || adhesion.message.includes('aucune conversion');
    record(
      8,
      'T4 Adhérence : aucune conversion de classe ISO 2409 vers une force en MPa',
      'ADHERENCE_BLOCKER',
      noConversion && adhesion.message.includes('ISO 2409'),
      'message explicite : quadrillages ISO 2409 sans force; pas de conversion',
      adhesion.message.slice(0, 100)
    );
  }

  // ----------------------------------------------------------------------------
  // T5 — STATUTS NOT_APPLICABLE / INSUFFICIENT_DATA
  // ----------------------------------------------------------------------------
  {
    // Semi-stable / Non-stable : non documentées → NOT_APPLICABLE.
    for (const category of ['SEMI_STABLE', 'NON_STABLE'] as const) {
      const trial = createTrial();
      seedFullDefects(trial, {});
      const evaluated = evaluateNf9272Criteria(trial, { category });
      const allNotApplicable =
        evaluated.results.BLISTERING.status === 'NOT_APPLICABLE' &&
        evaluated.results.CRACKING.status === 'NOT_APPLICABLE' &&
        evaluated.results.FLAKING.status === 'NOT_APPLICABLE' &&
        evaluated.results.ADHESION.status === 'NOT_APPLICABLE';

      results.push({
        id: 9 + (category === 'SEMI_STABLE' ? 0 : 1),
        name: `T5 Catégorie ${category} (non documentée) : tous critères NOT_APPLICABLE`,
        category: 'STATUTS',
        passed: allNotApplicable,
        expected: '4 × NOT_APPLICABLE (critère 2022 non documenté)',
        actual: `B=${evaluated.results.BLISTERING.status}, C=${evaluated.results.CRACKING.status}, F=${evaluated.results.FLAKING.status}, A=${evaluated.results.ADHESION.status}`
      });
    }

    // Éprouvette manquante → INSUFFICIENT_DATA.
    {
      const trial = createTrial();
      seedObservation(trial, C12_STAGE_ID, P_E1.id, { BLISTERING: 0.2, CRACKING: 0.1, FLAKING: 0.1 });
      seedObservation(trial, C12_STAGE_ID, P_E2.id, { BLISTERING: 0.3, CRACKING: 0.2, FLAKING: 0.2 });
      // E3 absente.
      const evaluated = evaluateNf9272Criteria(trial);
      const insufficient =
        evaluated.results.BLISTERING.status === 'INSUFFICIENT_DATA' &&
        evaluated.results.CRACKING.status === 'INSUFFICIENT_DATA' &&
        evaluated.results.FLAKING.status === 'INSUFFICIENT_DATA';

      record(
        11,
        'T5 Éprouvette exposée E3 absente : critères défauts INSUFFICIENT_DATA (3 éprouvettes requises)',
        'STATUTS',
        insufficient,
        '3 × INSUFFICIENT_DATA',
        `B=${evaluated.results.BLISTERING.status}, C=${evaluated.results.CRACKING.status}, F=${evaluated.results.FLAKING.status}`
      );
    }

    // Lemme : compareNf9272Mean (égalité au seuil → FAVORABLE, dépassement → DEFAVORABLE).
    {
      const eqB = compareNf9272Mean('LESS_OR_EQUAL', 0.3, 0.3);
      const overB = compareNf9272Mean('LESS_OR_EQUAL', 0.4, 0.3);
      const eqA = compareNf9272Mean('GREATER_OR_EQUAL', 1.0, 1.0);
      const underA = compareNf9272Mean('GREATER_OR_EQUAL', 0.9, 1.0);
      record(
        12,
        'T3 Égalité seuil → FAVORABLE ; dépassement → DEFAVORABLE ; adhérence sous seuil → DEFAVORABLE',
        'STATUTS',
        eqB === 'FAVORABLE' && overB === 'DEFAVORABLE' && eqA === 'FAVORABLE' && underA === 'DEFAVORABLE',
        'B=0.3→FAV, B=0.4→DEFA, A=1.0→FAV, A=0.9→DEFA',
        `eqB=${eqB}, overB=${overB}, eqA=${eqA}, underA=${underA}`
      );
    }
  }

  // ----------------------------------------------------------------------------
  // T6 — PAS DE VERDICT COMBINÉ, totalValueCheck NOT_APPLICABLE
  // ----------------------------------------------------------------------------
  {
    const trial = createTrial();
    seedFullDefects(trial, {});
    const evaluated = evaluateNf9272Criteria(trial);
    const statuses = Object.values(evaluated.results).map((r) => r.status).join(',');
    record(
      13,
      'T6 Évaluation NF EN 927-2 : résultats par critère, sans verdict global, totalValueCheck=NOT_APPLICABLE',
      'VERDICT_COMBINE',
      evaluated.hasGlobalVerdict === false &&
        evaluated.totalValueCheck === 'NOT_APPLICABLE' &&
        evaluated.complementaryNotice.length > 0,
      'hasGlobalVerdict=false, totalValueCheck=NOT_APPLICABLE, notice COMPLEMENTARY présente',
      `hasGlobalVerdict=${String(evaluated.hasGlobalVerdict)}, totalValueCheck=${evaluated.totalValueCheck}, statuses=${statuses}`
    );

    const allStatusesValid = statuses.split(',').every((s) =>
      ['FAVORABLE', 'DEFAVORABLE', 'NOT_APPLICABLE', 'INSUFFICIENT_DATA'].includes(s)
    );
    record(
      14,
      'T6 Statuts produits sans NON_EVALUE (jamais réintroduit)',
      'VERDICT_COMBINE',
      allStatusesValid,
      'statuts ∈ {FAVORABLE, DEFAVORABLE, NOT_APPLICABLE, INSUFFICIENT_DATA}',
      statuses
    );
  }

  // ----------------------------------------------------------------------------
  // T7 — INFIPERF INDÉPENDANT
  // ----------------------------------------------------------------------------
  {
    // Données complètes, rétention 100 % ≥ seuil 50 → FAVORABLE.
    const trial = createTrial();
    seedGloss(trial, C12_STAGE_ID, P_E1.id, 100);
    seedGloss(trial, C12_STAGE_ID, P_E2.id, 100);
    seedGloss(trial, C12_STAGE_ID, P_E3.id, 100);
    const evaluated = evaluateInfiperfGlossRetention(trial, ruleSet, { stageId: C12_STAGE_ID });
    record(
      15,
      'T7 INFIPERF : rétention 100 % ≥ seuil (50) → FAVORABLE (seuil lu depuis RuleSet)',
      'INFIPERF',
      evaluated.result?.status === 'FAVORABLE' &&
        evaluated.result.threshold === getInfiperfGlossRetentionThreshold(ruleSet) &&
        evaluated.isComplementaryStudyCriterion === true &&
        evaluated.hasGlobalVerdict === false,
      'status=FAVORABLE, threshold=50, no non-conformité NF EN 927-6',
      `status=${String(evaluated.result?.status)}, threshold=${String(evaluated.result?.threshold)}, global=${String(evaluated.hasGlobalVerdict)}`
    );

    // Rétention < seuil → DEFAVORABLE (comparaison pure).
    const under = compareInfiperfRetention(49.9, 50);
    record(
      16,
      'T7 INFIPERF : rétention < seuil → DEFAVORABLE (comparaison pure)',
      'INFIPERF',
      under === 'DEFAVORABLE',
      'compareInfiperfRetention(49.9, 50)=DEFAVORABLE',
      under
    );

    // Égalité au seuil → FAVORABLE.
    const eq = compareInfiperfRetention(50, 50);
    record(
      17,
      'T7 INFIPERF : égalité au seuil → FAVORABLE',
      'INFIPERF',
      eq === 'FAVORABLE',
      'compareInfiperfRetention(50, 50)=FAVORABLE',
      eq
    );

    // Seuil absent → NOT_APPLICABLE.
    const ruleSetNoThreshold = { ...ruleSet, statisticalRules: { ...ruleSet.statisticalRules, retentionThresholdPercent: undefined } } as unknown as ReturnType<typeof getDefaultScientificRuleSet>;
    const trialNoData = createTrial();
    const noThreshold = evaluateInfiperfGlossRetention(trialNoData, ruleSetNoThreshold, { stageId: C12_STAGE_ID });
    const thresholdFromRuleSet = getInfiperfGlossRetentionThreshold(ruleSetNoThreshold);
    record(
      18,
      'T7 INFIPERF : seuil absent du RuleSet → NOT_APPLICABLE',
      'INFIPERF',
      thresholdFromRuleSet === null && noThreshold.result?.status === 'NOT_APPLICABLE',
      'threshold=null → NOT_APPLICABLE',
      `threshold=${String(thresholdFromRuleSet)}, status=${String(noThreshold.result?.status)}`
    );

    // Données absentes → INSUFFICIENT_DATA (seuil présent).
    const trialNoGloss = createTrial();
    const noData = evaluateInfiperfGlossRetention(trialNoGloss, ruleSet, { stageId: C12_STAGE_ID });
    record(
      19,
      'T7 INFIPERF : aucune rétention sur E1/E2/E3 → INSUFFICIENT_DATA',
      'INFIPERF',
      noData.result?.status === 'INSUFFICIENT_DATA',
      'INSUFFICIENT_DATA avec seuil présent',
      `status=${String(noData.result?.status)}`
    );

    // Moyenne calculée.
    const mean = meanRetentionRate([63.3, 63.3, 63.3]);
    record(
      20,
      'T7 INFIPERF : moyenne rétention 63,3 % calculée à 1 décimale',
      'INFIPERF',
      mean === 63.3,
      'meanRetentionRate([63.3,63.3,63.3])=63.3',
      String(mean)
    );

    // Indépendance NF / INFIPERF : NF FAVORABLE + INFIPERF DEFAVORABLE.
    {
      const trial = createTrial();
      seedFullDefects(trial, { blistering: 0.1, cracking: 0.1, flaking: 0.1 });
      seedGloss(trial, C12_STAGE_ID, P_E1.id, 40);
      seedGloss(trial, C12_STAGE_ID, P_E2.id, 40);
      seedGloss(trial, C12_STAGE_ID, P_E3.id, 40);
      const nf = evaluateNf9272Criteria(trial);
      const inf = evaluateInfiperfGlossRetention(trial, ruleSet, { stageId: C12_STAGE_ID });
      const nfFavorable = nf.results.BLISTERING.status === 'FAVORABLE';
      const infDefavorable = inf.result?.status === 'DEFAVORABLE';
      record(
        21,
        'T7 Indépendance : NF EN 927-2 FAVORABLE (cloquage) ET INFIPERF DEFAVORABLE (rétention 40 %)',
        'INFIPERF',
        nfFavorable && infDefavorable,
        'NF=FAVORABLE, INFIPERF=DEFAVORABLE simultanés',
        `NF.BLISTERING=${nf.results.BLISTERING.status}, INFIPERF=${String(inf.result?.status)}`
      );
    }
  }

  // ----------------------------------------------------------------------------
  // T8 — NOTICE COMPLEMENTARY OBLIGATOIRE
  // ----------------------------------------------------------------------------
  {
    const trial = createTrial();
    seedFullDefects(trial, {});
    const nf = evaluateNf9272Criteria(trial);
    const inf = evaluateInfiperfGlossRetention(trial, ruleSet, { stageId: C12_STAGE_ID });
    const bothNotices =
      nf.evaluationMode === 'COMPLEMENTARY' &&
      nf.complementaryNotice.length > 0 &&
      inf.evaluationMode === 'COMPLEMENTARY' &&
      inf.complementaryNotice.length > 0;

    record(
      22,
      'T8 Notice COMPLEMENTARY présente sur l’évaluation NF EN 927-2 et INFIPERF',
      'NOTICE_COMPLEMENTARY',
      bothNotices,
      'evaluationMode=COMPLEMENTARY + notice texte non vide des deux côtés',
      `NF.mode=${nf.evaluationMode}, NF.notice=${nf.complementaryNotice.length}ch, INF.mode=${inf.evaluationMode}, INF.notice=${inf.complementaryNotice.length}ch`
    );
  }

  // ----------------------------------------------------------------------------
  // Bilan
  // ----------------------------------------------------------------------------
  const failed = results.filter((r) => !r.passed).length;
  return {
    results,
    summary: { total: results.length, passed: results.length - failed, failed }
  };
}