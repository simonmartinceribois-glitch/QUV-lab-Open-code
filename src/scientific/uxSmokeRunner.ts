/**
 * QUV-Lab — Moteur d'exécution partagé pour les cas UXTestCase.
 *
 * Fix contre-audit c1edb84 (point 3) : le script `smoke_ux_tests.ts`
 * (npm run test:ux-smoke) comptait pass/fail/exceptions "à la main", sans
 * qu'aucun test ne prouve que ce comptage détecte réellement un `pass:
 * false` ou une exception plutôt que de les avaler silencieusement (« faux
 * vert » du mécanisme de diagnostic lui-même, pas des tests UX qu'il
 * exécute).
 *
 * Cette fonction est la SOURCE UNIQUE du comptage, utilisée à la fois par
 * `smoke_ux_tests.ts` (exécution manuelle contre de vrais essais) et par
 * `ux_smoke_self_check.test.ts` (suite Node réelle, gate54+ - voir ce
 * fichier pour la preuve que le mécanisme échoue bien quand il le doit).
 */
import type { UXTestCase } from '../components/UXTestsSuite';
import type { Trial } from '../types/trial';
import type { ScientificRuleSet } from '../types/scientific';

export interface UxTestCaseOutcome {
  id: number;
  title: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  details: string;
}

export interface UxTestCasesRunResult {
  outcomes: UxTestCaseOutcome[];
  total: number;
  passedIds: number[];
  failedIds: number[];
  erroredIds: number[];
}

export function runUxTestCasesAgainst(
  testCases: UXTestCase[],
  trial: Trial,
  ruleSet: ScientificRuleSet
): UxTestCasesRunResult {
  const outcomes: UxTestCaseOutcome[] = [];

  for (const tc of testCases) {
    try {
      const result = tc.verify(trial, ruleSet);
      outcomes.push({
        id: tc.id,
        title: tc.title,
        status: result.pass ? 'PASS' : 'FAIL',
        details: result.details
      });
    } catch (e) {
      outcomes.push({
        id: tc.id,
        title: tc.title,
        status: 'ERROR',
        details: `EXCEPTION -> ${(e as Error).message}`
      });
    }
  }

  return {
    outcomes,
    total: outcomes.length,
    passedIds: outcomes.filter((o) => o.status === 'PASS').map((o) => o.id),
    failedIds: outcomes.filter((o) => o.status === 'FAIL').map((o) => o.id),
    erroredIds: outcomes.filter((o) => o.status === 'ERROR').map((o) => o.id)
  };
}
