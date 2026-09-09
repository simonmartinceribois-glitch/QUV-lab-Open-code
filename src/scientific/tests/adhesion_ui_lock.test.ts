/**
 * QUV-Lab — Suite de Tests VERROU UI ADHÉSION : contrat d'affichage de la grille.
 *
 * La grille (BenchPanelGrid) n'exclut JAMAIS les cibles interdites : elle les
 * affiche DÉSACTIVÉES (pattern PERSOZ), en appliquant le prédicat canonique
 * unique isAdhesionEligiblePanel(panel, currentStage) sur le jalon RÉEL
 * (cycleIndex) — jamais l'UUID parsé. Contexte invalide/absent → verrou fermé.
 * Le runtime (recordAcquisition) reste l'autorité finale (non testé ici).
 */

import { isAdhesionEligiblePanel } from '../panelUtils';

export interface AdhesionUiLockTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

type MiniPanel = { label?: string; roleCode?: string; role?: string };
type MiniStage = { cycleIndex?: number };

const T: MiniPanel = { label: 'T', roleCode: 'T', role: 'WITNESS' };
const E1: MiniPanel = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
const E2: MiniPanel = { label: '2', roleCode: 'E2', role: 'EXPOSED_2' };
const E3: MiniPanel = { label: '3', roleCode: 'E3', role: 'EXPOSED_3' };
const ALL: MiniPanel[] = [T, E1, E2, E3];

const T0: MiniStage = { cycleIndex: 0 };
const C6: MiniStage = { cycleIndex: 6 };
const C12: MiniStage = { cycleIndex: 12 };

/** Décision de verrouillage de la grille, à l'identique de BenchPanelGrid. */
function isGridLocked(family: string, panel: MiniPanel, stage: MiniStage | undefined): boolean {
  return family === 'ADHESION' && !isAdhesionEligiblePanel(panel, stage ?? {});
}

function lockedLabels(family: string, stage: MiniStage | undefined): string[] {
  return ALL.filter((p) => isGridLocked(family, p, stage)).map((p) => p.label as string);
}

export function runAdhesionUiLockTests(): {
  results: AdhesionUiLockTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionUiLockTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- AUL-01 : contexte de jalon manquant → verrou fermé (fail closed) ---
  {
    const ok = ALL.every((p) => isGridLocked('ADHESION', p, undefined));
    record('AUL-01', 'Stage undefined → tous verrouillés (fail closed)',
      ok, 'T,E1,E2,E3 verrouillés', lockedLabels('ADHESION', undefined).join(',') || 'aucun');
  }

  // --- AUL-02 : jalon sans cycleIndex → verrou fermé (pas de parse UUID) ---
  {
    const ok = ALL.every((p) => isGridLocked('ADHESION', p, {}));
    record('AUL-02', 'Stage sans cycleIndex → tous verrouillés (fail closed)',
      ok, 'T,E1,E2,E3 verrouillés', lockedLabels('ADHESION', {}).join(',') || 'aucun');
  }

  // --- AUL-03 : T0 → T actif, E1/E2/E3 visiblement désactivés ---
  {
    const locked = lockedLabels('ADHESION', T0);
    const ok = locked.length === 3 && !locked.includes('T');
    record('AUL-03', 'T0 : T actif, E1/E2/E3 désactivés (affichés, non filtrés)',
      ok, 'verrouillés=1,2,3', `verrouillés=${locked.join(',')}`);
  }

  // --- AUL-04 : C1–C11 → ADHÉSION inaccessible pour chaque panneau ---
  {
    const c1: MiniStage = { cycleIndex: 1 };
    const c11: MiniStage = { cycleIndex: 11 };
    const ok = [c1, C6, c11].every((st) => lockedLabels('ADHESION', st).length === 4);
    record('AUL-04', 'C1/C6/C11 : les 4 panneaux verrouillés',
      ok, '4 verrouillés à chaque jalon', String(ok));
  }

  // --- AUL-05 : C12 → T désactivé, E1/E2/E3 actifs ---
  {
    const locked = lockedLabels('ADHESION', C12);
    const ok = locked.length === 1 && locked[0] === 'T';
    record('AUL-05', 'C12 : T désactivé, E1/E2/E3 actifs',
      ok, 'verrouillés=T', `verrouillés=${locked.join(',')}`);
  }

  // --- AUL-06 : autres familles jamais verrouillées par la règle ADHÉSION ---
  {
    const ok = (['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'] as const).every(
      (fam) => ALL.every((p) => !isGridLocked(fam, p, C12))
    );
    record('AUL-06', 'Règle ADHÉSION inactive hors famille ADHESION',
      ok, 'aucun verrou', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
