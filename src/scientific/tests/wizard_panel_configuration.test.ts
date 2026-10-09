/**
 * QUV-Lab — Suite de Tests CONFIGURATION CANONIQUE DES PANNEAUX (Wizard).
 *
 * Chaque lot comporte exactement 4 panneaux (T témoin, E1/E2/E3 exposées).
 * L'assistant ne propose plus aucun nombre variable : une valeur panelCount
 * éventuelle (1, 6, 24, absente) est ignorée par createTrial().
 */

import { globalTrialStore } from '../../services/trialStore';
import { isPersozEligiblePanel, isExposedE1E2E3Panel, isWitnessPanel } from '../panelUtils';
import type { Trial } from '../../types/trial';

export interface WizardPanelConfigTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const CANONICAL_LABELS = ['T', '1', '2', '3'];
const CANONICAL_ROLES = ['T', 'E1', 'E2', 'E3'];

function createBatchTrial(panelCounts: (number | undefined)[], ref: string): Trial {
  return globalTrialStore.createTrial({
    metadata: { reference: ref, createdBy: 'TEST_OP' } as Trial['metadata'],
    batches: panelCounts.map((pc, i) => ({
      reference: `LOT-${ref}-${i + 1}`,
      ...(pc === undefined ? {} : { panelCount: pc })
    })),
    activeFamilies: ['COLOR']
  } as Parameters<typeof globalTrialStore.createTrial>[0]);
}

export function runWizardPanelConfigurationTests(): {
  results: WizardPanelConfigTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: WizardPanelConfigTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- PANEL-COUNT-01 : valeur trompeuse ignorée (6, 24, 1) ---
  {
    const t6 = createBatchTrial([6], 'PC01A');
    const t24 = createBatchTrial([24], 'PC01B');
    const t1 = createBatchTrial([1], 'PC01C');
    const counts = t6.batches[0].panels.length + '/' + t24.batches[0].panels.length + '/' + t1.batches[0].panels.length;
    const ok = t6.batches[0].panels.length === 4 &&
      t24.batches[0].panels.length === 4 &&
      t1.batches[0].panels.length === 4;
    record('PANEL-COUNT-01', 'panelCount 6/24/1 ignoré → toujours 4 panneaux',
      ok, '4/4/4', counts);
  }

  // --- PANEL-COUNT-02 : configuration canonique = 4 (champ absent) ---
  {
    const t = createBatchTrial([undefined], 'PC02');
    const ok = t.batches[0].panels.length === 4;
    record('PANEL-COUNT-02', 'Sans panelCount → 4 panneaux canoniques',
      ok, '4', String(t.batches[0].panels.length));
  }

  // --- PANEL-COUNT-03 : rôles canoniques exacts ---
  {
    const t = createBatchTrial([undefined], 'PC03');
    const labels = t.batches[0].panels.map((p) => p.label);
    const roles = t.batches[0].panels.map((p) => p.roleCode);
    const ok = JSON.stringify(labels) === JSON.stringify(CANONICAL_LABELS) &&
      JSON.stringify(roles) === JSON.stringify(CANONICAL_ROLES);
    record('PANEL-COUNT-03', 'Rôles exacts T/E1/E2/E3',
      ok, 'T,1,2,3 / T,E1,E2,E3', `${labels.join(',')} / ${roles.join(',')}`);
  }

  // --- PANEL-COUNT-04 : multi-lots → 4 par lot ---
  {
    const t = createBatchTrial([undefined, 6, undefined], 'PC04');
    const counts = t.batches.map((b) => b.panels.length);
    const ok = t.batches.length === 3 && counts.every((c) => c === 4);
    record('PANEL-COUNT-04', '3 lots → 4 panneaux chacun (8/12/… jamais variables)',
      ok, '[4,4,4]', JSON.stringify(counts));
  }

  // --- PANEL-COUNT-05 : paires rôle/roleCode par panneau ---
  {
    const t = createBatchTrial([undefined], 'PC05');
    const pairs = t.batches[0].panels.map((p) => `${p.label}:${p.role}/${p.roleCode}`);
    const ok = pairs[0] === 'T:WITNESS/T' &&
      pairs[1] === '1:EXPOSED_1/E1' &&
      pairs[2] === '2:EXPOSED_2/E2' &&
      pairs[3] === '3:EXPOSED_3/E3';
    record('PANEL-COUNT-05', 'Paires label/rôle/roleCode canoniques',
      ok, 'T:WITNESS/T…', pairs.join(' | '));
  }

  // --- PANEL-COUNT-06 : total cohérent lots × 4 ---
  {
    const t = createBatchTrial([undefined, undefined], 'PC06');
    const total = t.batches.flatMap((b) => b.panels).length;
    const ok = total === t.batches.length * 4;
    record('PANEL-COUNT-06', 'Total = lots × 4 (cohérent avec revue wizard)',
      ok, '8 = 2×4', String(total));
  }

  // --- PANEL-COUNT-07 : prédicats sur les panneaux créés ---
  {
    const t = createBatchTrial([undefined], 'PC07');
    const [pT, pE1, pE2, pE3] = t.batches[0].panels;
    const ok = isWitnessPanel(pT) && !isExposedE1E2E3Panel(pT) && !isPersozEligiblePanel(pT) &&
      [pE1, pE2, pE3].every((p) => isExposedE1E2E3Panel(p) && isPersozEligiblePanel(p) && !isWitnessPanel(p));
    record('PANEL-COUNT-07', 'T→témoin, E1/E2/E3→exposés (prédicats inchangés)',
      ok, 'true', String(ok));
  }

  // --- PANEL-COUNT-08 : garde-fou global (cette suite verte = contrat tenu) ---
  {
    const t = createBatchTrial([24], 'PC08');
    const ok = t.batches[0].panels.length === 4 &&
      t.batches[0].panels[0].roleCode === 'T' &&
      t.batches[0].panels[3].roleCode === 'E3';
    record('PANEL-COUNT-08', 'Contrat global : 4 panneaux T..E3 même avec entrée 24',
      ok, '4, T..E3', `${String(t.batches[0].panels.length)}, ${t.batches[0].panels[0].roleCode}..${t.batches[0].panels[3].roleCode}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
