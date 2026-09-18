/**
 * Évaluateur NF EN 927-2:2014 — référentiel de calcul HISTORIQUE / TRANSITOIRE
 * (HISTORICAL_TRANSITIONAL) — couche EVALUATOR.
 *
 * Orchestration : préparation (mapping) → calculs (moyennes brutes, somme des
 * 12 cotations individuelles, différence maximale) → exigences par catégorie
 * (seuils ≤) → classification SEQUENTIELLE 2014.
 *
 * Le moteur possède UN SEUL point d'entrée métier : `evaluateNf9272Criteria`.
 * Il n'y a PLUS de catégorie de performance en paramètre d'entrée : la
 * catégorie est le RÉSULTAT de la classification.
 *
 * Classement séquentiel (référence de calcul NF EN 927-2:2014) :
 *  - les 12 résultats sont les cotations INDIVIDUELLES (4 critères × 3
 *    éprouvettes exposées E1/E2/E3) — jamais issues de moyennes arrondies ;
 *  - `sum12` = somme des 12 résultats ; `maxDifference` = max(12) − min(12) ;
 *  - `maxDifference > 4` → INVALID_TEST (classification null). 4,0 reste VALID ;
 *  - classification HIÉRARCHIQUE la plus exigeante satisfaite :
 *    STABLE → SEMI_STABLE → NON_STABLE → sinon NO_CATEGORY_MET (essai VALID) ;
 *  - chaque catégorie est satisfaite si TOUTES les conditions sont remplies :
 *    4 moyennes ≤ seuils ET sum12 ≤ maxSum ET maxDifference ≤ maxDifference ;
 *  - NON_STABLE ≠ échec global ; VALID + NO_CATEGORY_MET est un résultat normal ;
 *  - INVALID_TEST / INSUFFICIENT_DATA → classification = null.
 *
 * Traçabilité : chaque évaluation porte reference, edition (2014), status
 * (HISTORICAL_TRANSITIONAL) et, pour chaque critère × catégorie,
 * valeur mesurée, seuil, opérateur ≤, PASS/FAIL. Les seuils restent portés par
 * en9272Requirements.ts ; aucun seuil normatif n'est codé ici.
 *
 * Ce module NE MODIFIE ni Trial, ni RAW/COMPUTED : évaluation en lecture seule.
 */

import type { Trial } from '../../../types/trial';
import type { CriterionEvaluationStatus as CriterionStatus } from '../common/criterionTypes';
import {
  NF9272_REFERENCE,
  NF9272_EDITION,
  NF9272_DOCUMENT,
  NF9272_TRACEABILITY_STATUS,
  NF9272_CALCULATION_STATUS,
  NF9272_COMPLEMENTARY_NOTICE,
  NF9272_TOTAL_VALUE_CHECK,
  NF9272_CLASSIFICATION_ORDER,
  getNf9272CategoryRequirements,
  type Nf9272CriterionId,
  type Nf9272PerformanceCategory,
  type Nf9272CategoryRequirements,
  type Nf9272ClassificationResult,
  type Nf9272TestValidity,
  type Nf9272Comparison
} from './en9272Requirements';
import {
  findNf9272Jalon,
  prepareNf9272CriterionData,
  type Nf9272PreparedData
} from './en9272Preparation';
import { resolveBatchScope, formatBatchSystem } from '../../panelUtils';
import { arithmeticMean, sumOfValues, maxDifferenceOfValues } from './en9272Calculations';

export type Nf9272EvaluatedCriterionId = Nf9272CriterionId;
export type Nf9272DefectCriterionId = 'BLISTERING' | 'CRACKING' | 'FLAKING';

/** Ordre canonique des 12 résultats : Blistering, Cracking, Flaking, Adhesion. */
export const NF9272_CRITERION_ORDER: readonly Nf9272CriterionId[] = [
  'BLISTERING',
  'CRACKING',
  'FLAKING',
  'ADHESION'
] as const;

export interface Nf9272EvaluatedStageInfo {
  stageId: string | null;
  cycleIndex: number | null;
  exposureHours: number | null;
  /** Libellé lisible, ex. 'C12 (2016 h)'. */
  display: string;
}

export interface Nf9272CriterionEvaluationResult {
  criterionId: Nf9272CriterionId;
  label: string;
  /**
   * Statut du critère :
   *  - FAVORABLE / DEFAVORABLE : comparaison de la moyenne au seuil applicable ;
   *  - INSUFFICIENT_DATA : jalon, portée ou éprouvettes manquantes ;
   *  - NOT_APPLICABLE : essai INVALID_TEST (aucune catégorie appliquée).
   * Jamais NON_EVALUE.
   */
  status: CriterionStatus;
  /** Moyenne arithmétique BRUTE (non arrondie) des 3 éprouvettes, ou `null`. */
  value: number | null;
  /**
   * Seuil applicable retenu :
   *  - catégorie classée (STABLE/SEMI_STABLE/NON_STABLE) : seuil de cette catégorie ;
   *  - NO_CATEGORY_MET : seuil NON_STABLE (le moins exigeant, valeur informative) ;
   *  - sinon `null`.
   */
  threshold: number | null;
  /** Opérateur de comparaison : toujours ≤ dans le classement séquentiel 2014. */
  operator: Nf9272Comparison;
  /** `true` si moyenne ≤ seuil (l'égalité passe), `null` si non comparable. */
  pass: boolean | null;
  /** Provenance documentaire // référence de calcul NF EN 927-2:2014. */
  provenance: {
    reference: string;
    edition: string;
    document: string | null;
    traceabilityStatus: string | null;
    section: string | null;
    paragraph: string | null;
    table: string | null;
    page: string | null;
    evaluationMode: 'COMPLEMENTARY';
    stage: string | null;
    cycleIndex: number | null;
    exposureHours: number | null;
  };
  message: string;
}

/** Comparaison d'UN critère contre le seuil d'UNE catégorie (traçabilité). */
export interface Nf9272CriterionCheck {
  criterionId: Nf9272CriterionId;
  measuredValue: number | null;
  threshold: number;
  operator: '≤';
  passed: boolean | null;
}

export interface Nf9272TotalValueCheck {
  value: number | null;
  maximum: number;
  operator: '≤';
  passed: boolean | null;
}

export interface Nf9272CategoryCheck {
  category: Nf9272PerformanceCategory;
  /** 4 critères, chacun comparé à son seuil de la catégorie. */
  criteria: Record<Nf9272CriterionId, Nf9272CriterionCheck>;
  /** Condition `sum12 ≤ maxSum` de la catégorie (7 / 12 / 19). */
  sum: Nf9272TotalValueCheck;
  /** Condition `maxDifference ≤ maxDifference` de la catégorie (2 / 3 / 4). */
  difference: Nf9272TotalValueCheck;
  /** Catégorie satisfaite : 4 critères ET somme ET écart (toutes les conditions). */
  passed: boolean | null;
}

export interface Nf9272CriteriaEvaluation {
  reference: string;
  /** Édition de calcul : '2014'. */
  edition: string;
  /** Statut de calcul : HISTORICAL_TRANSITIONAL. */
  status: typeof NF9272_CALCULATION_STATUS;
  evaluationMode: 'COMPLEMENTARY';
  complementaryNotice: string;
  /** Jalon C12 effectivement évalué (null si absent). */
  jalon: Nf9272EvaluatedStageInfo;
  /**
   * Système de finition (lot) sur lequel l'évaluation est portée.
   *  - `batchId` fourni : ce lot ;
   *  - un seul lot dans l'essai : ce lot ;
   *  - plusieurs lots sans sélection : `null` + `scopeBlockedReason` non nul —
   *    AUCUNE agrégation inter-systèmes n'est produite.
   */
  batchScoped: {
    batchId: string | null;
    batchLabel: string | null;
    /** Raison de refus si l'évaluation est bloquée par la portée système. `null` sinon. */
    scopeBlockedReason: string | null;
  };
  /**
   * Validité de l'essai, INDÉPENDANTE de la classification :
   *  - INSUFFICIENT_DATA : jalon absent, portée système non résolue ou
   *    éprouvettes exposées manquantes ;
   *  - INVALID_TEST : maxDifference > 4 (la classification vaut alors null) ;
   *  - VALID : l'essai permet une classification.
   */
  testValidity: Nf9272TestValidity;
  /**
   * Résultat de la classification séquentielle :
   * STABLE | SEMI_STABLE | NON_STABLE | NO_CATEGORY_MET, ou `null` si l'essai
   * n'est pas classable (INVALID_TEST / INSUFFICIENT_DATA).
   */
  classification: Nf9272ClassificationResult | null;
  /** Somme des 12 cotations INDIVIDUELLES (valeurs brutes), ou `null`. */
  sum12: number | null;
  /** Différence maximale max(12) − min(12), ou `null`. */
  maxDifference: number | null;
  /**
   * Contrôle de valeur totale : APPLIQUE — classement séquentiel 2014
   * (somme 7/12/19, écart 2/3/4) porté par le statut HISTORICAL_TRANSITIONAL.
   */
  totalValueCheck: typeof NF9272_TOTAL_VALUE_CHECK;
  /** Résultats par critère (moyenne, seuil applicable, PASS/FAIL). */
  results: Record<Nf9272CriterionId, Nf9272CriterionEvaluationResult>;
  /**
   * Traçabilité exhaustive par catégorie × critère : référence, édition,
   * statut de calcul, valeur mesurée, seuil, opérateur ≤, PASS/FAIL, somme,
   * écart. Remplie lorsque les 12 résultats sont disponibles.
   */
  categoryChecks: Record<Nf9272PerformanceCategory, Nf9272CategoryCheck>;
  /** Explicitement `false` : ce module ne produit jamais de verdict combiné de conformité. */
  hasGlobalVerdict: false;
}

export interface Nf9272EvaluateOptions {
  /**
   * Système de finition (lot) ciblé. Requis lorsque l'essai contient plusieurs
   * lots : sans lui, l'évaluation est refusée (aucune moyenne inter-systèmes).
   */
  batchId?: string;
}

export interface Nf9272SequentialOutcome {
  testValidity: 'VALID' | 'INVALID_TEST';
  classification: Nf9272ClassificationResult | null;
}

const CRITERION_LABELS: Record<Nf9272CriterionId, string> = {
  BLISTERING: 'Cloquage (Blistering)',
  CRACKING: 'Craquelage (Cracking)',
  FLAKING: 'Écaillage (Flaking)',
  ADHESION: 'Adhérence (Adhesion)'
};

function findStageById(trial: Trial, stageId: string) {
  return trial.stages.find((s) => s.id === stageId) ?? null;
}

function buildResultFor(
  criterionId: Nf9272CriterionId,
  stage: Nf9272CriteriaEvaluation['jalon']
): Nf9272CriterionEvaluationResult {
  return {
    criterionId,
    label: CRITERION_LABELS[criterionId],
    status: 'INSUFFICIENT_DATA',
    value: null,
    threshold: null,
    operator: 'LESS_OR_EQUAL',
    pass: null,
    provenance: {
      reference: NF9272_REFERENCE,
      edition: NF9272_EDITION,
      document: NF9272_DOCUMENT,
      traceabilityStatus: NF9272_TRACEABILITY_STATUS,
      section: null,
      paragraph: null,
      table: null,
      page: null,
      evaluationMode: 'COMPLEMENTARY',
      stage: stage.stageId,
      cycleIndex: stage.cycleIndex,
      exposureHours: stage.exposureHours
    },
    message: `Jalon C${stage.cycleIndex ?? '?'} (${stage.exposureHours ?? '?'} h) absent de l'essai : données insuffisantes pour évaluer ${CRITERION_LABELS[criterionId]}.`
  };
}

/**
 * Compare une moyenne système à un seuil (opérateur ≤). Fonction pure exposée :
 * l'égalité au seuil est FAVORABLE (0,7 ≤ 0,7 PASS ; 0,7001 > 0,7 FAIL).
 * `GREATER_OR_EQUAL` est conservé pour compatibilité (non utilisé par la
 * référence de calcul 2014, exclusivement ≤).
 */
export function compareNf9272Mean(
  comparison: 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL',
  mean: number,
  threshold: number
): CriterionStatus {
  return comparison === 'LESS_OR_EQUAL' ? (mean <= threshold ? 'FAVORABLE' : 'DEFAVORABLE') : (mean >= threshold ? 'FAVORABLE' : 'DEFAVORABLE');
}

/**
 * Condition de SOMME du classement séquentiel : `sum12 ≤ maxSum` (l'égalité
 * passe). Bornes documentées : 7,0 → PASS ; 7,1 → FAIL (idem 12,0/12,1 et 19,0/19,1).
 */
export function compareNf9272Sum(sum12: number, maxSum: number): boolean {
  return sum12 <= maxSum;
}

/**
 * Condition d'ÉCART du classement séquentiel : `difference ≤ maxDifference`
 * (l'égalité passe). Bornes documentées : 2,0 → PASS ; 2,1 → FAIL (idem 3,0/3,1
 * et 4,0/4,1). Une différence de 4,1 rend l'essai INVALID_TEST.
 */
export function compareNf9272Difference(difference: number, maxDifference: number): boolean {
  return difference <= maxDifference;
}

function buildDefaultCategoryRequirements(): Record<Nf9272PerformanceCategory, Nf9272CategoryRequirements> {
  const refs = {} as Record<Nf9272PerformanceCategory, Nf9272CategoryRequirements>;
  for (const cat of NF9272_CLASSIFICATION_ORDER) {
    refs[cat] = getNf9272CategoryRequirements(cat);
  }
  return refs;
}

const DEFAULT_CATEGORY_REQUIREMENTS = buildDefaultCategoryRequirements();

/**
 * Classification SEQUENTIELLE 2014 (fonction pure, indépendante de l'essai).
 *
 * 1. Validité : `maxDifference > maxDifference(NON_STABLE)` → INVALID_TEST,
 *    classification `null`. 2. Hiérarchie la plus exigeante satisfaite :
 *    STABLE → SEMI_STABLE → NON_STABLE (4 moyennes ≤ seuils ET sum12 ≤ maxSum
 *    ET maxDifference ≤ maxDifference). 3. Sinon : VALID + NO_CATEGORY_MET.
 */
export function classifyNf9272Sequence(
  means: Record<Nf9272CriterionId, number>,
  sum12: number,
  maxDifference: number,
  categories: Record<Nf9272PerformanceCategory, Nf9272CategoryRequirements> = DEFAULT_CATEGORY_REQUIREMENTS
): Nf9272SequentialOutcome {
  const validityLimit = categories.NON_STABLE.maxDifference;
  if (maxDifference > validityLimit) {
    return { testValidity: 'INVALID_TEST', classification: null };
  }
  for (const category of NF9272_CLASSIFICATION_ORDER) {
    const req = categories[category];
    const criteriaPassed = NF9272_CRITERION_ORDER.every(
      (c) => compareNf9272Mean('LESS_OR_EQUAL', means[c], req.criteria[c].threshold) === 'FAVORABLE'
    );
    const sumPassed = compareNf9272Sum(sum12, req.maxSum);
    const differencePassed = compareNf9272Difference(maxDifference, req.maxDifference);
    if (criteriaPassed && sumPassed && differencePassed) {
      return { testValidity: 'VALID', classification: category };
    }
  }
  return { testValidity: 'VALID', classification: 'NO_CATEGORY_MET' };
}

function emptyCategoryChecks(): Record<Nf9272PerformanceCategory, Nf9272CategoryCheck> {
  const out = {} as Record<Nf9272PerformanceCategory, Nf9272CategoryCheck>;
  for (const category of NF9272_CLASSIFICATION_ORDER) {
    const req = getNf9272CategoryRequirements(category);
    const criteria = {} as Record<Nf9272CriterionId, Nf9272CriterionCheck>;
    for (const c of NF9272_CRITERION_ORDER) {
      criteria[c] = {
        criterionId: c,
        measuredValue: null,
        threshold: req.criteria[c].threshold,
        operator: '≤',
        passed: null
      };
    }
    out[category] = {
      category,
      criteria,
      sum: { value: null, maximum: req.maxSum, operator: '≤', passed: null },
      difference: { value: null, maximum: req.maxDifference, operator: '≤', passed: null },
      passed: null
    };
  }
  return out;
}

function buildCategoryChecks(
  means: Record<Nf9272CriterionId, number>,
  sum12: number,
  maxDifference: number
): Record<Nf9272PerformanceCategory, Nf9272CategoryCheck> {
  const out = {} as Record<Nf9272PerformanceCategory, Nf9272CategoryCheck>;
  for (const category of NF9272_CLASSIFICATION_ORDER) {
    const req = getNf9272CategoryRequirements(category);
    const criteria = {} as Record<Nf9272CriterionId, Nf9272CriterionCheck>;
    let allPassed = true;
    for (const c of NF9272_CRITERION_ORDER) {
      const passed = compareNf9272Mean('LESS_OR_EQUAL', means[c], req.criteria[c].threshold) === 'FAVORABLE';
      criteria[c] = {
        criterionId: c,
        measuredValue: means[c],
        threshold: req.criteria[c].threshold,
        operator: '≤',
        passed
      };
      if (!passed) allPassed = false;
    }
    const sumPassed = compareNf9272Sum(sum12, req.maxSum);
    const differencePassed = compareNf9272Difference(maxDifference, req.maxDifference);
    out[category] = {
      category,
      criteria,
      sum: { value: sum12, maximum: req.maxSum, operator: '≤', passed: sumPassed },
      difference: { value: maxDifference, maximum: req.maxDifference, operator: '≤', passed: differencePassed },
      passed: allPassed && sumPassed && differencePassed
    };
  }
  return out;
}

/**
 * Évalue les critères NF EN 927-2 (référentiel de calcul 2014, statut
 * HISTORICAL_TRANSITIONAL) d'un essai au jalon C12 : préparation → calculs →
 * classification séquentielle. Lecture seule : ne modifie ni le Trial, ni
 * RAW/COMPUTED. Point d'entrée métier UNIQUE du module en927.
 */
export function evaluateNf9272Criteria(trial: Trial, options?: Nf9272EvaluateOptions): Nf9272CriteriaEvaluation {
  const jalonStage = findNf9272Jalon(trial);
  const scope = resolveBatchScope(trial.batches, options?.batchId);

  const batchScoped: Nf9272CriteriaEvaluation['batchScoped'] =
    scope.kind === 'OK'
      ? {
          batchId: scope.batch.id,
          batchLabel: formatBatchSystem(scope.batch),
          scopeBlockedReason: null
        }
      : scope.kind === 'MULTIPLE_BATCHES_NO_SELECTION'
        ? {
            batchId: null,
            batchLabel: null,
            scopeBlockedReason: `Essai multi-lots (${scope.batchCount} systèmes de finition détectés) : l'évaluation NF EN 927-2 s'applique PAR SYSTÈME. Aucune agrégation inter-systèmes n'est produite. Fournissez batchId pour cibler un système (LOT).`
          }
        : scope.kind === 'UNKNOWN_BATCH_ID'
          ? {
              batchId: null,
              batchLabel: null,
              scopeBlockedReason: `batchId « ${scope.batchId} » introuvable dans l'essai : évaluation refusée.`
            }
          : {
              batchId: null,
              batchLabel: null,
              scopeBlockedReason: 'Aucun lot (système de finition) dans l\'essai : évaluation refusée.'
            };

  const jalon: Nf9272CriteriaEvaluation['jalon'] = jalonStage
    ? {
        stageId: jalonStage.id,
        cycleIndex: jalonStage.cycleIndex,
        exposureHours: jalonStage.scheduledExposureHours,
        display: `C${jalonStage.cycleIndex} (${jalonStage.scheduledExposureHours} h)`
      }
    : { stageId: null, cycleIndex: null, exposureHours: null, display: 'Aucun jalon C12 dans les étapes' };

  const results = {} as Record<Nf9272CriterionId, Nf9272CriterionEvaluationResult>;

  // 1. Données préparation
  const preparedByCriterion = {} as Partial<Record<Nf9272CriterionId, Nf9272PreparedData>>;
  let insufficiencyMessage: string | null = null;

  if (!jalon.stageId) {
    insufficiencyMessage = jalon.display;
  } else if (batchScoped.scopeBlockedReason) {
    insufficiencyMessage = batchScoped.scopeBlockedReason;
  } else {
    const stage = findStageById(trial, jalon.stageId);
    if (!stage) {
      insufficiencyMessage = `Jalon ${jalon.display} introuvable dans les étapes de l'essai.`;
    } else {
      for (const criterionId of NF9272_CRITERION_ORDER) {
        const prepared = prepareNf9272CriterionData(trial, stage, criterionId, {
          batchId: batchScoped.batchId ?? undefined
        });
        if (!prepared || !prepared.available || prepared.specimens.length < 3) {
          insufficiencyMessage = `Données insuffisantes au jalon C12 : moins de 3 éprouvettes exposées (E1/E2/E3) valides pour ${CRITERION_LABELS[criterionId]} (${prepared ? prepared.specimens.length : 0}/3 disponibles).`;
          break;
        }
        preparedByCriterion[criterionId] = prepared;
      }
    }
  }

  // 2. Résultats par défaut
  for (const criterionId of NF9272_CRITERION_ORDER) {
    results[criterionId] = buildResultFor(criterionId, jalon);
  }

  if (insufficiencyMessage) {
    for (const criterionId of NF9272_CRITERION_ORDER) {
      results[criterionId].status = 'INSUFFICIENT_DATA';
      results[criterionId].message = `${insufficiencyMessage} → ${CRITERION_LABELS[criterionId]} non évalué.`;
    }
    return {
      reference: NF9272_REFERENCE,
      edition: NF9272_EDITION,
      status: NF9272_CALCULATION_STATUS,
      evaluationMode: 'COMPLEMENTARY',
      complementaryNotice: NF9272_COMPLEMENTARY_NOTICE,
      jalon,
      batchScoped,
      testValidity: 'INSUFFICIENT_DATA',
      classification: null,
      sum12: null,
      maxDifference: null,
      totalValueCheck: NF9272_TOTAL_VALUE_CHECK,
      results,
      categoryChecks: emptyCategoryChecks(),
      hasGlobalVerdict: false
    };
  }

  // 3. Calculs : moyennes brutes, sum12, maxDifference
  const means = {} as Record<Nf9272CriterionId, number>;
  const allTwelve: number[] = [];
  for (const criterionId of NF9272_CRITERION_ORDER) {
    const prepared = preparedByCriterion[criterionId];
    const mean = prepared ? arithmeticMean(prepared.specimens.map((s) => s.value)) : null;
    if (mean === null) {
      for (const c of NF9272_CRITERION_ORDER) {
        results[c].status = 'INSUFFICIENT_DATA';
        results[c].message = `Données insuffisantes au jalon C12 : aucune cotation valide pour ${CRITERION_LABELS[c]}.`;
      }
      return {
        reference: NF9272_REFERENCE,
        edition: NF9272_EDITION,
        status: NF9272_CALCULATION_STATUS,
        evaluationMode: 'COMPLEMENTARY',
        complementaryNotice: NF9272_COMPLEMENTARY_NOTICE,
        jalon,
        batchScoped,
        testValidity: 'INSUFFICIENT_DATA',
        classification: null,
        sum12: null,
        maxDifference: null,
        totalValueCheck: NF9272_TOTAL_VALUE_CHECK,
        results,
        categoryChecks: emptyCategoryChecks(),
        hasGlobalVerdict: false
      };
    }
    means[criterionId] = mean;
    prepared!.specimens.forEach((s) => allTwelve.push(s.value));
  }

  const sum12 = sumOfValues(allTwelve);
  const maxDifference = maxDifferenceOfValues(allTwelve);
  if (sum12 === null || maxDifference === null) {
    return {
      reference: NF9272_REFERENCE,
      edition: NF9272_EDITION,
      status: NF9272_CALCULATION_STATUS,
      evaluationMode: 'COMPLEMENTARY',
      complementaryNotice: NF9272_COMPLEMENTARY_NOTICE,
      jalon,
      batchScoped,
      testValidity: 'INSUFFICIENT_DATA',
      classification: null,
      sum12: null,
      maxDifference: null,
      totalValueCheck: NF9272_TOTAL_VALUE_CHECK,
      results,
      categoryChecks: emptyCategoryChecks(),
      hasGlobalVerdict: false
    };
  }

  const outcome = classifyNf9272Sequence(means, sum12, maxDifference);

  // 4. Résultats par critère : seuil applicable = catégorie classée, ou
  //    NON_STABLE (le moins exigeant) en cas de NO_CATEGORY_MET.
  const applicableRequirements =
    outcome.classification === 'STABLE' || outcome.classification === 'SEMI_STABLE' || outcome.classification === 'NON_STABLE'
      ? getNf9272CategoryRequirements(outcome.classification)
      : getNf9272CategoryRequirements('NON_STABLE');

  for (const criterionId of NF9272_CRITERION_ORDER) {
    const result = results[criterionId];
    result.value = means[criterionId];
    result.operator = 'LESS_OR_EQUAL';
    if (outcome.testValidity === 'INVALID_TEST') {
      result.status = 'NOT_APPLICABLE';
      result.threshold = null;
      result.pass = null;
      result.message = `Différence maximale max(12)−min(12) > 4 (${maxDifference}) : essai INVALID_TEST → aucune classification, ${CRITERION_LABELS[criterionId]} non applicable.`;
      continue;
    }
    const req = applicableRequirements.criteria[criterionId];
    result.threshold = req.threshold;
    const status = compareNf9272Mean('LESS_OR_EQUAL', means[criterionId], req.threshold);
    result.status = status;
    result.pass = status === 'FAVORABLE';
    const suffix =
      outcome.classification === 'NO_CATEGORY_MET'
        ? ` Aucune catégorie de performance satisfaite (essai valide) : seuil NON_STABLE informatif.`
        : ` Catégorie classée : ${outcome.classification}.`;
    result.message = `Moyenne C12 des éprouvettes exposées E1/E2/E3 (système ${batchScoped.batchLabel ?? '?'}) : ${means[criterionId]}. Seuil documenté ≤ ${req.threshold} → ${status}.${suffix}`;
  }

  return {
    reference: NF9272_REFERENCE,
    edition: NF9272_EDITION,
    status: NF9272_CALCULATION_STATUS,
    evaluationMode: 'COMPLEMENTARY',
    complementaryNotice: NF9272_COMPLEMENTARY_NOTICE,
    jalon,
    batchScoped,
    testValidity: outcome.testValidity,
    classification: outcome.classification,
    sum12,
    maxDifference,
    totalValueCheck: NF9272_TOTAL_VALUE_CHECK,
    results,
    categoryChecks: buildCategoryChecks(means, sum12, maxDifference),
    hasGlobalVerdict: false
  };
}