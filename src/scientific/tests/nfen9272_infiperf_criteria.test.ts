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
 *   T9  — INFIPERF Persoz : indicateur de vigilance (jamais PASS/FAIL) ;
 *        initial > 70 s ; vieillissement ≥ 100 s ; pas de seuil NF.
 *   T10 — INFIPERF Couleur : analyse descriptive ΔL/Δa/Δb/ΔE à 3 décimales,
 *         cycles réellement mesurés, aucune interpolation, aucun verdict.
 *   T11 — INFIPERF Aspect général : alerte ≥ 2,5 (échelle 0..5), aucun
 *         verdict de conformité NF.
 *   T12 — Orchestration multicritères INFIPERF : statuts simultanés
 *         (FAVORABLE + DEFAVORABLE + VIGILANCE + ANALYSIS), aucun score global.
 *   T13 — Verrou jalon C12 (correctif audit, P2) : cycle 12 + 2016 h + actif ;
 *         jalon absent / INACTIVE / mauvais cycle / mauvaise durée exclus.
 *   T14 — Traçabilité P1/P3 : statut « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT »
 *         partagé, emplacements null jamais inventés, document INFIPERF null.
 *   T15 — Agrégation par système : multi-lots sans sélection refusés, aucun
 *         mélange inter-systèmes, batchId requis pour cibler un système.
 *   T16 — Données incomplètes INFIPERF : une seule valeur valide → moyenne
 *         calculée (règle S0 §10), valeur nulle traitée comme absente.
 *   T17 — Architecture (§15) : criteriaAdhesion (délai ISO 2409) indépendant
 *         de l'adhérence NF EN 927-2 (force MPa), aucun import croisé.
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
  compareInfiperfRetention,
  evaluateInfiperfPersoz,
  evaluateInfiperfColor,
  evaluateInfiperfGeneralAppearance,
  evaluateInfiperfCriteria,
  compareInfiperfPersoz,
  compareInfiperfAspect
} from '../criteria/infiperf/infiperfEvaluator';
import { meanRetentionRate, meanDampingTime, meanColorComponent, meanAspectRating } from '../criteria/infiperf/infiperfCalculations';
import {
  getInfiperfGlossRetentionThreshold,
  INFIPERF_EDITION,
  INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS,
  INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS,
  INFIPERF_ASPECT_ALERT_RATING,
  INFIPERF_DOCUMENT,
  INFIPERF_TRACEABILITY_STATUS,
  INFIPERF_COMPLEMENTARY_NOTICE
} from '../criteria/infiperf/infiperfRequirements';
import {
  NF9272_REFERENCE,
  NF9272_EDITION,
  NF9272_DOCUMENT,
  NF9272_TRACEABILITY_STATUS
} from '../criteria/en927/en9272Requirements';
import { TRACEABILITY_STATUS_TO_BE_DEFINED } from '../criteria/common/criterionTypes';
import { evaluateAdhesionDelayCriterion } from '../criteria/criteriaAdhesion';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    batches?: Trial['batches'];
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
    batches: overrides?.batches ??
      [
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

  const seedPersoz = (trial: Trial, stageId: string, panelId: string, meanDampingTime: number) => {
    const key = `${stageId}__${panelId}__PERSOZ`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId: 'b1',
      panelId,
      familyId: 'PERSOZ',
      raw: {},
      computed: { meanDampingTime },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedColor = (trial: Trial, stageId: string, panelId: string, color: { deltaL: number; deltaA: number; deltaB: number; deltaE: number }) => {
    const key = `${stageId}__${panelId}__COLOR`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId: 'b1',
      panelId,
      familyId: 'COLOR',
      raw: {},
      computed: color,
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
    const meanB = defectMean([0.2, 0.3, 0.5]); // 0.333… → arrondi 1 décimale → 0.3
    const meanBNull = defectMean([]); // aucune valeur → null (aucune donnée fabriquée)
    const oneDecimal = specimenAdhesionMean([1.4, 1.5]); // 1.45 → arrondi 1 décimale → 1.5
    record(
      6,
      'T3 Calculs : moyenne défauts arrondie à 1 décimale (0,333→0,3) ; moyenne éprouvette adhérence arrondie ; null sans données',
      'CALCULS',
      meanB === 0.3 && meanBNull === null && oneDecimal === 1.5,
      'defectMean([0.2,0.3,0.5])=0.333→0.3 ; defectMean([])=null ; specimenAdhesionMean([1.4,1.5])=1.45→1.5',
      `meanB=${String(meanB)}, meanBNull=${String(meanBNull)}, oneDecimal=${String(oneDecimal)}`
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

    // Non-régression du seuil : le seuil provient EXCLUSIVEMENT du ScientificRuleSet.
    // À données identiques (rétention 55 %), le verdict change selon le RuleSet utilisé.
    const ruleSetA = ruleSet; // seuil par défaut : 50 %
    const ruleSetB = {
      ...ruleSet,
      statisticalRules: { ...ruleSet.statisticalRules, retentionThresholdPercent: 60 }
    } as ReturnType<typeof getDefaultScientificRuleSet>;

    const trialSame = createTrial();
    seedGloss(trialSame, C12_STAGE_ID, P_E1.id, 55);
    seedGloss(trialSame, C12_STAGE_ID, P_E2.id, 55);
    seedGloss(trialSame, C12_STAGE_ID, P_E3.id, 55);

    const withA = evaluateInfiperfGlossRetention(trialSame, ruleSetA, { stageId: C12_STAGE_ID });
    const withB = evaluateInfiperfGlossRetention(trialSame, ruleSetB, { stageId: C12_STAGE_ID });
    record(
      20,
      'T7 INFIPERF : seuil exclusivement depuis le RuleSet (A=50 % → FAVORABLE, B=60 % → DEFAVORABLE, données 55 % identiques)',
      'INFIPERF_SEUIL_RULESET',
      withA.result?.status === 'FAVORABLE' &&
        withB.result?.status === 'DEFAVORABLE' &&
        withA.result?.threshold === 50 &&
        withB.result?.threshold === 60,
      'rétention 55 % : RuleSet A (50) → FAVORABLE (55≥50) ; RuleSet B (60) → DEFAVORABLE (55<60)',
      `A=${String(withA.result?.status)}@${String(withA.result?.threshold)}, B=${String(withB.result?.status)}@${String(withB.result?.threshold)}`
    );

    // Seuil non fini / invalide → NOT_APPLICABLE (aucun fallback numérique).
    const ruleSetInvalid = {
      ...ruleSet,
      statisticalRules: { ...ruleSet.statisticalRules, retentionThresholdPercent: Number.NaN }
    } as unknown as ReturnType<typeof getDefaultScientificRuleSet>;
    const trialInvalid = createTrial();
    seedGloss(trialInvalid, C12_STAGE_ID, P_E1.id, 100);
    seedGloss(trialInvalid, C12_STAGE_ID, P_E2.id, 100);
    seedGloss(trialInvalid, C12_STAGE_ID, P_E3.id, 100);
    const invalidThreshold = evaluateInfiperfGlossRetention(trialInvalid, ruleSetInvalid, { stageId: C12_STAGE_ID });
    record(
      21,
      'T7 INFIPERF : seuil invalide (NaN) dans le RuleSet → NOT_APPLICABLE, aucun seuil fabriqué',
      'INFIPERF_SEUIL_RULESET',
      invalidThreshold.result?.status === 'NOT_APPLICABLE' && invalidThreshold.result?.threshold === null,
      'seuil NaN → NOT_APPLICABLE, threshold=null',
      `status=${String(invalidThreshold.result?.status)}, threshold=${String(invalidThreshold.result?.threshold)}`
    );

    // Moyenne calculée.
    const mean = meanRetentionRate([63.3, 63.3, 63.3]);
    record(
      22,
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
        23,
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
      24,
      'T8 Notice COMPLEMENTARY présente sur l’évaluation NF EN 927-2 et INFIPERF',
      'NOTICE_COMPLEMENTARY',
      bothNotices,
      'evaluationMode=COMPLEMENTARY + notice texte non vide des deux côtés',
      `NF.mode=${nf.evaluationMode}, NF.notice=${nf.complementaryNotice.length}ch, INF.mode=${inf.evaluationMode}, INF.notice=${inf.complementaryNotice.length}ch`
    );
  }

  // ----------------------------------------------------------------------------
  // T9 — INFIPERF PERSOZ : INDICATEUR DE VIGILANCE (JAMAIS PASS/FAIL)
  // ----------------------------------------------------------------------------
  {
    // Lemme pur : seuil initial > 70 s (T0, cycleIndex 0).
    const pureNoSignal = compareInfiperfPersoz(70, 'INITIAL_HARDNESS');
    const pureVigilance = compareInfiperfPersoz(71, 'INITIAL_HARDNESS');
    const pureUnder = compareInfiperfPersoz(69, 'INITIAL_HARDNESS');
    record(
      25,
      'T9 Lemme Persoz initial : 70 → NO_SIGNAL (strict >), 71 → VIGILANCE, 69 → NO_SIGNAL',
      'INFIPERF_PERSOZ',
      pureNoSignal === 'NO_SIGNAL' && pureVigilance === 'VIGILANCE' && pureUnder === 'NO_SIGNAL',
      `69→NO_SIGNAL, 70→NO_SIGNAL, 71→VIGILANCE`,
      `69→${pureUnder}, 70→${pureNoSignal}, 71→${pureVigilance}`
    );

    // Lemme pur : seuil vieillissement ≥ 100 s (cycleIndex ≥ 1).
    const agingNoSignal = compareInfiperfPersoz(99, 'AGEING_HARDNESS');
    const agingVigEq = compareInfiperfPersoz(100, 'AGEING_HARDNESS');
    const agingVigOver = compareInfiperfPersoz(101, 'AGEING_HARDNESS');
    record(
      26,
      'T9 Lemme Persoz vieillissement : 99 → NO_SIGNAL, 100 → VIGILANCE (≥), 101 → VIGILANCE',
      'INFIPERF_PERSOZ',
      agingNoSignal === 'NO_SIGNAL' && agingVigEq === 'VIGILANCE' && agingVigOver === 'VIGILANCE',
      `99→NO_SIGNAL, 100→VIGILANCE, 101→VIGILANCE`,
      `99→${agingNoSignal}, 100→${agingVigEq}, 101→${agingVigOver}`
    );

    // Évaluateur Persoz initial (T0, cycleIndex 0) avec données.
    {
      const trialT0 = createTrial({
        stages: [
          { id: 'st-t0', trialId: 'trial-nf9272', cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE', name: 'T0', scheduledExposureHours: 0, status: 'VALIDATED' }
        ]
      });
      seedPersoz(trialT0, 'st-t0', P_E1.id, 71);
      seedPersoz(trialT0, 'st-t0', P_E2.id, 71);
      seedPersoz(trialT0, 'st-t0', P_E3.id, 71);
      const evalT0 = evaluateInfiperfPersoz(trialT0, { stageId: 'st-t0' });
      record(
        27,
        'T9 Persoz T0 initial : 71 s > 70 → VIGILANCE (cycleIndex 0 = INITIAL_HARDNESS)',
        'INFIPERF_PERSOZ',
        evalT0.status === 'VIGILANCE' &&
          evalT0.value === 71 &&
          evalT0.threshold === INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS &&
          evalT0.rule === 'INITIAL_HARDNESS',
        'status=VIGILANCE, value=71, threshold=70, rule=INITIAL_HARDNESS',
        `status=${evalT0.status}, value=${String(evalT0.value)}, threshold=${String(evalT0.threshold)}, rule=${String(evalT0.rule)}`
      );
    }

    // Évaluateur Persoz vieillissement (C12, cycleIndex 12) avec données.
    {
      const evalC12 = evaluateInfiperfPersoz(createTrial(), { stageId: C12_STAGE_ID });
      // Aucune donnée Persoz sur C12 par défaut → INSUFFICIENT_DATA.
      record(
        28,
        'T9 Persoz C12 sans données → INSUFFICIENT_DATA',
        'INFIPERF_PERSOZ',
        evalC12.status === 'INSUFFICIENT_DATA' && evalC12.rule === null,
        'status=INSUFFICIENT_DATA, rule=null',
        `status=${evalC12.status}, rule=${String(evalC12.rule)}`
      );
    }

    // Évaluateur Persoz vieillissement (C12, cycleIndex 12) avec données ≥ 100 s.
    {
      const trial = createTrial();
      seedPersoz(trial, C12_STAGE_ID, P_E1.id, 100);
      seedPersoz(trial, C12_STAGE_ID, P_E2.id, 101);
      seedPersoz(trial, C12_STAGE_ID, P_E3.id, 100);
      const eval_ = evaluateInfiperfPersoz(trial, { stageId: C12_STAGE_ID });
      // mean = (100+101+100)/3 = 100.333 → 100.3 → ≥ 100 → VIGILANCE.
      record(
        29,
        'T9 Persoz C12 vieillissement : (100+101+100)/3=100,3 ≥ 100 → VIGILANCE (rule=AGEING_HARDNESS)',
        'INFIPERF_PERSOZ',
        eval_.status === 'VIGILANCE' &&
          eval_.value === 100.3 &&
          eval_.rule === 'AGEING_HARDNESS' &&
          eval_.threshold === INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS,
        'status=VIGILANCE, value=100.3, threshold=100, rule=AGEING_HARDNESS',
        `status=${eval_.status}, value=${String(eval_.value)}, rule=${String(eval_.rule)}, threshold=${String(eval_.threshold)}`
      );
    }
  }

  // ----------------------------------------------------------------------------
  // T10 — INFIPERF COULEUR : ANALYSE DESCRIPTIVE (AUCUN VERDICT)
  // ----------------------------------------------------------------------------
  {
    // Analyse descriptive : moyennes ΔL/Δa/Δb/ΔE à 3 décimales, status ANALYSIS.
    {
      const trial = createTrial();
      seedColor(trial, C12_STAGE_ID, P_E1.id, { deltaL: 0.5, deltaA: -0.1234, deltaB: 0.001, deltaE: 0.5678 });
      seedColor(trial, C12_STAGE_ID, P_E2.id, { deltaL: 0.7, deltaA: -0.1236, deltaB: 0.002, deltaE: 0.5682 });
      seedColor(trial, C12_STAGE_ID, P_E3.id, { deltaL: 0.6, deltaA: -0.1235, deltaB: 0.003, deltaE: 0.5680 });
      const eval_ = evaluateInfiperfColor(trial);
      // Moyennes à 3 décimales : ΔL=(0.5+0.7+0.6)/3=0.6 → 0.6 ; ΔA=(-0.1234-0.1236-0.1235)/3=-0.1235 → -0.124 ; ΔB=(0.001+0.002+0.003)/3=0.002 ; ΔE=(0.5678+0.5682+0.568)/3=0.568 → 0.568.
      const meanL = meanColorComponent([0.5, 0.7, 0.6]); // 0.6
      const meanA = meanColorComponent([-0.1234, -0.1236, -0.1235]); // -0.1235 → -0.124
      const meanB = meanColorComponent([0.001, 0.002, 0.003]); // 0.002
      const meanE = meanColorComponent([0.5678, 0.5682, 0.5680]); // 0.568

      record(
        30,
        'T10 Couleur : moyennes ΔL/Δa/Δb/ΔE à 3 décimales, status ANALYSIS, pas de seuil',
        'INFIPERF_COULEUR',
        eval_.status === 'ANALYSIS' &&
          eval_.cycles.length === 1 &&
          eval_.cycles[0].deltaL === meanL &&
          eval_.cycles[0].deltaA === meanA &&
          eval_.cycles[0].deltaB === meanB &&
          eval_.cycles[0].deltaE === meanE,
        `ANALYSIS, ΔL=${meanL}, ΔA=${meanA}, ΔB=${meanB}, ΔE=${meanE}`,
        `status=${eval_.status}, cycles=${eval_.cycles.length}, ΔL=${String(eval_.cycles[0]?.deltaL)}, ΔA=${String(eval_.cycles[0]?.deltaA)}, ΔB=${String(eval_.cycles[0]?.deltaB)}, ΔE=${String(eval_.cycles[0]?.deltaE)}`
      );
    }

    // Cycles non consécutifs sans interpolation : T0 + C12 uniquement → 2 cycles listés.
    {
      const trial = createTrial({
        stages: [
          { id: 'st-t0', trialId: 'trial-nf9272', cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE', name: 'T0', scheduledExposureHours: 0, status: 'VALIDATED' },
          { id: C12_STAGE_ID, trialId: 'trial-nf9272', cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: '2016 h', scheduledExposureHours: 2016, status: 'VALIDATED' }
        ]
      });
      seedColor(trial, 'st-t0', P_E1.id, { deltaL: 0, deltaA: 0, deltaB: 0, deltaE: 0 });
      seedColor(trial, 'st-t0', P_E2.id, { deltaL: 0, deltaA: 0, deltaB: 0, deltaE: 0 });
      seedColor(trial, 'st-t0', P_E3.id, { deltaL: 0, deltaA: 0, deltaB: 0, deltaE: 0 });
      seedColor(trial, C12_STAGE_ID, P_E1.id, { deltaL: 0.4, deltaA: 0.1, deltaB: -0.2, deltaE: 0.5 });
      seedColor(trial, C12_STAGE_ID, P_E2.id, { deltaL: 0.4, deltaA: 0.1, deltaB: -0.2, deltaE: 0.5 });
      seedColor(trial, C12_STAGE_ID, P_E3.id, { deltaL: 0.4, deltaA: 0.1, deltaB: -0.2, deltaE: 0.5 });
      const eval_ = evaluateInfiperfColor(trial);
      const displays = eval_.cycles.map((c) => c.display);
      // T0 et C12 seulement : aucune interpolation des cycles intermédiaires.
      record(
        31,
        'T10 Couleur cycles non consécutifs (T0+C12) : 2 cycles réellement mesurés, aucune interpolation intermédiaire',
        'INFIPERF_COULEUR',
        eval_.status === 'ANALYSIS' &&
          eval_.cycles.length === 2 &&
          displays.includes('C0 (0 h)') &&
          displays.includes('C12 (2016 h)'),
        'cycles=[C0, C12], status=ANALYSIS',
        `cycles=${eval_.cycles.length}, displays=${displays.join(', ')}`
      );
    }

    // Pas de données → INSUFFICIENT_DATA.
    {
      const eval_ = evaluateInfiperfColor(createTrial());
      record(
        32,
        'T10 Couleur sans données → INSUFFICIENT_DATA',
        'INFIPERF_COULEUR',
        eval_.status === 'INSUFFICIENT_DATA' && eval_.cycles.length === 0,
        'status=INSUFFICIENT_DATA, cycles=[]',
        `status=${eval_.status}, cycles=${eval_.cycles.length}`
      );
    }
  }

  // ----------------------------------------------------------------------------
  // T11 — INFIPERF ASPECT GÉNÉRAL : ALERTE ≥ 2,5 (ÉCHELLE 0..5)
  // ----------------------------------------------------------------------------
  {
    // Lemme pur : seuil d'alerte.
    const a24 = compareInfiperfAspect(2.4);
    const a25 = compareInfiperfAspect(2.5);
    const a26 = compareInfiperfAspect(2.6);
    record(
      33,
      'T11 Lemme aspect : 2,4 → NO_SIGNAL, 2,5 → VIGILANCE (≥), 2,6 → VIGILANCE',
      'INFIPERF_ASPECT',
      a24 === 'NO_SIGNAL' && a25 === 'VIGILANCE' && a26 === 'VIGILANCE',
      `2,4→NO_SIGNAL, 2,5→VIGILANCE, 2,6→VIGILANCE`,
      `2,4→${a24}, 2,5→${a25}, 2,6→${a26}`
    );

    // Constante seuil d'alerte : 2,5.
    record(
      34,
      'T11 Constante INFIPERF_ASPECT_ALERT_RATING = 2,5',
      'INFIPERF_ASPECT',
      INFIPERF_ASPECT_ALERT_RATING === 2.5,
      'INFIPERF_ASPECT_ALERT_RATING=2.5',
      String(INFIPERF_ASPECT_ALERT_RATING)
    );

    // Évaluateur aspect avec cotations fournies (échelle 0..5).
    {
      const trial = createTrial();
      seedObservation(trial, C12_STAGE_ID, P_E1.id, { GENERAL_APPEARANCE: 2.6, BLISTERING: 0 });
      seedObservation(trial, C12_STAGE_ID, P_E2.id, { GENERAL_APPEARANCE: 2.4, BLISTERING: 0 });
      seedObservation(trial, C12_STAGE_ID, P_E3.id, { GENERAL_APPEARANCE: 2.5, BLISTERING: 0 });
      const eval_ = evaluateInfiperfGeneralAppearance(trial, { stageId: C12_STAGE_ID });
      // moyenne = (2.6+2.4+2.5)/3 = 2.5 → VIGILANCE (≥ 2.5).
      record(
        35,
        'T11 Aspect C12 : (2,6+2,4+2,5)/3=2,5 ≥ 2,5 → VIGILANCE, seuil=2,5',
        'INFIPERF_ASPECT',
        eval_.status === 'VIGILANCE' &&
          eval_.value === 2.5 &&
          eval_.alertThreshold === 2.5,
        'status=VIGILANCE, value=2.5, alertThreshold=2.5',
        `status=${eval_.status}, value=${String(eval_.value)}, alertThreshold=${String(eval_.alertThreshold)}`
      );
    }

    // Aspect sans données → INSUFFICIENT_DATA.
    {
      const eval_ = evaluateInfiperfGeneralAppearance(createTrial(), { stageId: C12_STAGE_ID });
      record(
        36,
        'T11 Aspect sans données → INSUFFICIENT_DATA',
        'INFIPERF_ASPECT',
        eval_.status === 'INSUFFICIENT_DATA' && eval_.value === null,
        'status=INSUFFICIENT_DATA, value=null',
        `status=${eval_.status}, value=${String(eval_.value)}`
      );
    }
  }

  // ----------------------------------------------------------------------------
  // T12 — ORCHESTRATION MULTICRITÈRES : STATUTS SIMULTANÉS, AUCUN SCORE GLOBAL
  // ----------------------------------------------------------------------------
  {
    // Un seul jalon, toutes les données, statuts différents simultanés.
    const trial = createTrial();
    seedFullDefects(trial, { blistering: 0.1, cracking: 0.1, flaking: 0.1 }); // NF FAVORABLE.
    seedGloss(trial, C12_STAGE_ID, P_E1.id, 40);
    seedGloss(trial, C12_STAGE_ID, P_E2.id, 40);
    seedGloss(trial, C12_STAGE_ID, P_E3.id, 40); // Gloss 40 % < 50 → DEFAVORABLE.
    seedPersoz(trial, C12_STAGE_ID, P_E1.id, 101);
    seedPersoz(trial, C12_STAGE_ID, P_E2.id, 100);
    seedPersoz(trial, C12_STAGE_ID, P_E3.id, 100); // Persoz ≥ 100 → VIGILANCE.
    seedColor(trial, C12_STAGE_ID, P_E1.id, { deltaL: 1.2, deltaA: 0.3, deltaB: -0.5, deltaE: 1.4 });
    seedColor(trial, C12_STAGE_ID, P_E2.id, { deltaL: 1.2, deltaA: 0.3, deltaB: -0.5, deltaE: 1.4 });
    seedColor(trial, C12_STAGE_ID, P_E3.id, { deltaL: 1.2, deltaA: 0.3, deltaB: -0.5, deltaE: 1.4 }); // Couleur → ANALYSIS.
    seedObservation(trial, C12_STAGE_ID, P_E1.id, { GENERAL_APPEARANCE: 2.0, BLISTERING: 0 });
    seedObservation(trial, C12_STAGE_ID, P_E2.id, { GENERAL_APPEARANCE: 2.0, BLISTERING: 0 });
    seedObservation(trial, C12_STAGE_ID, P_E3.id, { GENERAL_APPEARANCE: 2.0, BLISTERING: 0 }); // Aspect 2,0 < 2,5 → NO_SIGNAL.

    const nf = evaluateNf9272Criteria(trial);
    const inf = evaluateInfiperfCriteria(trial, ruleSet, { stageId: C12_STAGE_ID });

    const nfFavorable = nf.results.BLISTERING.status === 'FAVORABLE';
    const glossDefavorable = inf.results.GLOSS_RETENTION.status === 'DEFAVORABLE';
    const persozVigilance = inf.results.PERSOZ.status === 'VIGILANCE';
    const couleurAnalysis = inf.results.COLOR.status === 'ANALYSIS';
    const aspectNoSignal = inf.results.GENERAL_APPEARANCE.status === 'NO_SIGNAL';

    record(
      37,
      'T12 Orchestration : statuts simultanés — NF FAVORABLE + gloss DEFAVORABLE + Persoz VIGILANCE + couleur ANALYSIS + aspect NO_SIGNAL',
      'INFIPERF_ORCHESTRATION',
      nfFavorable && glossDefavorable && persozVigilance && couleurAnalysis && aspectNoSignal,
      'NF=FAVORABLE, gloss=DEFAVORABLE, Persoz=VIGILANCE, couleur=ANALYSIS, aspect=NO_SIGNAL',
      `NF=${nf.results.BLISTERING.status}, gloss=${inf.results.GLOSS_RETENTION.status}, Persoz=${inf.results.PERSOZ.status}, couleur=${inf.results.COLOR.status}, aspect=${inf.results.GENERAL_APPEARANCE.status}`
    );

    // Aucun score global ni verdict combiné.
    record(
      38,
      'T12 Orchestration : hasGlobalVerdict=false, aucune note/verdict global',
      'INFIPERF_ORCHESTRATION',
      inf.hasGlobalVerdict === false,
      'hasGlobalVerdict=false',
      `hasGlobalVerdict=${String(inf.hasGlobalVerdict)}`
    );
  }

  // ----------------------------------------------------------------------------
  // T13 — VERROU JALON C12 (CORRECTIF AUDIT 4, P2) : cycle 12 + 2016 h + actif
  // ----------------------------------------------------------------------------
  {
    // Cas 1 : jalon C12 valide, actif (VALIDATED), cycle 12, 2016 h → retenu.
    const valid = findNf9272Jalon(createTrial());
    record(
      39,
      'T13 Verrou C12 : jalon actif cycle 12 / 2016 h retenu',
      'JALON_C12_VERROU',
      valid !== null && valid.cycleIndex === 12 && valid.scheduledExposureHours === 2016,
      'jalon retenu (cycle 12, 2016 h)',
      `jalon=${valid ? `${valid.cycleIndex}/${valid.scheduledExposureHours}h` : 'null'}`
    );

    // Cas 2 : jalon absent (ni cycle 12, ni 2016 h).
    const absent = createTrial({
      stages: [
        { id: 'st-t0', trialId: 'trial-nf9272', cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE', name: 'T0', scheduledExposureHours: 0, status: 'VALIDATED' },
        { id: C11_STAGE_ID, trialId: 'trial-nf9272', cycleIndex: 11, stageType: 'INTERMEDIATE_DURING_EXPOSURE', name: '1848 h', scheduledExposureHours: 1848, status: 'VALIDATED' }
      ]
    });
    record(
      40,
      'T13 Verrou C12 : jalon absent (T0 + C11) → null',
      'JALON_C12_VERROU',
      findNf9272Jalon(absent) === null,
      'jalon=null',
      `jalon=${String(findNf9272Jalon(absent))}`
    );

    // Cas 3 : jalon cycle 12 mais statut INACTIVE → exclu.
    const inactive = createTrial({
      stages: [
        { id: C12_STAGE_ID, trialId: 'trial-nf9272', cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: '2016 h', scheduledExposureHours: 2016, status: 'INACTIVE' }
      ]
    });
    record(
      41,
      'T13 Verrou C12 : jalon cycle 12 / 2016 h mais INACTIVE → exclu',
      'JALON_C12_VERROU',
      findNf9272Jalon(inactive) === null,
      'jalon=null (INACTIVE exclu)',
      `jalon=${String(findNf9272Jalon(inactive))}`
    );

    // Cas 4 : jalon cycle 12 mais durée ≠ 2016 h → exclu.
    const wrongHours = createTrial({
      stages: [
        { id: 'st-12-1848', trialId: 'trial-nf9272', cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: '1848 h', scheduledExposureHours: 1848, status: 'VALIDATED' }
      ]
    });
    record(
      42,
      'T13 Verrou C12 : jalon cycle 12 mais 1848 h → exclu (2016 h exigées)',
      'JALON_C12_VERROU',
      findNf9272Jalon(wrongHours) === null,
      'jalon=null (durée 1848 ≠ 2016)',
      `jalon=${String(findNf9272Jalon(wrongHours))}`
    );

    // Cas 5 : jalon 2016 h mais cycle ≠ 12 → exclu.
    const wrongCycle = createTrial({
      stages: [
        { id: 'st-11-2016', trialId: 'trial-nf9272', cycleIndex: 11, stageType: 'INTERMEDIATE_DURING_EXPOSURE', name: '2016 h', scheduledExposureHours: 2016, status: 'VALIDATED' }
      ]
    });
    record(
      43,
      'T13 Verrou C12 : jalon 2016 h mais cycle 11 → exclu (cycle 12 exigé)',
      'JALON_C12_VERROU',
      findNf9272Jalon(wrongCycle) === null,
      'jalon=null (cycle 11 ≠ 12)',
      `jalon=${String(findNf9272Jalon(wrongCycle))}`
    );
  }

  // ----------------------------------------------------------------------------
  // T14 — TRACABILITÉ P1/P3 : STATUTS « À DÉFINIR » SANS INVENTER D'EMPLACEMENT
  // ----------------------------------------------------------------------------
  {
    // Constante partagée de statut de traçabilité.
    record(
      44,
      'T14 Constante TRACEABILITY_STATUS_TO_BE_DEFINED = « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT »',
      'TRACABILITE',
      TRACEABILITY_STATUS_TO_BE_DEFINED === 'À DÉFINIR / À VALIDER SCIENTIFIQUEMENT',
      `statut=${TRACEABILITY_STATUS_TO_BE_DEFINED}`,
      String(TRACEABILITY_STATUS_TO_BE_DEFINED)
    );

    // NF : provenance du critère avec statut À DÉFINIR, emplacements null.
    const stable = getNf9272CategoryRequirements('STABLE');
    const prov = stable.criteria.BLISTERING?.provenance;
    record(
      45,
      'T14 NF provenance foncière : document=NF EN 927-2:2022, statut À DÉFINIR, section/paragraphe/tableau/page null',
      'TRACABILITE',
      prov?.document === NF9272_DOCUMENT &&
        prov?.edition === '2022' &&
        prov?.traceabilityStatus === NF9272_TRACEABILITY_STATUS &&
        prov?.reference === NF9272_REFERENCE &&
        prov?.section === null &&
        prov?.paragraph === null &&
        prov?.table === null &&
        prov?.page === null,
      'document/document/edition renseignés, emplacements null, statut À DÉFINIR',
      `document=${prov?.document}, edition=${prov?.edition}, section=${String(prov?.section)}, paragraph=${String(prov?.paragraph)}, table=${String(prov?.table)}, page=${String(prov?.page)}, statut=${prov?.traceabilityStatus}`
    );

    // NF : évaluation complète → provenance du résultat avec statut À DÉFINIR.
    const evalProv = evaluateNf9272Criteria(createTrial());
    record(
      46,
      'T14 NF évaluation : provenance résultat avec document/statut À DÉFINIR, pas d’emplacement inventé',
      'TRACABILITE',
      evalProv.results.BLISTERING.provenance.document === NF9272_DOCUMENT &&
        evalProv.results.BLISTERING.provenance.traceabilityStatus === NF9272_TRACEABILITY_STATUS &&
        evalProv.results.BLISTERING.provenance.section === null &&
        evalProv.results.BLISTERING.provenance.page === null,
      'provenance résultat = document NF EN 927-2:2022, statut À DÉFINIR, emplacement null',
      `document=${evalProv.results.BLISTERING.provenance.document}, statut=${evalProv.results.BLISTERING.provenance.traceabilityStatus}, section=${String(evalProv.results.BLISTERING.provenance.section)}`
    );

    // INFIPERF : document source null (statut À DÉFINIR), constantes cohérentes.
    record(
      47,
      'T14 INFIPERF : document source null et statut À DÉFINIR (P3)',
      'TRACABILITE',
      INFIPERF_DOCUMENT === null &&
        INFIPERF_TRACEABILITY_STATUS === TRACEABILITY_STATUS_TO_BE_DEFINED,
      'document=null, statut=À DÉFINIR',
      `document=${String(INFIPERF_DOCUMENT)}, statut=${INFIPERF_TRACEABILITY_STATUS}`
    );

    // INFIPERF : provenance des résultats porte le statut À DÉFINIR.
    const infProv = evaluateInfiperfGlossRetention(createTrial(), ruleSet, { stageId: C12_STAGE_ID }).result!;
    record(
      48,
      'T14 INFIPERF évaluation : provenance résultat avec document null et statut À DÉFINIR',
      'TRACABILITE',
      infProv.provenance.document === null &&
        infProv.provenance.traceabilityStatus === INFIPERF_TRACEABILITY_STATUS &&
        infProv.provenance.reference === 'INFIPERF / FCBA',
      'provenance résultat = document null, statut À DÉFINIR, reference INFIPERF / FCBA',
      `document=${String(infProv.provenance.document)}, statut=${infProv.provenance.traceabilityStatus}, reference=${infProv.provenance.reference}`
    );

    // Notice INFIPERF enrichie (P3) : désignation S0 §4 présente, aucun titre de
    // document inventé, statut de traçabilité explicite, édition null.
    record(
      49,
      'T14 INFIPERF notice : « INFIPERF FCBA 2024 » (S0 §4) présente, titre/édition À DÉFINIR',
      'TRACABILITE',
      INFIPERF_COMPLEMENTARY_NOTICE.includes('INFIPERF FCBA 2024') &&
        INFIPERF_COMPLEMENTARY_NOTICE.includes('À DÉFINIR / À VALIDER SCIENTIFIQUEMENT') &&
        INFIPERF_EDITION === null,
      'notice mentionne la désignation S0 + statut À DÉFINIR ; édition null',
      `notice=${INFIPERF_COMPLEMENTARY_NOTICE.slice(0, 80)}…`
    );
  }

  // ----------------------------------------------------------------------------
  // T15 — AGRÉGATION PAR SYSTÈME : JAMAIS INTER-SYSTÈMES (§8)
  // ----------------------------------------------------------------------------
  {
    // Deux lots sans sélection → blocage par portée (aucun mélange), statut refusé.
    const P_B2_E1 = { id: 'p-b2-e1', batchId: 'b2', index: 1, label: 'E1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' } as const;
    const P_B2_E2 = { id: 'p-b2-e2', batchId: 'b2', index: 2, label: 'E2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' } as const;
    const P_B2_E3 = { id: 'p-b2-e3', batchId: 'b2', index: 3, label: 'E3', role: 'EXPOSED_3', roleCode: 'E3', status: 'ACTIVE' } as const;
    const trialMulti = createTrial({
      batches: [
        {
          id: 'b1',
          trialId: 'trial-nf9272',
          reference: 'LOT A',
          orderIndex: 1,
          coatingSystem: 'Lasure',
          woodSpecies: 'Pin',
          productReference: 'PROD-01',
          panels: [P_E1, P_E2, P_E3]
        },
        {
          id: 'b2',
          trialId: 'trial-nf9272',
          reference: 'LOT B',
          orderIndex: 2,
          coatingSystem: 'Huile',
          woodSpecies: 'Mélèze',
          productReference: 'PROD-02',
          panels: [P_B2_E1, P_B2_E2, P_B2_E3]
        }
      ]
    });

    const nfMulti = evaluateNf9272Criteria(trialMulti);
    const multiBlocked =
      nfMulti.batchScoped.batchId === null &&
      nfMulti.batchScoped.scopeBlockedReason !== null &&
      nfMulti.results.BLISTERING.status === 'INSUFFICIENT_DATA' &&
      nfMulti.results.CRACKING.status === 'INSUFFICIENT_DATA' &&
      nfMulti.results.FLAKING.status === 'INSUFFICIENT_DATA' &&
      nfMulti.results.ADHESION.status === 'INSUFFICIENT_DATA';
    record(
      50,
      'T15 NF multi-lots sans sélection : refusé (aucune moyenne inter-systèmes)',
      'PORTEE_SYSTEME',
      multiBlocked,
      'batchScoped.bloque, tous critères INSUFFICIENT_DATA',
      `batchId=${String(nfMulti.batchScoped.batchId)}, blocage=${String(nfMulti.batchScoped.scopeBlockedReason)}, BLISTERING=${nfMulti.results.BLISTERING.status}, ADHESION=${nfMulti.results.ADHESION.status}`
    );

    // La sélection d'un lot cible les éprouvettes UNIQUEMENT de ce lot.
    seedFullDefects(trialMulti, { blistering: 0.1, cracking: 0.1, flaking: 0.1 });
    const nfScoped = evaluateNf9272Criteria(trialMulti, { batchId: 'b1' });
    record(
      51,
      'T15 NF batchId=b1 : évaluation ciblée, scope déverrouillé, statut FAVORABLE',
      'PORTEE_SYSTEME',
      nfScoped.batchScoped.batchId === 'b1' &&
        nfScoped.batchScoped.scopeBlockedReason === null &&
        nfScoped.batchScoped.batchLabel !== null &&
        nfScoped.results.BLISTERING.status === 'FAVORABLE',
      'batchId=b1, scope libre, BLISTERING=FAVORABLE',
      `batchId=${String(nfScoped.batchScoped.batchId)}, label=${String(nfScoped.batchScoped.batchLabel)}, BLISTERING=${nfScoped.results.BLISTERING.status}`
    );

    // batchId inconnu → refusé.
    const nfUnknown = evaluateNf9272Criteria(trialMulti, { batchId: 'b-x' });
    record(
      52,
      'T15 NF batchId inconnu : refusé',
      'PORTEE_SYSTEME',
      nfUnknown.batchScoped.batchId === null &&
        nfUnknown.batchScoped.scopeBlockedReason !== null &&
        nfUnknown.results.BLISTERING.status === 'INSUFFICIENT_DATA',
      'batchScoped.bloque + INSUFFICIENT_DATA',
      `blocage=${String(nfUnknown.batchScoped.scopeBlockedReason)}, BLISTERING=${nfUnknown.results.BLISTERING.status}`
    );

    // INFIPERF : multi-lots sans sélection → chacun des indicateurs refusé.
    const infMulti = evaluateInfiperfCriteria(trialMulti, ruleSet, { stageId: C12_STAGE_ID });
    record(
      53,
      'T15 INFIPERF multi-lots sans sélection : gloss/persoz/couleur/aspect refusés',
      'PORTEE_SYSTEME',
      infMulti.results.GLOSS_RETENTION.status === 'INSUFFICIENT_DATA' &&
        infMulti.results.PERSOZ.status === 'INSUFFICIENT_DATA' &&
        infMulti.results.COLOR.status === 'INSUFFICIENT_DATA' &&
        infMulti.results.GENERAL_APPEARANCE.status === 'INSUFFICIENT_DATA',
      '4 indicateurs INSUFFICIENT_DATA',
      `gloss=${infMulti.results.GLOSS_RETENTION.status}, persoz=${infMulti.results.PERSOZ.status}, couleur=${infMulti.results.COLOR.status}, aspect=${infMulti.results.GENERAL_APPEARANCE.status}`
    );

    // INFIPERF : sélection batchId=b2 cible le second système.
    const infScoped = evaluateInfiperfCriteria(trialMulti, ruleSet, { stageId: C12_STAGE_ID, batchId: 'b2' });
    record(
      54,
      'T15 INFIPERF batchId=b2 : refusé car données absentes (sélection système respectée, pas de mélange)',
      'PORTEE_SYSTEME',
      infScoped.results.GLOSS_RETENTION.status === 'INSUFFICIENT_DATA' &&
        infScoped.results.GLOSS_RETENTION.message.toLowerCase().includes('données insuffisantes'),
      'gloss=INSUFFICIENT_DATA (données absentes du lot b2), aucune donnée du lot b1 utilisée',
      `gloss=${infScoped.results.GLOSS_RETENTION.status}`
    );
  }

  // ----------------------------------------------------------------------------
  // T16 — §9 DONNÉES INCOMPLÈTES INFIPERF : UNE DONNÉE VALIDE SUFFIT (§10)
  // ----------------------------------------------------------------------------
  {
    const trialOneValue = createTrial();
    seedGloss(trialOneValue, C12_STAGE_ID, P_E1.id, 40); // Seule E1 porte une valeur.
    const glossOne = evaluateInfiperfGlossRetention(trialOneValue, ruleSet, { stageId: C12_STAGE_ID }).result!;
    record(
      55,
      'T16 §10 : une seule éprouvette valide → moyenne calculée (40 %) et seuil appliqué',
      'DONNEES_INCOMPLETES',
      glossOne.status === (40 >= 50 ? 'FAVORABLE' : 'DEFAVORABLE') &&
        glossOne.value === 40 &&
        glossOne.threshold === 50,
      'moyenne=40, seuil=50, statut=DEFAVORABLE (40 < 50)',
      `status=${glossOne.status}, value=${String(glossOne.value)}, threshold=${String(glossOne.threshold)}`
    );

    const tolerances3 = createTrial();
    seedGloss(tolerances3, C12_STAGE_ID, P_E1.id, 55);
    seedGloss(tolerances3, C12_STAGE_ID, P_E2.id, null); // Valeur invalide : comptée absente, pas rejetée par blocage.
    seedGloss(tolerances3, C12_STAGE_ID, P_E3.id, 55);
    const glossMixed = evaluateInfiperfGlossRetention(tolerances3, ruleSet, { stageId: C12_STAGE_ID }).result!;
    record(
      56,
      'T16 §10 : valeur nulle traitée comme absente, moyenne sur valeurs valides (55 %)',
      'DONNEES_INCOMPLETES',
      glossMixed.value === 55 && glossMixed.status === 'FAVORABLE',
      'moyenne=55 (2 valeurs valides), statut=FAVORABLE',
      `value=${String(glossMixed.value)}, status=${glossMixed.status}`
    );
  }

  // ----------------------------------------------------------------------------
  // T17 — §15 ARCHITECTURE : SÉPARATION DÉLAI ISO 2409 / ADHÉRENCE NF 927-2
  // ----------------------------------------------------------------------------
  {
    // criteriaAdhesion = délai d'application avant essai (NF EN ISO 2409:2020),
    // verdict CONFORME/NON_CONFORME sur la condition de protocole. Indépendant
    // de l'évaluation d'adhérence NF EN 927-2 (force en MPa) ; le critère NF
    // n'importe pas cette couche et part de FORCE_MEASURES_ABSENT.
    const delay = evaluateAdhesionDelayCriterion({
      applicationDateTime: '2026-09-01T08:00:00Z',
      measurementDateTime: '2026-09-10T08:00:00Z',
      requiredMinimumDelayHours: 48
    });
    const nfAdhesion = evaluateNf9272Criteria(createTrial()).results.ADHESION;

    record(
      57,
      'T17 §15 : criteriaAdhesion = condition de protocole ISO 2409 (délai), indépendant de l’évaluation NF 927-2',
      'ARCHITECTURE',
      delay.normativeReference === 'NF EN ISO 2409:2020' &&
        delay.origin === 'PROTOCOL_CONDITION' &&
        nfAdhesion.status === 'INSUFFICIENT_DATA' &&
        nfAdhesion.message.includes('FORCE') &&
        nfAdhesion.message.includes('aucune conversion'),
      'délai ISO 2409 séparé ; adhérence NF force-métrique sans conversion ni donnée fabriquée',
      `normativeReference=${delay.normativeReference}, verdict=${delay.verdict}, NF adhésion=${nfAdhesion.status}, message=${nfAdhesion.message}`
    );

    // Emplacement documenté du test d'adhérence NF : le fichier de critère de
    // délai n'est pas référencé par l'évaluateur NF (vérification statique du
    // couplage) : le répertoire en927/ n'importe pas criteriaAdhesion.
    const en927EvaluatorSource = readFileSync(
      fileURLToPath(new URL('../criteria/en927/en9272Evaluator.ts', import.meta.url)),
      'utf-8'
    );
    record(
      58,
      'T17 §15 : l’évaluateur NF EN 927-2 n’importe pas criteriaAdhesion (ISO 2409 délai)',
      'ARCHITECTURE',
      !en927EvaluatorSource.includes('criteriaAdhesion'),
      'aucun import de criteriaAdhesion dans en9272Evaluator.ts',
      `imports couplants=${en927EvaluatorSource.includes('criteriaAdhesion') ? 'OUI' : 'non'}`
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