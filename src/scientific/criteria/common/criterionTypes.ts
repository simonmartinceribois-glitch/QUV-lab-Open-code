/**
 * Types communs de la couche CRITÈRE (évaluations scientifiques indépendantes).
 *
 * Architecture en trois couches (séparation stricte) :
 *   - Preparation  : extraction/mapping des données brutes d'un essai vers des
 *                    données préparées (aucun calcul métier).
 *   - Calculations : tous les traitements numériques (moyennes, arrondis).
 *   - Evaluator    : comparaison des valeurs calculées aux exigences / seuils
 *                    documentés, production du statut final.
 *
 * Les évaluateurs produisent des résultats INDÉPENDANTS (aucun score global,
 * aucun verdict combiné entre référentiels).
 */

/** Référentiel scientifique source d'un critère. */
export type CriterionSource = 'NF_EN_927_2' | 'INFIPERF';

/**
 * Statut d'évaluation d'un critère.
 *  - FAVORABLE         : la valeur calculée satisfait l'exigence documentée.
 *  - DEFAVORABLE       : la valeur calculée ne satisfait pas l'exigence documentée.
 *  - NOT_APPLICABLE    : critère non défini / non documenté pour la catégorie
 *                        considérée (un "critère 2022 non disponible" n'est
 *                        jamais confondu avec des données insuffisantes).
 *  - INSUFFICIENT_DATA : critère applicable mais données insuffisantes
 *                        (jalon C12 absent, éprouvette manquante, mesure
 *                        d'adhérence absente ou inexploitable).
 */
export type CriterionEvaluationStatus =
  | 'FAVORABLE'
  | 'DEFAVORABLE'
  | 'NOT_APPLICABLE'
  | 'INSUFFICIENT_DATA';

/** Mode d'évaluation du critère : complémentaire, jamais déclaration de conformité. */
export type CriterionEvaluationMode = 'COMPLEMENTARY';

/**
 * Provenance documentaire d'un critère. Les champs inconnus valent `null`
 * (aucune valeur inventée).
 */
export interface CriterionProvenance {
  /** Référence courte du référentiel, ex. 'NF EN 927-2', 'INFIPERF / FCBA'. */
  reference: string;
  /** Édition du référentiel, ex. '2022'. `null` si non documentée. */
  edition: string | null;
  /** Document source, ex. 'NF EN 927-2:2022'. */
  document: string | null;
  /** Section / article du document. */
  section: string | null;
  /** Paragraphe du document. */
  paragraph: string | null;
  /** Tableau du document. */
  table: string | null;
  /** Page du document. */
  page: string | null;
  evaluationMode: CriterionEvaluationMode;
  /** Jalon d'évaluation visé, ex. 'C12', '2016 h'. */
  stage: string | null;
  cycleIndex: number | null;
  exposureHours: number | null;
}

/**
 * Résultat d'évaluation d'un critère. Le champ `totalValueCheck` ne vit pas ici :
 * il est porté au niveau du référentiel (ex. résultat NF EN 927-2) et vaut
 * toujours 'NOT_APPLICABLE' dans cette architecture (anciennes règles de
 * comparaison de totaux 7/12/19 et d'écarts 2/3/4 jamais réintroduites).
 */
export interface CriterionEvaluationResult<TValue = unknown> {
  criterionId: string;
  label: string;
  status: CriterionEvaluationStatus;
  /** Valeur mesurée/calculée ou `null` si indisponible (jamais inventée). */
  value: TValue | null;
  /** Seuil documenté du critère ou `null` si non documenté. */
  threshold: number | null;
  provenance: CriterionProvenance;
  /** Message explicatif lisible (règle appliquée, raison du statut). */
  message: string;
}

/** Contrôle de valeur totale : systématiquement non applicable dans cette PR. */
export const TOTAL_VALUE_CHECK_NOT_APPLICABLE = 'NOT_APPLICABLE' as const;
export type TotalValueCheckStatus = typeof TOTAL_VALUE_CHECK_NOT_APPLICABLE;