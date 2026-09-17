/**
 * Évaluateur NF EN 927-2:2022 — couche EVALUATOR.
 *
 * Orchestration : préparation (mapping) → calculs (moyennes) → exigences
 * (seuils) → statut final par CRITÈRE. Il n'existe AUCUN verdict global : chaque
 * critère (Blistering, Cracking, Flaking, Adhesion) est évalué de façon
 * indépendante.
 *
 * Jalon : uniquement C12 (cycle 12, 2016 h). Pas de T0/C1..C11, pas
 * d'interpolation. Statuts : FAVORABLE | DEFAVORABLE | NOT_APPLICABLE |
 * INSUFFICIENT_DATA (jamais NON_EVALUE).
 *
 *  - catégorie non documentée (Semi-stable/Non-stable) : NOT_APPLICABLE ;
 *  - jalon absent ou éprouvettes requises manquantes : INSUFFICIENT_DATA ;
 *  - Adhérence : BLOCAGE documenté (Cas B) — les mesures individuelles de force
 *    d'adhérence n'existent pas dans le pipeline QUV-Lab (classes ISO 2409
 *    uniquement) → INSUFFICIENT_DATA. Aucune conversion de classe vers une force
 *    en MPa n'est réalisée.
 *  - `totalValueCheck` : NOT_APPLICABLE (anciennes règles 7/12/19 et 2/3/4 jamais
 *    réintroduites).
 *
 * Ce module NE MODIFIE ni Trial, ni RAW/COMPUTED : évaluation en lecture seule.
 */

import type { Trial } from '../../../types/trial';
import type { CriterionEvaluationStatus as CriterionStatus } from '../common/criterionTypes';
import {
  NF9272_REFERENCE,
  NF9272_EDITION,
  NF9272_DOCUMENT,
  NF9272_COMPLEMENTARY_NOTICE,
  NF9272_TOTAL_VALUE_CHECK,
  getNf9272CategoryRequirements,
  type Nf9272CriterionId,
  type Nf9272PerformanceCategory
} from './en9272Requirements';
import {
  findNf9272Jalon,
  prepareNf9272CriterionData
} from './en9272Preparation';
import { defectMean } from './en9272Calculations';

export type Nf9272EvaluatedCriterionId = Nf9272CriterionId;
export type Nf9272DefectCriterionId = 'BLISTERING' | 'CRACKING' | 'FLAKING';

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
  /** Statut complet ; jamais NON_EVALUE. */
  status: CriterionStatus;
  /** Valeur moyenne calculée (nombre) ou `null` si non calculable. */
  value: number | null;
  /** Seuil documenté du critère ou `null` si non documenté. */
  threshold: number | null;
  /** Provenance documentaire NF EN 927-2:2022. */
  provenance: {
    reference: string;
    edition: string;
    document: string | null;
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

export interface Nf9272CriteriaEvaluation {
  reference: string;
  edition: string;
  evaluationMode: 'COMPLEMENTARY';
  complementaryNotice: string;
  /** Catégorie de performance évaluée (paramètre d'entrée, défaut STABLE). */
  category: Nf9272PerformanceCategory;
  /** Jalon C12 effectivement évalué (null si absent). */
  jalon: Nf9272EvaluatedStageInfo;
  /**
   * Contrôle de valeur totale : systématiquement NOT_APPLICABLE. Les anciennes
   * règles de comparaison de totaux (7/12/19) et d'écarts max (2/3/4) ne sont
   * pas réintroduites.
   */
  totalValueCheck: typeof NF9272_TOTAL_VALUE_CHECK;
  /** Résultats INDÉPENDANTS par critère ; aucun résultat global/combiné. */
  results: Record<Nf9272CriterionId, Nf9272CriterionEvaluationResult>;
  /** Explicitement `false` : ce module ne produit jamais de verdict combiné. */
  hasGlobalVerdict: false;
}

export interface Nf9272EvaluateOptions {
  /** Catégorie de performance (défaut STABLE). */
  category?: Nf9272PerformanceCategory;
}

const CRITERION_LABELS: Record<Nf9272CriterionId, string> = {
  BLISTERING: 'Cloquage (Blistering)',
  CRACKING: 'Craquelage (Cracking)',
  FLAKING: 'Écaillage (Flaking)',
  ADHESION: 'Adhérence (Adhesion)'
};

function criterionRequirements(
  categoryRequirements: ReturnType<typeof getNf9272CategoryRequirements>,
  criterionId: Nf9272CriterionId
) {
  return categoryRequirements.criteria[criterionId] ?? null;
}

function buildResultFor(
  criterionId: Nf9272CriterionId,
  category: Nf9272PerformanceCategory,
  stage: Nf9272CriteriaEvaluation['jalon']
): Nf9272CriterionEvaluationResult {
  return {
    criterionId,
    label: CRITERION_LABELS[criterionId],
    status: 'INSUFFICIENT_DATA',
    value: null,
    threshold: null,
    provenance: {
      reference: NF9272_REFERENCE,
      edition: NF9272_EDITION,
      document: NF9272_DOCUMENT,
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
 * Compare une moyenne système à l'exigence documentée (sens selon le critère).
 * Fonction pure exposée : défauts favorables si moyenne ≤ seuil, adhérence
 * favorable si moyenne ≥ seuil. L'égalité au seuil est FAVORABLE.
 */
export function compareNf9272Mean(
  comparison: 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL',
  mean: number,
  threshold: number
): CriterionStatus {
  return comparison === 'LESS_OR_EQUAL' ? (mean <= threshold ? 'FAVORABLE' : 'DEFAVORABLE') : (mean >= threshold ? 'FAVORABLE' : 'DEFAVORABLE');
}

/**
 * Évalue les critères NF EN 927-2:2022 d'un essai au jalon C12.
 * Lecture seule : ne modifie ni le Trial, ni RAW/COMPUTED.
 */
export function evaluateNf9272Criteria(trial: Trial, options?: Nf9272EvaluateOptions): Nf9272CriteriaEvaluation {
  const category: Nf9272PerformanceCategory = options?.category ?? 'STABLE';
  const categoryRequirements = getNf9272CategoryRequirements(category);
  const jalonStage = findNf9272Jalon(trial);

  const jalon: Nf9272CriteriaEvaluation['jalon'] = jalonStage
    ? {
        stageId: jalonStage.id,
        cycleIndex: jalonStage.cycleIndex,
        exposureHours: jalonStage.scheduledExposureHours,
        display: `C${jalonStage.cycleIndex} (${jalonStage.scheduledExposureHours} h)`
      }
    : { stageId: null, cycleIndex: null, exposureHours: null, display: 'Aucun jalon C12 dans les étapes' };

  const results = {} as Record<Nf9272CriterionId, Nf9272CriterionEvaluationResult>;

  const defectCriterionIds: Nf9272DefectCriterionId[] = ['BLISTERING', 'CRACKING', 'FLAKING'];
  for (const criterionId of defectCriterionIds) {
    results[criterionId] = evaluateDefectCriterion(criterionId, category, categoryRequirements, jalon, trial);
  }
  results['ADHESION'] = evaluateAdhesionCriterion('ADHESION', category, categoryRequirements, jalon, trial);

  return {
    reference: NF9272_REFERENCE,
    edition: NF9272_EDITION,
    evaluationMode: 'COMPLEMENTARY',
    complementaryNotice: NF9272_COMPLEMENTARY_NOTICE,
    category,
    jalon,
    totalValueCheck: NF9272_TOTAL_VALUE_CHECK,
    results,
    hasGlobalVerdict: false
  };
}

function evaluateDefectCriterion(
  criterionId: Nf9272DefectCriterionId,
  category: Nf9272PerformanceCategory,
  categoryRequirements: ReturnType<typeof getNf9272CategoryRequirements>,
  jalon: Nf9272CriteriaEvaluation['jalon'],
  trial: Trial
): Nf9272CriterionEvaluationResult {
  const result = buildResultFor(criterionId, category, jalon);
  if (!jalon.stageId) return result;

  const requirement = criterionRequirements(categoryRequirements, criterionId);
  if (!requirement) {
    result.status = 'NOT_APPLICABLE';
    result.threshold = null;
    result.message = `Critère NF EN 927-2:2022 non documenté pour la catégorie « ${category} » : aucun seuil disponible (source scientifique du projet).`;
    return result;
  }
  result.threshold = requirement.threshold;

  const stage = findStageById(trial, jalon.stageId);
  const prepared = stage ? prepareNf9272CriterionData(trial, stage, criterionId) : null;
  if (!prepared) {
    result.status = 'INSUFFICIENT_DATA';
    result.message = `Jalon ${jalon.display} introuvable : données insuffisantes pour ${CRITERION_LABELS[criterionId]}.`;
    return result;
  }
  if (prepared.category !== criterionId || !prepared.available || prepared.specimens.length < 3) {
    result.status = 'INSUFFICIENT_DATA';
    const missing = prepared.category === criterionId ? 3 - prepared.specimens.length : 3;
    result.message = `Données insuffisantes au jalon C12 : ${missing} éprouvette(s) exposée(s) (E1/E2/E3) valide(s) manquante(s) pour ${CRITERION_LABELS[criterionId]}.`;
    return result;
  }

  const mean = defectMean(prepared.specimens.map((s) => s.value));
  if (mean === null) {
    result.status = 'INSUFFICIENT_DATA';
    result.message = `Données insuffisantes : aucune cotation valide pour ${CRITERION_LABELS[criterionId]}.`;
    return result;
  }

  result.value = mean;
  result.status = compareNf9272Mean(requirement.comparison, mean, requirement.threshold);
  const relation = requirement.comparison === 'LESS_OR_EQUAL' ? '≤' : '≥';
  result.message = `Moyenne C12 des éprouvettes exposées E1/E2/E3 : ${mean}. Seuil documenté ${relation} ${requirement.threshold} → ${result.status}.`;
  return result;
}

function evaluateAdhesionCriterion(
  criterionId: Nf9272CriterionId,
  category: Nf9272PerformanceCategory,
  categoryRequirements: ReturnType<typeof getNf9272CategoryRequirements>,
  jalon: Nf9272CriteriaEvaluation['jalon'],
  trial: Trial
): Nf9272CriterionEvaluationResult {
  const result = buildResultFor(criterionId, category, jalon);
  if (!jalon.stageId) return result;

  const requirement = criterionRequirements(categoryRequirements, criterionId);
  if (!requirement) {
    result.status = 'NOT_APPLICABLE';
    result.threshold = null;
    result.message = `Critère NF EN 927-2:2022 non documenté pour la catégorie « ${category} » : aucun seuil disponible (source scientifique du projet).`;
    return result;
  }
  result.threshold = requirement.threshold;

  const stage = findStageById(trial, jalon.stageId);
  const prepared = stage ? prepareNf9272CriterionData(trial, stage, 'ADHESION') : null;
  if (!prepared || prepared.category !== 'ADHESION' || !stage) {
    result.status = 'INSUFFICIENT_DATA';
    result.message = `Données insuffisantes au jalon C12 : mesures d'adhérence non exploitables.`;
    return result;
  }
  if (!prepared.available) {
    result.status = 'INSUFFICIENT_DATA';
    result.message =
      'BLOCAGE documenté (Cas B) : l’évaluation NF EN 927-2:2022 de l’adhérence exige des valeurs individuelles de FORCE d’adhérence (2 mesures/éprouvette). Le pipeline QUV-Lab ne fournit que des classes ISO 2409 (0-5), jamais de mesure de force en MPa ; aucune conversion ni donnée fabriquée. Données non disponibles → INSUFFICIENT_DATA.';
    return result;
  }
  result.status = 'INSUFFICIENT_DATA';
  result.message = 'Données d’adhérence non exploitables : aucune moyenne de force disponible.';
  return result;
}

function findStageById(trial: Trial, stageId: string) {
  return trial.stages.find((s) => s.id === stageId) ?? null;
}