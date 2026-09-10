/**
 * QUV-Lab — Couche CRITÈRE (S3) : évaluation du critère complémentaire de
 * rétention de brillance — origine INFIPERF / FCBA.
 *
 * Couche pure, déterministe, NON persistée et sans mutation : elle lit des
 * grandeurs COMPUTED et le référentiel (ScientificRuleSet), ne produit aucun
 * verdict de conformité normatif et n'est jamais un véhicule d'alerte qualité.
 * Un résultat DEFAVORABLE = donnée valide + critère complémentaire défavorable,
 * distinct de toute exigence NF EN 927-6.
 *
 * Séparation des couches RAW / COMPUTED / CRITÈRE / ANALYSE (règles QUV-Lab S0).
 */

import { ScientificRuleSet } from '../../types/scientific';

export type GlossRetentionVerdict = 'FAVORABLE' | 'DEFAVORABLE' | 'NON_EVALUE';

export interface GlossRetentionCriterionEvaluation {
  verdict: GlossRetentionVerdict;
  retentionRatePercent: number | null;
  thresholdPercent: number;
  origin: 'INFIPERF / FCBA';
  isComplementaryCriterion: true;
  isNormativeRequirement: false;
  label: string;
  message: string;
}

/**
 * Seuil de rétention de brillance — source de vérité unique : le référentiel
 * (`statisticalRules.retentionThresholdPercent`). Repli défensif 50 uniquement
 * si le référentiel ne le fournit pas.
 */
export function getGlossRetentionThreshold(ruleSet: ScientificRuleSet): number {
  const threshold = ruleSet.statisticalRules?.retentionThresholdPercent;
  return typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : 50;
}

/**
 * Évalue le critère d'étude INFIPERF / FCBA (rétention de brillant < seuil).
 * Ne dégrade JAMAIS la qualité de la donnée : l'évaluation est strictement
 * appliquée à la couche CRITÈRE (S3), jamais à COMPUTED ni à qualityEngine.
 */
export function evaluateGlossRetentionCriterion(
  retentionRatePercent: number | null | undefined,
  ruleSet: ScientificRuleSet
): GlossRetentionCriterionEvaluation {
  const thresholdPercent = getGlossRetentionThreshold(ruleSet);
  const value: number | null =
    retentionRatePercent !== null &&
    retentionRatePercent !== undefined &&
    Number.isFinite(retentionRatePercent)
      ? (retentionRatePercent as number)
      : null;

  const verdict: GlossRetentionVerdict =
    value === null ? 'NON_EVALUE' : value < thresholdPercent ? 'DEFAVORABLE' : 'FAVORABLE';

  return {
    verdict,
    retentionRatePercent: value,
    thresholdPercent,
    origin: 'INFIPERF / FCBA',
    isComplementaryCriterion: true,
    isNormativeRequirement: false,
    label: 'Critère complémentaire de rétention de brillance (INFIPERF / FCBA)',
    message:
      verdict === 'NON_EVALUE'
        ? 'Rétention de brillance non évaluable (donnée absente ou invalide).'
        : verdict === 'DEFAVORABLE'
          ? `Rétention de brillance ${value} % inférieure au seuil indicatif complémentaire de ${thresholdPercent} % (INFIPERF / FCBA). Critère défavorable — distinct de toute exigence de conformité NF EN 927-6.`
          : `Rétention de brillance ${value} % supérieure ou égale au seuil indicatif complémentaire de ${thresholdPercent} % (INFIPERF / FCBA).`
  };
}