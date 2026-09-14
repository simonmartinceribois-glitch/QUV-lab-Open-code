/**
 * QUV-Lab — Tests de cohérence des dates civiles locales (R9-DATE).
 *
 * Contexte (audit 11-12/09/2026, anomalie R3) : `CreateTrialWizardModal.tsx`
 * avait été corrigé le 12/09 pour utiliser une date civile LOCALE plutôt
 * qu'UTC, mais `Tab02LotsPanels.tsx` (ajout d'un lot dans un essai existant)
 * était resté sur l'ancien calcul UTC (`toISOString().slice(0, 10)`), créant
 * un décalage possible d'un jour entre les deux écrans du même essai en
 * horaire proche de minuit.
 *
 * Ce fichier vérifie, par lecture réelle des fichiers sources (pas par
 * assertion codée en dur) :
 * 1. que `getTodayLocalISODate()` est bien implémentée avec `toLocaleDateString`
 *    (sensible au fuseau local) et non `toISOString` (toujours UTC) ;
 * 2. qu'aucun des deux écrans historiquement divergents ne contient plus le
 *    motif UTC `toISOString().slice(0, 10)` pour une date "aujourd'hui" ;
 * 3. que les deux écrans importent bien la même fonction partagée
 *    (source canonique unique, contre une re-duplication future).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getTodayLocalISODate } from '../../utils/dateUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DateUtilsTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runDateUtilsConsistencyTests(): {
  results: DateUtilsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: DateUtilsTestResult[] = [];

  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --------------------------------------------------------------------------
  // R3-DATE-01 : format YYYY-MM-DD valide
  // --------------------------------------------------------------------------
  const today = getTodayLocalISODate();
  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(today);
  record(
    'R3-DATE-01',
    'getTodayLocalISODate() renvoie un format YYYY-MM-DD',
    isValidFormat,
    'Format YYYY-MM-DD',
    today
  );

  // --------------------------------------------------------------------------
  // R3-DATE-02 : implémentation basée sur toLocaleDateString (fuseau local),
  // jamais toISOString (toujours UTC). Vérification par lecture réelle du
  // fichier source : dateUtils.ts DOIT contenir toLocaleDateString et NE DOIT
  // PAS contenir toISOString.
  // --------------------------------------------------------------------------
  const repoRoot = path.resolve(__dirname, '../../..');
  const dateUtilsPath = path.join(repoRoot, 'src/utils/dateUtils.ts');
  const dateUtilsSource = fs.readFileSync(dateUtilsPath, 'utf-8');
  // On isole la ligne de retour effective de la fonction (hors commentaires
  // JSDoc, qui mentionnent volontairement `toISOString()` à titre d'exemple du
  // comportement à NE PAS reproduire).
  const returnLineMatch = dateUtilsSource.match(/^\s*return\s+.*;\s*$/m);
  const returnLine = returnLineMatch ? returnLineMatch[0] : '';
  const usesLocaleDateString = returnLine.includes("toLocaleDateString('en-CA')");
  const doesNotUseToISOString = !returnLine.includes('toISOString()');
  record(
    'R3-DATE-02',
    'La ligne de retour de getTodayLocalISODate() appelle toLocaleDateString, jamais toISOString',
    usesLocaleDateString && doesNotUseToISOString && returnLine.length > 0,
    "Ligne de retour contenant toLocaleDateString('en-CA'), sans toISOString()",
    `returnLine="${returnLine.trim()}"`
  );

  // --------------------------------------------------------------------------
  // R3-DATE-03 : les deux écrans historiquement divergents (identifiés lors
  // de l'audit) importent la fonction partagée ET ne contiennent plus le
  // motif UTC direct pour une date "aujourd'hui" par défaut. Vérification par
  // lecture réelle des fichiers sources — échoue si l'un des deux régresse.
  // --------------------------------------------------------------------------
  const screensToCheck = [
    'src/components/CreateTrialWizardModal.tsx',
    'src/components/trial-tabs/Tab02LotsPanels.tsx'
  ];

  const utcRegressionPattern = /toISOString\(\)\.slice\(0,\s*10\)/;
  const screenChecks = screensToCheck.map((relPath) => {
    const source = fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
    const importsSharedUtil = /import\s*\{\s*getTodayLocalISODate\s*\}\s*from\s*['"].*dateUtils['"]/.test(source);
    const callsSharedUtil = source.includes('getTodayLocalISODate()');
    const hasUtcRegression = utcRegressionPattern.test(source);
    return { relPath, importsSharedUtil, callsSharedUtil, hasUtcRegression };
  });

  const allScreensCompliant = screenChecks.every(
    (c) => c.importsSharedUtil && c.callsSharedUtil && !c.hasUtcRegression
  );

  record(
    'R3-DATE-03',
    'CreateTrialWizardModal.tsx et Tab02LotsPanels.tsx utilisent tous deux getTodayLocalISODate() et ne contiennent plus toISOString().slice(0,10) pour une date par défaut',
    allScreensCompliant,
    'Import + appel de la fonction partagée sur les deux écrans, aucune régression UTC',
    screenChecks
      .map((c) => `${c.relPath}: import=${c.importsSharedUtil}, appel=${c.callsSharedUtil}, régressionUTC=${c.hasUtcRegression}`)
      .join(' | ')
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };
}
