/**
 * Moteur de calcul INFIPERF / FCBA — couche CALCULATIONS uniquement.
 *
 * Tous les traitements numériques du critère de rétention de brillance vivent ici.
 * Cette couche ne connaît NI le seuil (infiperfRequirements.ts lit le RuleSet)
 * NI l'évaluation (infiperfEvaluator.ts) : elle reçoit des nombres et retourne
 * des nombres. Aucune donnée n'est fabriquée.
 */

/** Moyenne arithmétique des rétentions finies, arrondie à 1 décimale, ou `null`. */
export function meanRetentionRate(values: number[]): number | null {
  const finite = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return null;
  const mean = finite.reduce((sum, v) => sum + v, 0) / finite.length;
  return Math.round(mean * 10) / 10;
}