/**
 * QUV-Lab — Preuve que le mécanisme de détection pass/fail/exception du
 * smoke test UX (runUxTestCasesAgainst) fonctionne réellement (fix
 * contre-audit c1edb84, point 3).
 *
 * Contexte : `smoke_ux_tests.ts` (npm run test:ux-smoke) exécute les 45+ cas
 * `UXTestsSuite.tsx` et ne fait échouer le process que sur exception, jamais
 * sur un simple `pass:false` métier (documenté et justifié : certains tests
 * échouent légitimement sur le jeu de données "validation", volontairement
 * incomplet). Cette conception est correcte, mais rien ne PROUVAIT jusqu'ici
 * que le comptage lui-même détecte réellement un `pass:false` ou une
 * exception plutôt que de les compter comme des succès — un « faux vert »
 * du mécanisme de diagnostic, distinct des tests métier qu'il exécute.
 *
 * Ce test construit 3 cas UXTestCase SYNTHÉTIQUES à verdict connu à l'avance
 * (un qui réussit, un qui échoue, un qui lève une exception) et vérifie que
 * `runUxTestCasesAgainst` (la fonction utilisée à la fois ici et par
 * smoke_ux_tests.ts — source unique, cf. uxSmokeRunner.ts) les classe
 * correctement dans les trois catégories, sans qu'aucun cas n'échappe au
 * comptage ni ne soit classé dans la mauvaise catégorie.
 */

import { runUxTestCasesAgainst } from '../uxSmokeRunner';
import type { UXTestCase } from '../../components/UXTestsSuite';
import { getDefaultScientificRuleSet } from '../ruleSet';
import { createDemoTrial } from '../../services/trialSeed';

export interface UxSmokeSelfCheckResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runUxSmokeSelfCheckTests(): {
  results: UxSmokeSelfCheckResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: UxSmokeSelfCheckResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const ruleSet = getDefaultScientificRuleSet();
  const trial = createDemoTrial(ruleSet);

  // Trois cas à verdict CONNU À L'AVANCE — le point de ce test n'est pas ce
  // qu'ils vérifient sur `trial`, mais ce que runUxTestCasesAgainst en fait.
  const syntheticCases: UXTestCase[] = [
    {
      id: 90001,
      title: 'SYNTHÉTIQUE — doit réussir',
      category: 'Auto-test',
      description: 'Cas de contrôle : verify() renvoie toujours pass:true.',
      expectedResult: 'PASS',
      targetTab: '00',
      verify: () => ({ pass: true, details: 'ok' })
    },
    {
      id: 90002,
      title: 'SYNTHÉTIQUE — doit échouer (pass:false)',
      category: 'Auto-test',
      description: 'Cas de contrôle : verify() renvoie toujours pass:false.',
      expectedResult: 'FAIL',
      targetTab: '00',
      verify: () => ({ pass: false, details: 'échec métier volontaire pour le test' })
    },
    {
      id: 90003,
      title: 'SYNTHÉTIQUE — doit lever une exception',
      category: 'Auto-test',
      description: 'Cas de contrôle : verify() lève systématiquement une exception.',
      expectedResult: 'ERROR',
      targetTab: '00',
      verify: () => {
        throw new Error('exception volontaire pour le test');
      }
    }
  ];

  const run = runUxTestCasesAgainst(syntheticCases, trial, ruleSet);

  // --------------------------------------------------------------------------
  // Le point central : AUCUN cas ne doit disparaître du comptage. Un
  // mécanisme défaillant pourrait par exemple avaler l'exception (try/catch
  // mal placé) et ne compter que 2 résultats au lieu de 3.
  // --------------------------------------------------------------------------
  record(
    'UX-SMOKE-01',
    'Les 3 cas synthétiques sont tous comptabilisés (aucun avalé silencieusement)',
    run.total === 3 && run.outcomes.length === 3,
    'total=3, outcomes.length=3',
    `total=${run.total}, outcomes.length=${run.outcomes.length}`
  );

  record(
    'UX-SMOKE-02',
    'Le cas pass:true est classé PASS, et uniquement lui',
    run.passedIds.length === 1 && run.passedIds[0] === 90001,
    'passedIds=[90001]',
    `passedIds=${JSON.stringify(run.passedIds)}`
  );

  // --------------------------------------------------------------------------
  // UX-SMOKE-03 : le cœur du point 3 du contre-audit. Un pass:false DOIT
  // être classé FAIL, jamais PASS ni disparaître.
  // --------------------------------------------------------------------------
  record(
    'UX-SMOKE-03',
    "Le cas pass:false est classé FAIL (jamais PASS, jamais absent) — la suite détecte réellement un échec métier",
    run.failedIds.length === 1 && run.failedIds[0] === 90002 && !run.passedIds.includes(90002),
    'failedIds=[90002], absent de passedIds',
    `failedIds=${JSON.stringify(run.failedIds)}, passedIds=${JSON.stringify(run.passedIds)}`
  );

  record(
    'UX-SMOKE-04',
    'Le cas levant une exception est classé ERROR (jamais PASS, jamais FAIL silencieux)',
    run.erroredIds.length === 1 && run.erroredIds[0] === 90003,
    'erroredIds=[90003]',
    `erroredIds=${JSON.stringify(run.erroredIds)}`
  );

  // --------------------------------------------------------------------------
  // UX-SMOKE-05 : reproduit la condition d'échec RÉELLE utilisée par
  // smoke_ux_tests.ts (process.exit(totalErrors > 0 ? 1 : 0)) — prouve que le
  // script échouerait bien (code de sortie 1) si un cas de la suite levait
  // une exception, et ne l'ignorerait pas silencieusement (jamais 0).
  // --------------------------------------------------------------------------
  const wouldExitNonZero = run.erroredIds.length > 0;
  record(
    'UX-SMOKE-05',
    "La condition de sortie utilisée par smoke_ux_tests.ts (exit 1 si erroredIds non vide) se déclenche réellement sur ce scénario",
    wouldExitNonZero,
    'exit code attendu = 1 (erroredIds non vide)',
    `erroredIds.length=${run.erroredIds.length} -> exit code simulé = ${wouldExitNonZero ? 1 : 0}`
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
