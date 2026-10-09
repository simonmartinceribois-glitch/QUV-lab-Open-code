/**
 * QUV-Lab — Échappement des exports CSV (R-CSV, audit du 09/10/2026).
 *
 * Avant ce correctif, les valeurs étaient interpolées telles quelles :
 * un `"`, un `;` ou un retour à la ligne saisi par l'opérateur décalait les
 * colonnes, et un texte commençant par `=`, `+`, `-` ou `@` était exécuté
 * comme formule à l'ouverture dans un tableur.
 *
 * Les CSV produits sont relus par un parseur RFC 4180 (séparateur `;`) :
 * chaque ligne de données doit garder son nombre de colonnes et chaque
 * texte saisi doit revenir à l'identique (hors apostrophe de neutralisation).
 */
import { TrialStoreService } from '../../services/trialStoreService';
import { exportRawDataToCsv, exportReportToCsv } from '../../services/reportGenerator';
import { csvUserText, csvValue } from '../../services/csvUtils';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';

export interface CsvEscapingTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

/** Parseur CSV RFC 4180 minimal (guillemets doublés, champs multilignes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const HOSTILE_BATCH_REF = 'LOT;"A"\nB';
const HOSTILE_PANEL_LABEL = '=HYPERLINK("http://exemple.invalid","x")';
const HOSTILE_TRIAL_REF = 'REF;2026';

function buildHostileTrial(): Trial {
  const store = TrialStoreService.createIsolatedStore();
  const trial = store.resetToDemo();
  trial.metadata.reference = HOSTILE_TRIAL_REF;
  trial.batches[0].reference = HOSTILE_BATCH_REF;
  trial.batches[0].panels[0].label = HOSTILE_PANEL_LABEL;
  return trial;
}

export function runCsvExportEscapingTests(): {
  results: CsvEscapingTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: CsvEscapingTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-CSV-01 : valeur sans caractère spécial → format historique inchangé.
  {
    const ok =
      csvValue('abc') === '"abc"' &&
      csvUserText('Lot A') === '"Lot A"' &&
      csvUserText('Lot A', 'auto') === 'Lot A' &&
      csvValue(undefined) === '""';
    record('R-CSV-01', 'Valeur ordinaire → sortie identique à l’ancien format', ok, '"abc" / "Lot A" / Lot A / ""',
      `${csvValue('abc')} / ${csvUserText('Lot A')} / ${csvUserText('Lot A', 'auto')} / ${csvValue(undefined)}`);
  }

  // R-CSV-02 : guillemets doublés, mode auto entoure dès qu'un séparateur apparaît.
  {
    const ok = csvValue('a"b') === '"a""b"' && csvUserText('a;b', 'auto') === '"a;b"' && csvUserText('a\nb', 'auto') === '"a\nb"';
    record('R-CSV-02', 'Guillemet, point-virgule, retour ligne → champ entouré et guillemets doublés', ok, '"a""b" / "a;b" / "a⏎b"',
      `${csvValue('a"b')} / ${csvUserText('a;b', 'auto')} / ${JSON.stringify(csvUserText('a\nb', 'auto'))}`);
  }

  // R-CSV-03 : neutralisation des formules sur le texte saisi uniquement.
  {
    const triggers = ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx'];
    const neutralized = triggers.every((t) => csvUserText(t).startsWith(`"'`));
    const numbersKept = csvUserText('-3') === '"-3"' && csvUserText('+1,5') === '"+1,5"';
    const computedKept = csvValue('-3.2 GU') === '"-3.2 GU"';
    record('R-CSV-03', 'Texte saisi commençant par = + - @ tab → apostrophe ; nombres signés et valeurs calculées intacts',
      neutralized && numbersKept && computedKept, 'neutralisé / nombres intacts / « -3.2 GU » intact',
      `neutralisé=${neutralized}, nombres=${numbersKept}, calculé=${computedKept}`);
  }

  // R-CSV-04 : export RAW avec saisies hostiles → structure préservée.
  {
    const trial = buildHostileTrial();
    const rows = parseCsv(exportRawDataToCsv(trial));
    const headerIdx = rows.findIndex((r) => r[0] === 'StageId');
    const width = rows[headerIdx]?.length ?? 0;
    const dataRows = rows.slice(headerIdx + 1).filter((r) => r.length > 1);
    const hostileRows = dataRows.filter((r) => r[3] === trial.batches[0].id);
    const allSameWidth = dataRows.every((r) => r.length === width);
    const batchRefRoundTrip = hostileRows.length > 0 && hostileRows.every((r) => r[4] === HOSTILE_BATCH_REF);
    record('R-CSV-04', 'CSV RAW : « ; », « " » et retour ligne dans une référence de lot → colonnes intactes, valeur relue à l’identique',
      width === 16 && allSameWidth && batchRefRoundTrip, '16 colonnes sur toutes les lignes, référence relue identique',
      `largeur=${width}, homogène=${allSameWidth}, lignesLot=${hostileRows.length}, relue=${batchRefRoundTrip}`);
  }

  // R-CSV-05 : export RAW → libellé formule neutralisé, référence d'essai entourée.
  {
    const trial = buildHostileTrial();
    const csv = exportRawDataToCsv(trial);
    const rows = parseCsv(csv);
    const panelId = trial.batches[0].panels[0].id;
    const panelRows = rows.filter((r) => r[5] === panelId);
    const neutralized = panelRows.length > 0 && panelRows.every((r) => r[6] === `'${HOSTILE_PANEL_LABEL}`);
    const trialRefLine = rows[1];
    const refOk = trialRefLine[0] === 'Essai' && trialRefLine[1] === HOSTILE_TRIAL_REF && trialRefLine.length === 2;
    record('R-CSV-05', 'CSV RAW : libellé « =HYPERLINK(…) » neutralisé, référence d’essai « REF;2026 » sur une seule cellule',
      neutralized && refOk, "libellé préfixé d'une apostrophe, Essai;REF;2026 relu en 2 cellules",
      `lignesPanneau=${panelRows.length}, neutralisé=${neutralized}, réf=${JSON.stringify(trialRefLine)}`);
  }

  // R-CSV-06 : export rapport → matrice des lots et en-tête préservés.
  {
    const trial = buildHostileTrial();
    const store = TrialStoreService.createIsolatedStore();
    store.saveTrial(trial);
    const ruleSet = getDefaultScientificRuleSet();
    const report = store.generateScientificReportForTrial(trial.id, 'OP', ruleSet);
    const rows = parseCsv(exportReportToCsv(trial, report, ruleSet));
    const refRow = rows.find((r) => r[0] === 'Référence Essai');
    const matrixHeader = rows.findIndex((r) => r[0] === 'Lot Ref');
    const firstBatchRow = rows[matrixHeader + 1];
    const ok =
      refRow?.length === 2 &&
      refRow[1] === HOSTILE_TRIAL_REF &&
      firstBatchRow?.length === rows[matrixHeader].length &&
      firstBatchRow[0] === HOSTILE_BATCH_REF;
    record('R-CSV-06', 'CSV rapport : référence d’essai et référence de lot hostiles relues à l’identique, colonnes intactes',
      ok, 'Référence Essai en 2 cellules, ligne de lot alignée sur son en-tête',
      `réf=${JSON.stringify(refRow)}, lot=${JSON.stringify(firstBatchRow?.slice(0, 2))}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
