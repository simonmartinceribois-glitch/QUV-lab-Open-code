/**
 * QUV-Lab — Modification validée de l'identification (onglet 01) et traçabilité
 * dans 09 Journal de bord (R-IDENT).
 *
 * Contrat : une entrée MODIFY_IDENTIFICATION par champ modifié (champ, avant,
 * après, opérateur), rien n'est écrit sans différence ni sur saisie invalide,
 * les champs non modifiables restent intacts.
 */
import { TrialStoreService } from '../../services/trialStoreService';
import { identificationFormFromTrial, diffIdentification } from '../../services/trialIdentification';
import type { IdentificationForm } from '../../services/trialIdentification';
import type { Trial } from '../../types/trial';

export interface IdentificationEditTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function setup(): { store: TrialStoreService; trial: Trial; form: IdentificationForm } {
  const store = TrialStoreService.createIsolatedStore();
  const trial = store.resetToDemo();
  return { store, trial, form: identificationFormFromTrial(trial) };
}

function rejects(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export function runTrialIdentificationEditTests(): {
  results: IdentificationEditTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: IdentificationEditTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-IDENT-01 : aucune différence → aucune entrée, essai inchangé.
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const changes = store.updateTrialIdentification(trial.id, { ...form }, 'OP');
    record('R-IDENT-01', 'Validation sans différence → aucune entrée de journal, essai strictement inchangé',
      changes.length === 0 && JSON.stringify(store.getTrial(trial.id)) === before, '0 modification, inchangé',
      `${changes.length} modification(s), inchangé=${JSON.stringify(store.getTrial(trial.id)) === before}`);
  }

  // R-IDENT-02 : deux champs → deux entrées tracées (avant / après / opérateur).
  {
    const { store, trial, form } = setup();
    const auditBefore = trial.auditTrail.length;
    const oldClient = form.projectOrClient;
    const preserved = {
      reference: trial.metadata.reference,
      createdBy: trial.metadata.createdBy,
      coating: trial.metadata.coatingSystemDescription,
      substrate: trial.metadata.substrateDescription
    };
    store.updateTrialIdentification(trial.id, { ...form, projectOrClient: 'Client B', orderNumber: '  CO-2026-777 ' }, 'SM');
    const t = store.getTrial(trial.id) as Trial;
    const entries = t.auditTrail.slice(auditBefore);
    const client = entries.find((e) => e.details?.['field'] === 'projectOrClient');
    const order = entries.find((e) => e.details?.['field'] === 'orderNumber');
    const ok =
      entries.length === 2 &&
      entries.every((e) => e.action === 'MODIFY_IDENTIFICATION' && e.operatorId === 'SM' && e.timestamp === entries[0].timestamp) &&
      client?.details?.['before'] === oldClient && client?.details?.['after'] === 'Client B' && client?.details?.['label'] === 'Client' &&
      order?.details?.['after'] === 'CO-2026-777' &&
      t.metadata.projectOrClient === 'Client B' && t.metadata.orderNumber === 'CO-2026-777' &&
      t.metadata.reference === preserved.reference && t.metadata.createdBy === preserved.createdBy &&
      t.metadata.coatingSystemDescription === preserved.coating && t.metadata.substrateDescription === preserved.substrate;
    record('R-IDENT-02', '2 champs modifiés → 2 entrées MODIFY_IDENTIFICATION (libellé, avant, après, opérateur), autres champs intacts',
      ok, '2 entrées, valeurs nettoyées, référence/créateur/descriptions intacts',
      `entrées=${entries.length}, client=${String(client?.details?.['before'])}→${String(client?.details?.['after'])}, commande=${String(order?.details?.['after'])}`);
  }

  // R-IDENT-03 : opérateur obligatoire.
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const refused = rejects(() => store.updateTrialIdentification(trial.id, { ...form, title: 'X' }, '  '));
    record('R-IDENT-03', 'Opérateur vide → refus, essai inchangé',
      refused && JSON.stringify(store.getTrial(trial.id)) === before, 'refus, inchangé', `refus=${refused}`);
  }

  // R-IDENT-04 : dimensions invalides refusées (négative, texte, effacement).
  {
    const { store, trial, form } = setup();
    const before = JSON.stringify(store.getTrial(trial.id));
    const cases = [{ ...form, lengthMm: '-5' }, { ...form, widthMm: 'abc' }, { ...form, thicknessMm: '' }, { ...form, unit: 'm' }];
    const allRefused = cases.every((c) => rejects(() => store.updateTrialIdentification(trial.id, c, 'OP')));
    record('R-IDENT-04', 'Dimension négative, non numérique, effacée ou unité hors liste → refus, essai inchangé',
      allRefused && JSON.stringify(store.getTrial(trial.id)) === before, '4 refus, inchangé', `tousRefusés=${allRefused}`);
  }

  // R-IDENT-05 : normalisation numérique (pas de fausse modification, virgule acceptée).
  {
    const { store, trial, form } = setup();
    const length = form.lengthMm;
    const noop = diffIdentification(trial, { ...form, lengthMm: `${length}.0` }).length === 0;
    store.updateTrialIdentification(trial.id, { ...form, widthMm: '75,5' }, 'OP');
    const width = store.getTrial(trial.id)?.commonCharacteristics?.dimensions?.widthMm;
    record('R-IDENT-05', '« 150.0 » = « 150 » (aucune modification) ; « 75,5 » enregistré comme nombre 75.5',
      noop && width === 75.5, 'aucune fausse modification, 75.5', `fausseModif=${!noop}, largeur=${String(width)}`);
  }

  // R-IDENT-06 : essai sans dimensions → aucune modification fictive ; première saisie tracée depuis « vide ».
  {
    const { store, trial } = setup();
    trial.commonCharacteristics = { substrateNature: 'Bois massif' };
    store.saveTrial(trial);
    const form = identificationFormFromTrial(store.getTrial(trial.id) as Trial);
    const spurious = diffIdentification(trial, form).length;
    const changes = store.updateTrialIdentification(trial.id, { ...form, lengthMm: '150' }, 'OP');
    const dims = store.getTrial(trial.id)?.commonCharacteristics?.dimensions;
    record('R-IDENT-06', 'Sans dimensions enregistrées : aucune modification fictive ; saisie de la longueur tracée « » → 150, unité mm',
      spurious === 0 && changes.length === 1 && changes[0].before === '' && dims?.lengthMm === 150 && dims.unit === 'mm',
      '0 fictive, 1 tracée, 150 mm', `fictives=${spurious}, tracées=${changes.length}, dims=${JSON.stringify(dims)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
