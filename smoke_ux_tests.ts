/**
 * QUV-Lab — Smoke test des 45 cas d'acceptation UX (UXTestsSuite.tsx).
 *
 * R2 (audit 11-12/09/2026) : uxTestCases est un tableau exécuté UNIQUEMENT
 * dans le navigateur (composant React), donc jamais couvert par
 * run_tests.ts (suite Node/tsx). Après avoir remplacé les 10 `pass: true`
 * codés en dur par de vraies assertions, ce script exécute chaque
 * `verify(trial, ruleSet)` contre deux essais réels (démo + validation) pour
 * détecter toute exception runtime introduite par une future modification.
 *
 * Ce script ne fait PAS partie de run_tests.ts et n'échoue PAS sur un simple
 * résultat métier `pass:false` (certains tests échouent légitimement sur le
 * jeu de données "validation", qui est volontairement incomplet sur certains
 * aspects — ex. aucune configuration de comptage, aucun panneau exclu). Il
 * échoue uniquement si une fonction verify() lève une exception, ce qui
 * indiquerait une régression structurelle (import cassé, champ renommé...).
 *
 * Usage : npx tsx smoke_ux_tests.ts
 */
import { getDefaultScientificRuleSet } from './src/scientific/ruleSet';
import { createDemoTrial, createValidationTrial } from './src/services/trialSeed';
import { uxTestCases } from './src/components/UXTestsSuite';

const ruleSet = getDefaultScientificRuleSet();
const trials = {
  demo: createDemoTrial(ruleSet),
  validation: createValidationTrial(ruleSet)
};

let totalErrors = 0;
let totalFail = 0;
let totalPass = 0;

for (const [trialName, trial] of Object.entries(trials)) {
  console.log(`\n=== Essai: ${trialName} (${Object.keys(trial.acquisitions).length} acquisitions, ${trial.stages.length} stages) ===`);
  for (const tc of uxTestCases) {
    try {
      const result = tc.verify(trial, ruleSet);
      if (result.pass) totalPass++; else totalFail++;
      const marker = result.pass ? 'PASS' : 'FAIL';
      console.log(`[${marker}] #${tc.id} ${tc.title} :: ${result.details}`);
    } catch (e) {
      totalErrors++;
      console.log(`[ERROR] #${tc.id} ${tc.title} :: EXCEPTION -> ${(e as Error).message}`);
    }
  }
}

console.log(`\nTotal: ${totalPass} pass, ${totalFail} fail (métier, non bloquant), ${totalErrors} exception(s) runtime.`);
process.exit(totalErrors > 0 ? 1 : 0);
