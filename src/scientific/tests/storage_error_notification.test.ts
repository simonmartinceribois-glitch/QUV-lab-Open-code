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
import { TrialStoreService } from '../../services/trialStoreService';
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
}

function createFakeLocalStorage(): FakeLocalStorage {
  const store = new Map<string, string>();
  let failWith: unknown = null;
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
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
    }
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

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    results,
    summary: { total: results.length, passed, failed }
  };
}
