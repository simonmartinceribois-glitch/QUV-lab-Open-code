/**
 * Moteur de calcul NF EN 927-2:2022 — couche CALCULATIONS uniquement.
 *
 * Tous les traitements numériques (moyennes, arrondis) vivent ici. Cette couche
 * ne connaît NI les seuils du référentiel (en9272Requirements.ts) NI les
 * évaluations (en9272Evaluator.ts) : elle reçoit des nombres et retourne des
 * nombres.
 *
 * Règles :
 *  - moyenne éprouvette (adhérence) : moyenne arithmétique des 2 mesures
 *    individuelles, arrondie à 1 décimale ;
 *  - moyenne système : moyenne arithmétique des moyennes éprouvettes exposées
 *    (E1/E2/E3), arrondie à 1 décimale ;
 *  - défauts (Blistering/Cracking/Flaking) : moyenne arithmétique des cotations
 *    éprouvette (0..5), arrondie à 1 décimale ;
 *  - jamais de donnée fabriquée : toute entrée non finie est exclue ; si le
 *    minimum requis n'est pas atteint, le résultat est `null`.
 */

export const NF9272_ADHESION_MEASURES_PER_SPECIMEN = 2;
export const NF9272_MIN_EXPOSED_SPECIMENS = 3;
export const NF9272_MIN_ADHESION_MEASURES_PER_SPECIMEN = 2;

/** Arrondi à 1 décimale (valeur MongoDB/JS classique). */
export function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

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
 * Moyenne d'éprouvette pour l'ADHÉRENCE : moyenne arithmétique des mesures
 * individuelles. Retourne `null` si moins de 2 mesures finies (aucune donnée
 * inventée). L'appelant est tenu de fournir les mesures individuelles.
 */
export function specimenAdhesionMean(individualMeasures: number[]): number | null {
  const finite = finiteValues(individualMeasures);
  if (finite.length < NF9272_MIN_ADHESION_MEASURES_PER_SPECIMEN) return null;
  return roundTo1Decimal(arithmeticMean(finite) as number);
}

/**
 * Moyenne SYSTEME (éprouvettes exposées E1/E2/E3) pour l'ADHÉRENCE : moyenne des
 * moyennes d'éprouvettes valides. Retourne `null` si aucune moyenne valide.
 */
export function systemAdhesionMean(specimenMeans: (number | null)[]): number | null {
  const valid = specimenMeans.filter((m): m is number => m !== null && Number.isFinite(m));
  if (valid.length === 0) return null;
  return roundTo1Decimal(arithmeticMean(valid) as number);
}

/**
 * Moyenne arithmétique des éprouvettes exposées pour un DÉFAUT
 * (Blistering/Cracking/Flaking) au jalon C12, arrondie à 1 décimale.
 * Retourne `null` si aucune cotation valide (aucune donnée fabriquée) ;
 * l'évaluateur gère le minimum de 3 éprouvettes.
 */
export function defectMean(specimenRatings: number[]): number | null {
  const mean = arithmeticMean(specimenRatings);
  return mean === null ? null : roundTo1Decimal(mean);
}