/**
 * Moteur de calcul INFIPERF / FCBA — couche CALCULATIONS uniquement.
 *
 * Tous les traitements numériques des indicateurs INFIPERF vivent ici :
 *  - rétention de brillance (moyenne) ;
 *  - dureté Persoz (moyenne) ;
 *  - évolutions colorimétriques (moyennes ΔL, Δa, Δb, ΔE) ;
 *  - aspect général (moyenne de cotation).
 *
 * Cette couche ne connaît NI le seuil (infiperfRequirements.ts) NI l'évaluation
 * (infiperfEvaluator.ts) : elle reçoit des nombres et retourne des nombres.
 * Aucune donnée n'est fabriquée : toute entrée non finie est exclue ; si aucune
 * valeur finie n'est fournie, le résultat est `null`.
 */

/** Moyenne arithmétique des valeurs finies, arrondie à 1 décimale, ou `null`. */
export function arithmeticMeanRound1(values: number[]): number | null {
  const finite = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return null;
  const mean = finite.reduce((sum, v) => sum + v, 0) / finite.length;
  return Math.round(mean * 10) / 10;
}

/**
 * Moyenne arithmétique des rétentions finies, arrondie à 1 décimale, ou `null`.
 * Alias rétro-compatible vers `arithmeticMeanRound1`.
 */
export function meanRetentionRate(values: number[]): number | null {
  return arithmeticMeanRound1(values);
}

/** Moyenne arithmétique des temps d'amortissement Persoz finis, arrondie à 1 décimale, ou `null`. */
export function meanDampingTime(values: number[]): number | null {
  return arithmeticMeanRound1(values);
}

/** Moyenne arithmétique des cotations d'aspect général finies, arrondie à 1 décimale, ou `null`. */
export function meanAspectRating(values: number[]): number | null {
  return arithmeticMeanRound1(values);
}

/**
 * Moyenne arithmétique des valeurs finies d'une composante colorimétrique
 * (ΔL*, Δa*, Δb*, ΔE*), arrondie à 3 décimales (cohérent avec colorEngine),
 * ou `null` si aucune valeur finie.
 */
export function meanColorComponent(values: number[]): number | null {
  const finite = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return null;
  const mean = finite.reduce((sum, v) => sum + v, 0) / finite.length;
  return Math.round(mean * 1000) / 1000;
}