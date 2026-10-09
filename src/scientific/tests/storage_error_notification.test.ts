/**
 * QUV-Lab — Tests du mécanisme de notification d'échec de persistance localStorage
 * (R-STORAGE, audit du 15/09/2026).
 *
 * Contexte : la migration IndexedDB (PR #111) a retiré les Blobs photo de
 * localStorage, mais l'écriture JSON des métadonnées (`saveToStorage()`) peut
 * toujours échouer (quota, navigation privée, etc.). Avant ce correctif,
 * l'échec était totalement avalé (`catch { // ignore }`). Ce fichier vérifie
 * que l'échec est désormais détecté, classifié et remonté aux abonnés, sans
 * jamais faire remonter d'exception vers l'appelant de saveTrial().
 *
 * Le polyfill localStorage (Map en mémoire, scopé à chaque test et retiré
 * dans un `finally`) reprend le pattern déjà utilisé par
 * measurement_plan_round_trip.test.ts, avec un hook `failNextWritesWith`
 * pour simuler un échec de setItem() sur commande.
 */
import { TrialStoreService, STORAGE_BACKUP_KEY_PREFIX } from '../../services/trialStoreService';
import type { StorageErrorEvent } from '../../services/trialStoreService';

export interface StorageErrorTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

interface FakeLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  length: number;
  failNextWritesWith: (err: unknown) => void;
  failReadsWith: (err: unknown) => void;
  keys: () => string[];
  writeCount: () => number;
}

function createFakeLocalStorage(): FakeLocalStorage {
  const store = new Map<string, string>();
  let failWith: unknown = null;
  let readFailure: unknown = null;
  let writes = 0;
  return {
    getItem: (key) => {
      if (readFailure !== null) throw readFailure;
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem: (key, value) => {
      writes++;
      if (failWith !== null) {
        const err = failWith;
        failWith = null;
        throw err;
      }
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
    failNextWritesWith: (err: unknown) => {
      failWith = err;
    },
    failReadsWith: (err: unknown) => {
      readFailure = err;
    },
    keys: () => Array.from(store.keys()),
    writeCount: () => writes
  };
}

function withFakeLocalStorage<T>(fn: (fakeStorage: FakeLocalStorage) => T): T {
  const globalAny = globalThis as unknown as { localStorage?: FakeLocalStorage };
  const previousLocalStorage = globalAny.localStorage;
  const fakeStorage = createFakeLocalStorage();
  globalAny.localStorage = fakeStorage;
  try {
    return fn(fakeStorage);
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalAny.localStorage;
    } else {
      globalAny.localStorage = previousLocalStorage;
    }
  }
}

export function runStorageErrorNotificationTests(): {
  results: StorageErrorTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: StorageErrorTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --------------------------------------------------------------------------
  // R-STORAGE-01 : un échec de quota (DOMException standard) est classifié
  // STORAGE_QUOTA_EXCEEDED et remonté au(x) listener(s).
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    const captured: StorageErrorEvent[] = [];
    store.onStorageError((event) => captured.push(event));

    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    store.saveTrial(store.getAllTrials()[0]);

    const event = captured[0];
    const ok = event?.type === 'STORAGE_QUOTA_EXCEEDED' && store.isPersistenceHealthy() === false;
    record(
      'R-STORAGE-01',
      'QuotaExceededError (DOMException) → événement STORAGE_QUOTA_EXCEEDED + isPersistenceHealthy() === false',
      ok,
      'type=STORAGE_QUOTA_EXCEEDED, isPersistenceHealthy=false',
      `type=${event?.type ?? 'aucun événement'}, isPersistenceHealthy=${store.isPersistenceHealthy()}`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-02 : une erreur de quota qui n'est PAS une DOMException du même
  // realm (nom seul, ex. environnement de test/polyfill) doit tout de même
  // être classifiée STORAGE_QUOTA_EXCEEDED — pas seulement les vraies
  // DOMException. Documente la limite signalée en audit (détection fragile
  // avant durcissement par duck-typing sur name/code).
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    const captured: StorageErrorEvent[] = [];
    store.onStorageError((event) => captured.push(event));

    const polyfillErr = new Error('quota exceeded (polyfill)');
    (polyfillErr as { name: string }).name = 'QuotaExceededError';
    fakeStorage.failNextWritesWith(polyfillErr);
    store.saveTrial(store.getAllTrials()[0]);

    const event = captured[0];
    const ok = event?.type === 'STORAGE_QUOTA_EXCEEDED';
    record(
      'R-STORAGE-02',
      "Erreur portant name='QuotaExceededError' sans être une DOMException du même realm → classifiée STORAGE_QUOTA_EXCEEDED",
      ok,
      'type=STORAGE_QUOTA_EXCEEDED',
      `type=${event?.type ?? 'aucun événement'}`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-03 : une erreur non liée au quota est classifiée
  // STORAGE_UNKNOWN_ERROR (pas de faux positif quota).
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    const captured: StorageErrorEvent[] = [];
    store.onStorageError((event) => captured.push(event));

    fakeStorage.failNextWritesWith(new Error('disque plein / erreur générique'));
    store.saveTrial(store.getAllTrials()[0]);

    const event = captured[0];
    const ok = event?.type === 'STORAGE_UNKNOWN_ERROR';
    record(
      'R-STORAGE-03',
      'Erreur générique (non-quota) → classifiée STORAGE_UNKNOWN_ERROR',
      ok,
      'type=STORAGE_UNKNOWN_ERROR',
      `type=${event?.type ?? 'aucun événement'}`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-04 : saveTrial() ne lève JAMAIS d'exception vers l'appelant,
  // même si localStorage.setItem échoue (contrat : l'échec est signalé via
  // l'événement, pas via une exception qui romprait le flux applicatif).
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    let threw = false;
    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    try {
      store.saveTrial(store.getAllTrials()[0]);
    } catch {
      threw = true;
    }
    record(
      'R-STORAGE-04',
      "saveTrial() n'expose pas d'exception à l'appelant en cas d'échec localStorage",
      !threw,
      'Aucune exception propagée',
      threw ? 'Exception propagée' : 'Aucune exception propagée'
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-05 : une écriture réussie après un échec rétablit
  // isPersistenceHealthy() à true (le flag reflète bien la DERNIÈRE tentative,
  // et non un état figé après le premier échec).
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    store.saveTrial(store.getAllTrials()[0]);
    const unhealthyAfterFailure = store.isPersistenceHealthy() === false;

    // Écriture suivante : pas d'échec programmé, doit réussir normalement.
    store.saveTrial(store.getAllTrials()[0]);
    const healthyAfterSuccess = store.isPersistenceHealthy() === true;

    record(
      'R-STORAGE-05',
      'isPersistenceHealthy() repasse à true après une écriture réussie suivant un échec',
      unhealthyAfterFailure && healthyAfterSuccess,
      'false puis true',
      `${unhealthyAfterFailure} puis ${healthyAfterSuccess}`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-06 : un listener qui lève une exception n'empêche pas les
  // autres listeners d'être notifiés, et ne fait pas planter saveTrial().
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    let secondListenerCalled = false;
    store.onStorageError(() => {
      throw new Error('listener défaillant');
    });
    store.onStorageError(() => {
      secondListenerCalled = true;
    });

    let threw = false;
    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    try {
      store.saveTrial(store.getAllTrials()[0]);
    } catch {
      threw = true;
    }

    record(
      'R-STORAGE-06',
      "Un listener défaillant n'empêche ni la notification des autres listeners ni saveTrial()",
      secondListenerCalled && !threw,
      'secondListenerCalled=true, aucune exception',
      `secondListenerCalled=${secondListenerCalled}, exception=${threw}`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-07 : un store éphémère (ephemeral: true) n'appelle jamais
  // localStorage.setItem et ne déclenche donc aucun événement d'erreur.
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService({ ephemeral: true });
    store.resetToDemo();
    const captured: StorageErrorEvent[] = [];
    store.onStorageError((event) => captured.push(event));

    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    store.saveTrial(store.getAllTrials()[0]);

    record(
      'R-STORAGE-07',
      'Un store éphémère ne déclenche jamais onStorageError (aucune écriture localStorage tentée)',
      captured.length === 0,
      '0 événement',
      `${captured.length} événement(s)`
    );
  });

  // --------------------------------------------------------------------------
  // R-STORAGE-08 : se désabonner (fonction retournée par onStorageError)
  // arrête bien la réception d'événements futurs.
  // --------------------------------------------------------------------------
  withFakeLocalStorage((fakeStorage) => {
    const store = new TrialStoreService();
    const captured: StorageErrorEvent[] = [];
    const unsubscribe = store.onStorageError((event) => captured.push(event));
    unsubscribe();

    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    store.saveTrial(store.getAllTrials()[0]);

    record(
      'R-STORAGE-08',
      'unsubscribe() stoppe bien la réception des événements pour ce listener',
      captured.length === 0,
      '0 événement reçu après désabonnement',
      `${captured.length} événement(s) reçu(s)`
    );
  });

  // ==========================================================================
  // R-STORAGE-09 → 14 : lecture anormale au démarrage — le contenu d'origine
  // ne doit JAMAIS être perdu (avant ce correctif, la première écriture
  // remplaçait un stockage illisible par les essais de démonstration).
  // ==========================================================================
  const STORAGE_KEY = 'quv_lab_trials_v2_2';
  const backupKeysOf = (fake: FakeLocalStorage) => fake.keys().filter((k) => k.startsWith(STORAGE_BACKUP_KEY_PREFIX));

  // R-STORAGE-09 : JSON corrompu → copie de secours intégrale AVANT la
  // première écriture (scénario reproduit : simple consultation des résultats).
  withFakeLocalStorage((fakeStorage) => {
    const corrupt = '[{"id":"REAL-1","truncated": tru';
    fakeStorage.setItem(STORAGE_KEY, corrupt);
    const writesBeforeLoad = fakeStorage.writeCount();
    const store = new TrialStoreService();
    const loadWrites = fakeStorage.writeCount() - writesBeforeLoad;
    const signaledAtLoad = store.getStorageLoadIssue()?.type === 'STORAGE_LOAD_RECOVERED';
    store.logViewResults(store.getAllTrials()[0].id, 'OP');
    const issue = store.getStorageLoadIssue();
    const backups = backupKeysOf(fakeStorage);
    const backupIntact = backups.length === 1 && fakeStorage.getItem(backups[0]) === corrupt;
    record(
      'R-STORAGE-09',
      'JSON corrompu → signalé au chargement (0 écriture), contenu brut sauvegardé intégralement avant la première écriture',
      loadWrites === 0 && signaledAtLoad && issue?.type === 'STORAGE_LOAD_RECOVERED' && issue.backupKey === backups[0] && backupIntact,
      '0 écriture au chargement, STORAGE_LOAD_RECOVERED, 1 copie identique au contenu corrompu',
      `écrituresChargement=${loadWrites}, signalé=${signaledAtLoad}, type=${issue?.type ?? 'aucun'}, copies=${backups.length}, identique=${backupIntact}`
    );
  });

  // R-STORAGE-10 : JSON corrompu ET copie de secours impossible → écritures
  // bloquées : la clé d'origine reste strictement inchangée.
  withFakeLocalStorage((fakeStorage) => {
    const corrupt = '{not json';
    fakeStorage.setItem(STORAGE_KEY, corrupt);
    fakeStorage.failNextWritesWith(new DOMException('quota exceeded', 'QuotaExceededError'));
    const store = new TrialStoreService();
    const captured: StorageErrorEvent[] = [];
    store.onStorageError((event) => captured.push(event));
    store.saveTrial(store.getAllTrials()[0]);
    store.logViewResults(store.getAllTrials()[0].id, 'OP');
    const intact = fakeStorage.getItem(STORAGE_KEY) === corrupt;
    const ok =
      store.getStorageLoadIssue()?.type === 'STORAGE_WRITE_BLOCKED' &&
      intact &&
      captured.length === 2 &&
      captured.every((e) => e.type === 'STORAGE_WRITE_BLOCKED') &&
      store.isPersistenceHealthy() === false;
    record(
      'R-STORAGE-10',
      'Copie de secours impossible → écritures bloquées, stockage d’origine inchangé, opérateur notifié à chaque tentative',
      ok,
      'WRITE_BLOCKED, original intact, 2 notifications, persistance non saine',
      `type=${store.getStorageLoadIssue()?.type ?? 'aucun'}, intact=${intact}, notifications=${captured.length}, healthy=${store.isPersistenceHealthy()}`
    );
  });

  // R-STORAGE-11 : JSON valide mais pas un tableau → même protection.
  withFakeLocalStorage((fakeStorage) => {
    const raw = '{"trials":[{"id":"REAL-1"}]}';
    fakeStorage.setItem(STORAGE_KEY, raw);
    const store = new TrialStoreService();
    store.saveTrial(store.getAllTrials()[0]);
    const backups = backupKeysOf(fakeStorage);
    const ok =
      store.getStorageLoadIssue()?.type === 'STORAGE_LOAD_RECOVERED' &&
      backups.length === 1 &&
      fakeStorage.getItem(backups[0]) === raw;
    record(
      'R-STORAGE-11',
      'Format inattendu (objet au lieu d’un tableau) → contenu brut sauvegardé avant écriture',
      ok,
      'STORAGE_LOAD_RECOVERED, 1 copie identique',
      `type=${store.getStorageLoadIssue()?.type ?? 'aucun'}, copies=${backups.length}`
    );
  });

  // R-STORAGE-12 : tableau avec un essai illisible → les essais valides sont
  // chargés ET le contenu brut complet (essai illisible inclus) est conservé.
  withFakeLocalStorage((fakeStorage) => {
    new TrialStoreService(); // premier lancement : démo persistée
    const validTrials = JSON.parse(fakeStorage.getItem(STORAGE_KEY) as string) as Array<{ id: string }>;
    const raw = JSON.stringify([...validTrials, { id: 'BROKEN-1', stages: 'not-an-array' }]);
    fakeStorage.setItem(STORAGE_KEY, raw);
    const store = new TrialStoreService();
    store.saveTrial(store.getAllTrials()[0]);
    const backups = backupKeysOf(fakeStorage);
    const allValidLoaded = validTrials.every((t) => !!store.getTrial(t.id));
    const ok =
      allValidLoaded &&
      !store.getTrial('BROKEN-1') &&
      store.getStorageLoadIssue()?.type === 'STORAGE_LOAD_RECOVERED' &&
      backups.length === 1 &&
      fakeStorage.getItem(backups[0]) === raw;
    record(
      'R-STORAGE-12',
      'Essai illisible ignoré → essais valides chargés, contenu brut complet sauvegardé avant écriture',
      ok,
      'valides chargés, BROKEN-1 ignoré, 1 copie identique',
      `validesChargés=${allValidLoaded}, type=${store.getStorageLoadIssue()?.type ?? 'aucun'}, copies=${backups.length}`
    );
  });

  // R-STORAGE-13 : lecture impossible (getItem lève) → aucune écriture tentée.
  withFakeLocalStorage((fakeStorage) => {
    fakeStorage.failReadsWith(new DOMException('access denied', 'SecurityError'));
    const store = new TrialStoreService();
    const writesBefore = fakeStorage.writeCount();
    store.saveTrial(store.getAllTrials()[0]);
    const ok =
      store.getStorageLoadIssue()?.type === 'STORAGE_WRITE_BLOCKED' && fakeStorage.writeCount() === writesBefore;
    record(
      'R-STORAGE-13',
      'Lecture du stockage impossible → écritures bloquées (aucun setItem tenté)',
      ok,
      'WRITE_BLOCKED, 0 écriture',
      `type=${store.getStorageLoadIssue()?.type ?? 'aucun'}, écritures=${fakeStorage.writeCount() - writesBefore}`
    );
  });

  // R-STORAGE-14 : stockage sain → aucune anomalie, aucune copie de secours.
  withFakeLocalStorage((fakeStorage) => {
    new TrialStoreService();
    const store = new TrialStoreService();
    store.saveTrial(store.getAllTrials()[0]);
    const ok = store.getStorageLoadIssue() === null && backupKeysOf(fakeStorage).length === 0;
    record(
      'R-STORAGE-14',
      'Stockage sain → aucune anomalie signalée, aucune copie de secours créée',
      ok,
      'issue=null, 0 copie',
      `issue=${store.getStorageLoadIssue()?.type ?? 'null'}, copies=${backupKeysOf(fakeStorage).length}`
    );
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    results,
    summary: { total: results.length, passed, failed }
  };
}
