/**
 * QUV-Lab — Modification validée des lots & éprouvettes (onglet 02) et
 * traçabilité dans 09 Journal de bord (R-LOTS).
 *
 * Contrat : une entrée MODIFY_BATCH / MODIFY_PANEL par valeur modifiée
 * (élément, champ, avant, après, opérateur) ; refus global sans aucune
 * modification sur opérateur vide, valeur hors liste ou épaisseur figée
 * par une adhérence mesurée ; éprouvettes exclues et face du témoin ignorées.
 */
import { TrialStoreService } from '../../services/trialStoreService';
import { lotsSpecimensFormFromTrial, isBatchThicknessLocked } from '../../services/trialLotsSpecimens';
import type { LotsSpecimensForm } from '../../services/trialLotsSpecimens';
import type { Trial } from '../../types/trial';

export interface LotsSpecimensEditTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function setup(): { store: TrialStoreService; trial: Trial; form: LotsSpecimensForm } {
  const store = TrialStoreService.createIsolatedStore();
  const trial = store.resetToDemo();
  // Essai non verrouillé : l'épaisseur reste modifiable (cas de base).
  trial.configurationStatus = 'EDITABLE';
  store.saveTrial(trial);
  return { store, trial, form: lotsSpecimensFormFromTrial(trial) };
}

const clone = (f: LotsSpecimensForm): LotsSpecimensForm => JSON.parse(JSON.stringify(f));

function rejects(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export function runLotsSpecimensEditTests(): {
  results: LotsSpecimensEditTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: LotsSpecimensEditTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-LOTS-01 : aucune différence → rien.
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const changes = store.updateLotsAndSpecimens(trial.id, clone(form), 'OP');
    record('R-LOTS-01', 'Validation sans différence → aucune entrée, essai inchangé',
      changes.length === 0 && JSON.stringify(store.getTrial(trial.id)) === before, '0, inchangé', `${changes.length}`);
  }

  // R-LOTS-02 : épaisseur + orientation + face → 3 entrées tracées, valeurs appliquées.
  {
    const { store, trial, form } = setup();
    const batch = trial.batches[0];
    const exposed = batch.panels[1];
    const witness = batch.panels[0];
    const f = clone(form);
    f.thickness[batch.id] = '85';
    f.grain[witness.id] = form.grain[witness.id] === 'Dosse' ? 'Quartier' : 'Dosse';
    f.face[exposed.id] = form.face[exposed.id] === 'Face interne' ? 'Face externe' : 'Face interne';
    const auditBefore = trial.auditTrail.length;
    store.updateLotsAndSpecimens(trial.id, f, 'SM');
    const t = store.getTrial(trial.id) as Trial;
    const entries = t.auditTrail.slice(auditBefore);
    const thick = entries.find((e) => e.details?.['field'] === 'dryFilmThicknessMicrons');
    const grain = entries.find((e) => e.details?.['field'] === 'grainOrientation');
    const face = entries.find((e) => e.details?.['field'] === 'exposureFace');
    const ok =
      entries.length === 3 &&
      thick?.action === 'MODIFY_BATCH' && thick.entityType === 'BATCH' && thick.details?.['after'] === '85' && thick.details?.['target'] === batch.reference &&
      grain?.action === 'MODIFY_PANEL' && grain.entityId === witness.id && grain.details?.['target'] === `${batch.reference}-T` &&
      face?.action === 'MODIFY_PANEL' && face.details?.['before'] === form.face[exposed.id] &&
      entries.every((e) => e.operatorId === 'SM') &&
      t.batches[0].dryFilmThicknessMicrons === 85 &&
      t.batches[0].panels[0].grainOrientation === f.grain[witness.id] &&
      t.batches[0].panels[1].exposureFace === f.face[exposed.id];
    record('R-LOTS-02', 'Épaisseur, orientation (témoin) et face (exposée) → 3 entrées MODIFY_BATCH / MODIFY_PANEL, valeurs appliquées',
      ok, '3 entrées, cibles LOT et LOT-T, valeurs appliquées',
      `entrées=${entries.length}, épaisseur=${String(t.batches[0].dryFilmThicknessMicrons)}, cibles=${entries.map((e) => String(e.details?.['target'])).join(',')}`);
  }

  // R-LOTS-03 : opérateur obligatoire.
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const f = clone(form);
    f.thickness[trial.batches[0].id] = '99';
    const refused = rejects(() => store.updateLotsAndSpecimens(trial.id, f, ' '));
    record('R-LOTS-03', 'Opérateur vide → refus, essai inchangé',
      refused && JSON.stringify(store.getTrial(trial.id)) === before, 'refus, inchangé', `refus=${refused}`);
  }

  // R-LOTS-04 : valeurs invalides → refus global.
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const b = trial.batches[0];
    const cases: Array<(f: LotsSpecimensForm) => void> = [
      (f) => { f.thickness[b.id] = '0'; },
      (f) => { f.thickness[b.id] = '2000'; },
      (f) => { f.thickness[b.id] = 'abc'; },
      (f) => { f.grain[b.panels[1].id] = 'Diagonale'; },
      (f) => { f.face[b.panels[1].id] = 'Dessus'; }
    ];
    const allRefused = cases.every((mutate) => {
      const f = clone(form);
      f.grain[b.panels[2].id] = 'Dosse'; // modification valide jointe : refusée elle aussi
      mutate(f);
      return rejects(() => store.updateLotsAndSpecimens(trial.id, f, 'OP'));
    });
    record('R-LOTS-04', 'Épaisseur 0 / 2000 / texte, orientation ou face hors liste → refus global, rien appliqué',
      allRefused && JSON.stringify(store.getTrial(trial.id)) === before, '5 refus, inchangé', `tousRefusés=${allRefused}`);
  }

  // R-LOTS-05 : épaisseur figée (essai verrouillé + adhérence mesurée sur le lot).
  {
    const { store, trial, form } = setup();
    const b = trial.batches[0];
    trial.configurationStatus = 'LOCKED';
    if (!isBatchThicknessLocked(trial, b.id)) {
      trial.acquisitions['__test_adh__'] = { batchId: b.id, familyId: 'ADHESION', raw: {} } as unknown as Trial['acquisitions'][string];
    }
    store.saveTrial(trial);
    const before = JSON.stringify(store.getTrial(trial.id));
    const f = clone(form);
    f.thickness[b.id] = String(Number(form.thickness[b.id] || '60') + 10);
    const refused = rejects(() => store.updateLotsAndSpecimens(trial.id, f, 'OP'));
    record('R-LOTS-05', 'Essai verrouillé avec adhérence mesurée sur le lot → épaisseur figée, refus',
      isBatchThicknessLocked(trial, b.id) && refused && JSON.stringify(store.getTrial(trial.id)) === before, 'figée, refus, inchangé', `refus=${refused}`);
  }

  // R-LOTS-06 : éprouvette exclue et face du témoin ignorées ; épaisseur effaçable si non figée.
  {
    const { store, trial, form } = setup();
    const b = trial.batches[0];
    const excluded = b.panels[3];
    excluded.status = 'EXCLUDED';
    store.saveTrial(trial);
    const f = clone(lotsSpecimensFormFromTrial(store.getTrial(trial.id) as Trial));
    f.grain[excluded.id] = 'Dosse';
    f.face[b.panels[0].id] = 'Face interne'; // témoin : pas de face
    f.thickness[b.id] = '';
    const changes = store.updateLotsAndSpecimens(trial.id, f, 'OP');
    const hadThickness = form.thickness[b.id] !== '';
    const ok =
      changes.every((c) => c.entityId !== excluded.id && !(c.entityId === b.panels[0].id && c.field === 'exposureFace')) &&
      (hadThickness ? changes.length === 1 && changes[0].after === '' && store.getTrial(trial.id)?.batches[0].dryFilmThicknessMicrons === undefined : changes.length === 0);
    record('R-LOTS-06', 'Éprouvette exclue et face du témoin jamais modifiées ; épaisseur non figée effaçable (tracée « → vide »)',
      ok, 'seule l’épaisseur effacée est tracée', `modifications=${changes.map((c) => `${c.target}:${c.field}`).join(',')}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
