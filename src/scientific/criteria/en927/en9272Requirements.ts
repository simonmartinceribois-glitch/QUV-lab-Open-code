/**
 * Exigences scientifiques NF EN 927-2:2022 — couche métadonnées uniquement.
 *
 * Aucune opération numérique : ce module ne fait que porter la description du
 * référentiel et des seuils documentés. Les comparaisons appartiennent à
 * l'évaluateur (en9272Evaluator.ts), les moyennes au moteur de calcul
 * (en9272Calculations.ts).
 *
 * Jalon d'évaluation : uniquement C12 = cycle 12 à 2016 h d'exposition (12 × 168 h).
 * T0, C1..C11 et toute interpolation/extrapolation sont hors périmètre.
 */

import type { CriterionSource } from '../common/criterionTypes';
import { TRACEABILITY_STATUS_TO_BE_DEFINED } from '../common/criterionTypes';

export const NF9272_SOURCE: CriterionSource = 'NF_EN_927_2';
export const NF9272_REFERENCE = 'NF EN 927-2';
export const NF9272_EDITION = '2022';
export const NF9272_DOCUMENT = 'NF EN 927-2:2022';

/**
 * Statut de traçabilité des seuils NF EN 927-2:2022 : les emplacements précis
 * (section/paragraphe/tableau/page) au sein du document édition 2022 et la
 * page d'édition exacte ne sont PAS vérifiés dans la source scientifique du
 * projet. Aucun emplacement n'est inventé ; la provenance porte explicitement
 * « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT ».
 */
export const NF9272_TRACEABILITY_STATUS = TRACEABILITY_STATUS_TO_BE_DEFINED;

/** Jalon d'évaluation exigé : cycle 12, 2016 h. */
export const NF9272_REQUIRED_CYCLE_INDEX = 12;
export const NF9272_REQUIRED_EXPOSURE_HOURS = 2016;

/**
 * Notice obligatoire portée par l'évaluation : mode COMPLEMENTARY.
 * L'évaluation NF EN 927-2 ne constitue jamais, à elle seule, une déclaration
 * de conformité au référentiel.
 */
export const NF9272_COMPLEMENTARY_NOTICE =
  'Évaluation complémentaire de performances après vieillissement artificiel selon NF EN 927-6 : les résultats sont comparés aux critères de performance moyens documentés du référentiel NF EN 927-2:2022. Cette évaluation ne constitue pas, à elle seule, une déclaration de conformité au référentiel.';

/**
 * Contrôle de valeur totale (anciennes règles 7/12/19 et 2/3/4) : non applicable.
 * Les anciennes règles de comparaison des totaux sur les cotations de défauts et
 * les règles d'écart maximum entre éprouvettes ne sont PAS réintroduites dans
 * cette architecture ; le contrat de données l'explicite via `totalValueCheck`.
 */
export const NF9272_TOTAL_VALUE_CHECK = 'NOT_APPLICABLE' as const;

export type Nf9272PerformanceCategory = 'STABLE' | 'SEMI_STABLE' | 'NON_STABLE';

export type Nf9272CriterionId = 'BLISTERING' | 'CRACKING' | 'FLAKING' | 'ADHESION';

type Nf9272Comparison = 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL';

export interface Nf9272CriterionRequirement {
  criterionId: Nf9272CriterionId;
  label: string;
  /**
   * Seuil documenté pour la catégorie de performance.
   * Catégorie "Stable" (documentée) : Blistering 0,3 | Cracking 0,7 | Flaking 0,3 | Adhesion 1,0.
   */
  threshold: number;
  /**
   * Sens de la comparaison :
   *  - LESS_OR_EQUAL       (défauts : Blistering/Cracking/Flaking)  : favorable si moyenne <= seuil ;
   *  - GREATER_OR_EQUAL    (Adhesion)                               : favorable si moyenne >= seuil.
   */
  comparison: Nf9272Comparison;
  /** Unité de la valeur. `null` si non documentée dans le corpus. */
  unit: string | null;
  /** Provenance du seuil (référentiel NF EN 927-2:2022, champ de source non détaillé). */
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
  /**
   * `true` si les exigences de cette catégorie sont documentées dans le référentiel.
   * Les catégories "Semi-stable" et "Non-stable" ne sont PAS documentées dans la
   * source scientifique du projet : les critères y sont NOT_APPLICABLE, jamais
   * évalués avec des seuils inventés.
   */
  documented: boolean;
  criteria: Partial<Record<Nf9272CriterionId, Nf9272CriterionRequirement>>;
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

/** Exigences documentées de la catégorie "Stable" (NF EN 927-2:2022). */
export const NF9272_STABLE_REQUIREMENTS: Nf9272CategoryRequirements = {
  category: 'STABLE',
  documented: true,
  categoryDescription:
    "Catégorie de performance « Stable » : seuls les seuils documentés du référentiel NF EN 927-2:2022 sont appliqués (Blistering 0,3 | Cracking 0,7 | Flaking 0,3 | Adhesion 1,0).",
  criteria: {
    BLISTERING: {
      criterionId: 'BLISTERING',
      label: 'Cloquage (Blistering)',
      threshold: 0.3,
      comparison: 'LESS_OR_EQUAL',
      unit: null,
      provenance: NF9272_SOURCE_PROVENANCE
    },
    CRACKING: {
      criterionId: 'CRACKING',
      label: 'Craquelage (Cracking)',
      threshold: 0.7,
      comparison: 'LESS_OR_EQUAL',
      unit: null,
      provenance: NF9272_SOURCE_PROVENANCE
    },
    FLAKING: {
      criterionId: 'FLAKING',
      label: 'Écaillage (Flaking)',
      threshold: 0.3,
      comparison: 'LESS_OR_EQUAL',
      unit: null,
      provenance: NF9272_SOURCE_PROVENANCE
    },
    ADHESION: {
      criterionId: 'ADHESION',
      label: 'Adhérence (Adhesion)',
      threshold: 1.0,
      comparison: 'GREATER_OR_EQUAL',
      unit: null,
      provenance: NF9272_SOURCE_PROVENANCE
    }
  }
};

/** Exigences "non documentées" : Semi-stable et Non-stable (critères NOT_APPLICABLE). */
const NON_DOCUMENTED_CATEGORY: Omit<Nf9272CategoryRequirements, 'category'> = {
  documented: false,
  criteria: {},
  categoryDescription:
    'Catégorie de performance non documentée dans la source scientifique du projet : aucun seuil NF EN 927-2:2022 n’est appliqué (critère 2022 non disponible).'
};

/**
 * Retourne les exigences de la catégorie de performance demandée.
 * Les catégories "Semi-stable" et "Non-stable" renvoient des exigences non
 * documentées : le référentiel projet ne fournit aucun seuil pour elles.
 */
export function getNf9272CategoryRequirements(
  category: Nf9272PerformanceCategory
): Nf9272CategoryRequirements {
  switch (category) {
    case 'STABLE':
      return NF9272_STABLE_REQUIREMENTS;
    case 'SEMI_STABLE':
      return { ...NON_DOCUMENTED_CATEGORY, category: 'SEMI_STABLE' };
    case 'NON_STABLE':
      return { ...NON_DOCUMENTED_CATEGORY, category: 'NON_STABLE' };
  }
}