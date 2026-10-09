/**
 * Moteur de calcul NF EN 927-2:2014 (référentiel historique/transitoire —
 * HISTORICAL_TRANSITIONAL) — couche CALCULATIONS uniquement.
 *
 * Cette couche fournit uniquement les primitives numériques utilisées par
 * l'évaluateur 2014 : moyenne arithmétique, somme et différence maximale.
 * Elle ne connaît NI les seuils du référentiel (en9272Requirements.ts) NI les
 * évaluations (en9272Evaluator.ts) : elle reçoit des nombres et retourne des
 * nombres.
 *
 * Règles :
 *  - les moyennes comparées aux seuils sont arithmétiques et NON arrondies ;
 *  - la SOMME des 12 cotations individuelles (4 critères × 3 éprouvettes
 *    exposées) est calculée depuis les valeurs BRUTES, jamais depuis des
 *    moyennes arrondies ;
 *  - la DIFFÉRENCE maximale max(12) − min(12) porte sur les valeurs
 *    individuelles ;
 *  - jamais de donnée fabriquée : toute entrée non finie est exclue ; si
 *    aucune donnée finie n'est disponible, le résultat est `null`.
 */

/** Filtre les valeurs finies. */
function finiteValues(values: number[]): number[] {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

/** Moyenne arithmétique des valeurs finies, ou `null` si aucune. */
export function arithmeticMean(values: number[]): number | null {
  const finite = finiteValues(values);
  if (finite.length === 0) return null;
  return finite.reduce((sum, v) => sum + v, 0) / finite.length;
}

/**
 * SOMME des cotations individuelles utilisées par le classement séquentiel
 * 2014. Somme des valeurs BRUTES finies, jamais depuis des moyennes arrondies.
 * Retourne `null` si aucune valeur finie.
 */
export function sumOfValues(values: number[]): number | null {
  const finite = finiteValues(values);
  if (finite.length === 0) return null;
  return finite.reduce((sum, v) => sum + v, 0);
}

/**
 * DIFFÉRENCE maximale des cotations individuelles : max − min.
 * Porte sur les valeurs BRUTES finies. Retourne `null` si moins de 2 valeurs
 * finies (une différence exige au moins deux points).
 */
export function maxDifferenceOfValues(values: number[]): number | null {
  const finite = finiteValues(values);
  if (finite.length < 2) return null;
  return Math.max(...finite) - Math.min(...finite);
}
