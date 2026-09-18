/**
 * Exigences scientifiques NF EN 927-2:2014 — couche métadonnées uniquement.
 *
 * Statut : HISTORICAL_TRANSITIONAL. La NF EN 927-2:2014 est conservée comme
 * RÉFÉRENTIEL DE CALCUL historique/transitoire du projet (classement séquentiel :
 * somme des 12 cotations individuelles, différence maximale, catégories de
 * performance). Ces valeurs ne sont PAS présentées comme les exigences
 * normatives courantes ; la migration vers la NF EN 927-2:2022 (valeurs
 * documentaires non vérifiées, statut « À DÉFINIR / À VALIDER
 * SCIENTIFIQUEMENT ») sera réalisée dans une évolution dédiée.
 *
 * Aucune opération numérique : ce module ne fait que porter la description du
 * référentiel, des catégories et des seuils documentés. Les comparaisons
 * appartiennent à l'évaluateur (en9272Evaluator.ts), les calculs (moyennes,
 * somme des 12 résultats, différence maximale) au moteur de calcul
 * (en9272Calculations.ts).
 *
 * Jalon d'évaluation : uniquement C12 = cycle 12 à 2016 h d'exposition (12 × 168 h).
 * T0, C1..C11 et toute interpolation/extrapolation sont hors périmètre.
 */

import type { CriterionSource } from '../common/criterionTypes';
import { TRACEABILITY_STATUS_TO_BE_DEFINED } from '../common/criterionTypes';

export const NF9272_SOURCE: CriterionSource = 'NF_EN_927_2';
export const NF9272_REFERENCE = 'NF EN 927-2';
/** Édition utilisée pour le CALCUL : 2014 (référentiel historique/transitoire). */
export const NF9272_EDITION = '2014';
export const NF9272_DOCUMENT = 'NF EN 927-2:2014';

/**
 * Édition documentaire 2022 : NON utilisée pour le calcul. La migration vers la
 * NF EN 927-2:2022 est une évolution future dédiée ; sa traçabilité documentaire
 * reste conservée (statut « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT »).
 */
export const NF9272_EDITION_2022 = '2022';
export const NF9272_DOCUMENT_2022 = 'NF EN 927-2:2022';

/**
 * Statut du référentiel de calcul : HISTORICAL_TRANSITIONAL.
 * Les valeurs NF EN 927-2:2014 ne sont pas les exigences courantes du référentiel
 * normatif ; elles sont conservées comme mécanisme de calcul transitoire du
 * projet. Aucun résultat produit n'est une déclaration de conformité.
 */
export const NF9272_CALCULATION_STATUS = 'HISTORICAL_TRANSITIONAL';

/**
 * Statut de traçabilité des seuils NF EN 927-2:2014 : les emplacements précis
 * (section/paragraphe/tableau/page) au sein du document édition 2014 ne sont
 * PAS vérifiés dans la source scientifique du projet. Aucun emplacement n'est
 * inventé ; la provenance porte explicitement « À DÉFINIR / À VALIDER
 * SCIENTIFIQUEMENT ».
 */
export const NF9272_TRACEABILITY_STATUS = TRACEABILITY_STATUS_TO_BE_DEFINED;

/** Jalon d'évaluation exigé : cycle 12, 2016 h. */
export const NF9272_REQUIRED_CYCLE_INDEX = 12;
export const NF9272_REQUIRED_EXPOSURE_HOURS = 2016;

/**
 * Différence maximale (max(12) − min(12)) au-delà de laquelle l'ESSAI est
 * INVALID_TEST : 4,0 (borne de NON_STABLE). Une différence de 4,1 invalide le
 * test ; 4,0 reste un essai valide. La validité est indépendante de la
 * classification.
 */
export const NF9272_TEST_VALIDITY_MAX_DIFFERENCE = 4;

/**
 * Contrôle de valeur totale : APPLIQUÉ — classement séquentiel de la référence
 * de calcul NF EN 927-2:2014 (somme des 12 cotations individuelles, différence
 * maximale). Cette constante documente que les règles de totaux (7/12/19) et
 * d'écarts (2/3/4) sont réintroduites EXCLUSIVEMENT sous le statut
 * HISTORICAL_TRANSITIONAL de calcul, jamais comme exigences normatives 2022.
 */
export const NF9272_TOTAL_VALUE_CHECK = 'APPLIED_SEQUENTIAL_2014' as const;

/**
 * Notice obligatoire portée par l'évaluation : mode COMPLEMENTARY.
 * L'évaluation NF EN 927-2 ne constitue jamais, à elle seule, une déclaration
 * de conformité au référentiel.
 */
export const NF9272_COMPLEMENTARY_NOTICE =
  'Évaluation complémentaire après vieillissement artificiel selon NF EN 927-6. ' +
  'Les résultats sont comparés aux critères de performance de la NF EN 927-2. ' +
  'Cette évaluation ne constitue pas, à elle seule, une déclaration de conformité à la NF EN 927-2.';

export type Nf9272PerformanceCategory = 'STABLE' | 'SEMI_STABLE' | 'NON_STABLE';
export type Nf9272CriterionId = 'BLISTERING' | 'CRACKING' | 'FLAKING' | 'ADHESION';

/**
 * Résultat de classification du classement séquentiel :
 *  - catégorie de performance la plus exigeante satisfaite (STABLE, SEMI_STABLE, NON_STABLE) ;
 *  - NO_CATEGORY_MET : essai VALID mais aucune catégorie satisfaite (résultat normal, non un échec).
 */
export type Nf9272ClassificationResult =
  | Nf9272PerformanceCategory
  | 'NO_CATEGORY_MET';

/** Validité de l'essai, indépendante de la classification. */
export type Nf9272TestValidity = 'VALID' | 'INVALID_TEST' | 'INSUFFICIENT_DATA';

/** Hiérarchie : de la catégorie la plus exigeante à la moins exigeante. */
export const NF9272_CLASSIFICATION_ORDER: readonly Nf9272PerformanceCategory[] = [
  'STABLE',
  'SEMI_STABLE',
  'NON_STABLE'
];

/** Sens de comparaison : exclusivement « mesuré ≤ seuil » (favorable à l'égalité). */
export type Nf9272Comparison = 'LESS_OR_EQUAL';

export interface Nf9272CriterionRequirement {
  criterionId: Nf9272CriterionId;
  label: string;
  /**
   * Seuil documenté pour la catégorie de performance (mécanisme séquentiel 2014).
   * Favorable si moyenne mesurée ≤ seuil (opérateur ≤, égalité PASS).
   */
  threshold: number;
  /** Toujours LESS_OR_EQUAL dans le classement 2014 (défauts ET adhérence cotée). */
  comparison: Nf9272Comparison;
  /** Unité de la valeur. `null` si non documentée dans le corpus. */
  unit: string | null;
  /** Provenance du seuil (référentiel NF EN 927-2:2014, champ de source non détaillé). */
  provenance: {
    reference: typeof NF9272_REFERENCE;
    edition: typeof NF9272_EDITION;
    document: typeof NF9272_DOCUMENT;
    traceabilityStatus: typeof NF9272_TRACEABILITY_STATUS;
    section: string | null;
    paragraph: string | null;
    table: string | null;
    page: string | null;
  };
}

export interface Nf9272CategoryRequirements {
  category: Nf9272PerformanceCategory;
  /** Les trois catégories (2014) sont documentées : `true`. */
  documented: boolean;
  /** Exigences par critère (4 critères, opérateur ≤). */
  criteria: Record<Nf9272CriterionId, Nf9272CriterionRequirement>;
  /**
   * Somme maximale autorisée des 12 cotations INDIVIDUELLES
   * (4 critères × 3 éprouvettes exposées E1/E2/E3). Jamais calculée depuis des
   * moyennes arrondies : somme des valeurs brutes.
   */
  maxSum: number;
  /**
   * Différence maximale autorisée entre la cotation la plus forte et la plus
   * faible des 12 résultats : max(12) − min(12).
   */
  maxDifference: number;
  /** Description de la catégorie dans la documentation du projet. */
  categoryDescription: string;
}

const NF9272_SOURCE_PROVENANCE = {
  reference: NF9272_REFERENCE,
  edition: NF9272_EDITION,
  document: NF9272_DOCUMENT,
  traceabilityStatus: NF9272_TRACEABILITY_STATUS,
  section: null,
  paragraph: null,
  table: null,
  page: null
} as const;

function buildRequirements(
  category: Nf9272PerformanceCategory,
  thresholds: Record<Nf9272CriterionId, number>,
  maxSum: number,
  maxDifference: number,
  label: string,
  categoryDescription: string
): Nf9272CategoryRequirements {
  const criteria = {} as Record<Nf9272CriterionId, Nf9272CriterionRequirement>;
  const labels: Record<Nf9272CriterionId, string> = {
    BLISTERING: 'Cloquage (Blistering)',
    CRACKING: 'Craquelage (Cracking)',
    FLAKING: 'Écaillage (Flaking)',
    ADHESION: 'Adhérence (Adhesion)'
  };
  for (const criterionId of Object.keys(thresholds) as Nf9272CriterionId[]) {
    criteria[criterionId] = {
      criterionId,
      label: labels[criterionId],
      threshold: thresholds[criterionId],
      comparison: 'LESS_OR_EQUAL',
      unit: null,
      provenance: NF9272_SOURCE_PROVENANCE
    };
  }
  return {
    category,
    documented: true,
    criteria,
    maxSum,
    maxDifference,
    categoryDescription: `${label} — ${categoryDescription}`
  };
}

/**
 * Exigences documentées de la catégorie « Stable » (classement 2014) :
 * Blistering ≤ 0,3 | Cracking ≤ 0,7 | Flaking ≤ 0,3 | Adhesion ≤ 1,0 ; somme 12 ≤ 7 ; écart ≤ 2.
 */
export const NF9272_STABLE_REQUIREMENTS: Nf9272CategoryRequirements = buildRequirements(
  'STABLE',
  { BLISTERING: 0.3, CRACKING: 0.7, FLAKING: 0.3, ADHESION: 1.0 },
  7,
  2,
  'Stable',
  'moyennes par critère ≤ 0,3/0,7/0,3/1,0 ; somme des 12 cotations individuelles ≤ 7 ; écart max(12)−min(12) ≤ 2.'
);

/**
 * Exigences documentées de la catégorie « Semi-stable » (classement 2014) :
 * Blistering ≤ 0,7 | Cracking ≤ 1,7 | Flaking ≤ 0,7 | Adhesion ≤ 1,0 ; somme 12 ≤ 12 ; écart ≤ 3.
 */
export const NF9272_SEMI_STABLE_REQUIREMENTS: Nf9272CategoryRequirements = buildRequirements(
  'SEMI_STABLE',
  { BLISTERING: 0.7, CRACKING: 1.7, FLAKING: 0.7, ADHESION: 1.0 },
  12,
  3,
  'Semi-stable',
  'moyennes par critère ≤ 0,7/1,7/0,7/1,0 ; somme des 12 cotations individuelles ≤ 12 ; écart max(12)−min(12) ≤ 3.'
);

/**
 * Exigences documentées de la catégorie « Non-stable » (classement 2014) :
 * Blistering ≤ 1,0 | Cracking ≤ 3,0 | Flaking ≤ 1,3 | Adhesion ≤ 1,0 ; somme 12 ≤ 19 ; écart ≤ 4.
 * NON_STABLE ≠ échec global : signifie que la catégorie « Non-stable » est satisfaite.
 */
export const NF9272_NON_STABLE_REQUIREMENTS: Nf9272CategoryRequirements = buildRequirements(
  'NON_STABLE',
  { BLISTERING: 1.0, CRACKING: 3.0, FLAKING: 1.3, ADHESION: 1.0 },
  19,
  4,
  'Non-stable',
  'moyennes par critère ≤ 1,0/3,0/1,3/1,0 ; somme des 12 cotations individuelles ≤ 19 ; écart max(12)−min(12) ≤ 4.'
);

export const NF9272_CATEGORY_REQUIREMENTS: Record<Nf9272PerformanceCategory, Nf9272CategoryRequirements> = {
  STABLE: NF9272_STABLE_REQUIREMENTS,
  SEMI_STABLE: NF9272_SEMI_STABLE_REQUIREMENTS,
  NON_STABLE: NF9272_NON_STABLE_REQUIREMENTS
};

/** Retourne les exigences de calcul 2014 de la catégorie demandée. */
export function getNf9272CategoryRequirements(
  category: Nf9272PerformanceCategory
): Nf9272CategoryRequirements {
  return NF9272_CATEGORY_REQUIREMENTS[category];
}