/**
 * Exigences INFIPERF / FCBA — couche métadonnées uniquement.
 *
 * Le seuil de rétention de brillance est la SOURCE DE VÉRITÉ du projet : il est
 * lu depuis le ScientificRuleSet (statisticalRules.retentionThresholdPercent) —
 * jamais en dur ici. Ce critère est COMPLÉMENTAIRE : une rétention défaillante
 * est DEFAVORABLE sur le critère INFIPERF, JAMAIS une non-conformité NF EN 927-6.
 *
 * Module 100 % indépendant de l'évaluateur NF EN 927-2 (aucune import croisée).
 */

import type { ScientificRuleSet } from '../../../types/scientific';
import type { CriterionSource } from '../common/criterionTypes';

export const INFIPERF_SOURCE: CriterionSource = 'INFIPERF';
export const INFIPERF_REFERENCE = 'INFIPERF / FCBA';
/** Édition non documentée dans la source scientifique du projet. */
export const INFIPERF_EDITION: string | null = null;
export const INFIPERF_DOCUMENT: string | null = 'Critère complémentaire d’étude INFIPERF / FCBA';

/** Notice obligatoire du critère INFIPERF (mode COMPLEMENTARY). */
export const INFIPERF_COMPLEMENTARY_NOTICE =
  'Critère complémentaire d’étude (référentiel INFIPERF / FCBA) : la rétention de brillance observée est comparée au seuil d’étude configuré dans le ScientificRuleSet. Ce critère n’est en aucun cas une exigence de conformité NF EN 927-6 et ne produit aucun verdict de conformité.';

/**
 * Retourne le seuil de rétention de brillance du RuleSet, ou `null` si absent/invalide.
 * Source de vérité unique : `statisticalRules.retentionThresholdPercent`.
 */
export function getInfiperfGlossRetentionThreshold(ruleSet: ScientificRuleSet): number | null {
  const value = ruleSet?.statisticalRules?.retentionThresholdPercent;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}