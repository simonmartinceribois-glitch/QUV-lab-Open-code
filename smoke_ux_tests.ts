/**
 * QUV-Lab — Smoke test des cas d'acceptation UX (UXTestsSuite.tsx).
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
 * échoue sur toute exception runtime, ce qui indiquerait une régression
 * structurelle (import cassé, champ renommé...).
 *
 * Fix contre-audit c1edb84 (point 3) : le comptage pass/fail/exception
 * utilisé ici est désormais la fonction PARTAGÉE `runUxTestCasesAgainst`
 * (src/scientific/uxSmokeRunner.ts), dont la fiabilité (elle ne doit jamais
 * avaler silencieusement un `pass:false` ou une exception) est prouvée par
 * un test Node réel et gaté dans run_tests.ts
 * (src/scientific/tests/ux_smoke_self_check.test.ts, suite51) — pas
 * seulement affirmée dans ce commentaire.
 *
 * Usage : npx tsx smoke_ux_tests.ts
 */
import { getDefaultScientificRuleSet } from './src/scientific/ruleSet';
import { createDemoTrial, createValidationTrial } from './src/services/trialSeed';
import { uxTestCases } from './src/components/UXTestsSuite';
import { runUxTestCasesAgainst } from './src/scientific/uxSmokeRunner';

const ruleSet = getDefaultScientificRuleSet();
const trials = {
  demo: createDemoTrial(ruleSet),
  validation: createValidationTrial(ruleSet)
};

let totalPass = 0;
let totalFail = 0;
let totalErrors = 0;

for (const [trialName, trial] of Object.entries(trials)) {
  console.log(`\n=== Essai: ${trialName} (${Object.keys(trial.acquisitions).length} acquisitions, ${trial.stages.length} stages) ===`);
  const run = runUxTestCasesAgainst(uxTestCases, trial, ruleSet);
  totalPass += run.passedIds.length;
  totalFail += run.failedIds.length;
  totalErrors += run.erroredIds.length;
  for (const outcome of run.outcomes) {
    const marker = outcome.status === 'PASS' ? 'PASS' : outcome.status === 'FAIL' ? 'FAIL' : 'ERROR';
    console.log(`[${marker}] #${outcome.id} ${outcome.title} :: ${outcome.details}`);
  }
}

console.log(`\nTotal: ${totalPass} pass, ${totalFail} fail (métier, non bloquant), ${totalErrors} exception(s) runtime.`);
process.exit(totalErrors > 0 ? 1 : 0);
