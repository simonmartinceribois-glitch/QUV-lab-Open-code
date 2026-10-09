/**
 * QUV-Lab — Échappement des cellules CSV (exports RAW et rapport).
 *
 * Avant ce module, les exports interpolaient les valeurs telles quelles
 * (`"${valeur}"`) : un guillemet, un point-virgule ou un retour à la ligne
 * saisi par l'opérateur décalait les colonnes, et un texte commençant par
 * `=`, `+`, `-` ou `@` était interprété comme une formule à l'ouverture dans
 * un tableur (injection de formule CSV).
 *
 * Pour une valeur sans caractère spécial, la sortie est strictement identique
 * à l'ancien format (aucune colonne ajoutée, déplacée ou renommée).
 */

export type CsvQuoteMode = 'always' | 'auto';

const NEEDS_QUOTING = /[";\r\n]/;
// Caractères déclenchant une formule dans Excel / LibreOffice / Google Sheets.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
// Un nombre signé (« -3 », « +1,5 ») reste une donnée, jamais neutralisé.
const SIGNED_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;

function quoteCell(text: string, mode: CsvQuoteMode): string {
  if (mode === 'auto' && !NEEDS_QUOTING.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Valeur produite par l'application (identifiant, date, statut, valeur
 * calculée formatée) : seuls les guillemets sont échappés. Aucune
 * neutralisation, pour ne jamais altérer une valeur scientifique (« -3.2 GU »).
 */
export function csvValue(value: unknown, mode: CsvQuoteMode = 'always'): string {
  return quoteCell(toText(value), mode);
}

/**
 * Texte libre saisi par un opérateur (référence, libellé, commentaire,
 * observation, opérateur) : guillemets échappés ET neutralisation des
 * formules par une apostrophe en tête (recommandation OWASP).
 */
export function csvUserText(value: unknown, mode: CsvQuoteMode = 'always'): string {
  const text = toText(value);
  const safe = FORMULA_TRIGGER.test(text) && !SIGNED_NUMBER.test(text) ? `'${text}` : text;
  return quoteCell(safe, mode);
}
