/**
 * Exigences INFIPERF / FCBA — couche métadonnées uniquement.
 *
 * Source de vérité du projet :
 *  - Brillance  : le seuil de rétention de brillance est lu depuis le
 *    ScientificRuleSet (statisticalRules.retentionThresholdPercent) — jamais en
 *    dur ici.
 *  - Persoz     : indicateurs de vigilance documentés INFIPERF — dureté initiale
 *    > 70 s (prédisposition au risque de fissuration) ; dureté ≥ 100 s pendant
 *    le vieillissement (risque accru de fissuration). Ce sont des INDICATEURS
 *    de vigilance, jamais des exigences de conformité NF EN 927-2.
 *  - Couleur    : aucun seuil normatif. Analyse descriptive des évolutions
 *    ΔL*, Δa*, Δb*, ΔE* sur les cycles réellement mesurés (aucune interpolation).
 *  - Aspect général : échelle 0..5, seuil d'alerte ≥ 2.5 (perte de
 *    performance/aspect) — ALERTE INFIPERF, jamais un critère de conformité NF.
 *
 * Tous ces critères sont COMPLÉMENTAIRES : un résultat défavorable/de vigilance
 * est porté sur le critère INFIPERF, JAMAIS une non-conformité NF EN 927-6.
 *
 * Module 100 % indépendant de l'évaluateur NF EN 927-2 (aucune import croisée).
 */

import type { ScientificRuleSet } from '../../../types/scientific';
import type { CriterionSource } from '../common/criterionTypes';
import { TRACEABILITY_STATUS_TO_BE_DEFINED } from '../common/criterionTypes';

export const INFIPERF_SOURCE: CriterionSource = 'INFIPERF';
export const INFIPERF_REFERENCE = 'INFIPERF / FCBA';
/** Édition non documentée dans la source scientifique du projet. */
export const INFIPERF_EDITION: string | null = null;

/**
 * Document source INFIPERF.
 *
 * La source scientifique du projet (S0 §4) nomme uniquement une « référence
 * complémentaire INFIPERF FCBA 2024 » : il ne s'agit pas d'un titre officiel
 * de document publié vérifié dans le corpus. Par application du principe de
 * non-invention, le titre du document source vaut `null` (jamais une
 * dénomination présentée comme titre officiel) ; le statut de traçabilité
 * porte explicitement « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT ».
 */
export const INFIPERF_DOCUMENT: string | null = null;
export const INFIPERF_TRACEABILITY_STATUS = TRACEABILITY_STATUS_TO_BE_DEFINED;

/** Notice obligatoire du critère INFIPERF (mode COMPLEMENTARY). */
export const INFIPERF_COMPLEMENTARY_NOTICE =
  'Critère complémentaire d’étude (référence complémentaire INFIPERF / FCBA — désignée « INFIPERF FCBA 2024 » dans le S0 §4 ; titre/édition du document source À DÉFINIR / À VALIDER SCIENTIFIQUEMENT) : les indicateurs observés (rétention de brillance, dureté Persoz, évolutions colorimétriques, aspect général) sont comparés aux seuils d’étude INFIPERF. Ce critère n’est en aucun cas une exigence de conformité NF EN 927-6 et ne produit aucun verdict de conformité, aucun score global.';

/**
 * Seuil de rétention de brillance : SOURCE DE VÉRITÉ = ScientificRuleSet.
 * Retourne le seuil configuré, ou `null` si absent/invalide.
 */
export function getInfiperfGlossRetentionThreshold(ruleSet: ScientificRuleSet): number | null {
  const value = ruleSet?.statisticalRules?.retentionThresholdPercent;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Indicateur de vigilance — dureté initiale Persoz (> 70 s) : prédisposition au risque de fissuration. */
export const INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS = 70;
/** Indicateur de vigilance — dureté pendant le vieillissement (≥ 100 s) : risque accru de fissuration. */
export const INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS = 100;
/** Niveau d'alerte INFIPERF sur l'aspect général (échelle 0..5, ≥ 2.5 = alerte). */
export const INFIPERF_ASPECT_ALERT_RATING = 2.5;