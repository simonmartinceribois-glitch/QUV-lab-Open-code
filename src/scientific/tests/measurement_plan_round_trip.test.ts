/**
 * QUV-Lab — Test de round-trip JSON réel du plan de mesurage (P3-b).
 *
 * Contexte (audit 11-12/09/2026) : les tests Gate 54 (G54-CAL-03/04/09/10)
 * relisent l'état du plan de mesurage via `globalTrialStore.getTrial()` dans
 * le MÊME process, sans jamais passer par une sérialisation/désérialisation
 * JSON réelle simulant un vrai rechargement de page. Un bug de sérialisation
 * (ex. perte d'un champ, mauvaise reconstruction d'un objet imbriqué lors du
 * parsing) ne serait donc pas détecté par la suite existante.
 *
 * Ce fichier construit un polyfill minimal de `localStorage` (Map en
 * mémoire, scopé à ce test et retiré après exécution), crée une PREMIÈRE
 * instance de TrialStoreService (session A, persistance réelle via
 * JSON.stringify → localStorage.setItem), puis une SECONDE instance
 * indépendante pointant sur le même stockage (session B, simulant un
 * rechargement de page : constructeur → loadFromStorage → JSON.parse →
 * migrateTrialTerminology), et compare les champs structurants du plan de
 * mesurage entre les deux sessions.
 */

import { TrialStoreService } from '../../services/trialStore';
import type { Trial } from '../../types/trial';

export interface RoundTripTestResult {
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
}

function createFakeLocalStorage(): FakeLocalStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    }
  };
}

function stagesSummary(trial: Trial): string {
  return trial.stages
    .map((s) => `${s.cycleIndex}:${s.status}`)
    .sort()
    .join(',');
}

export function runMeasurementPlanRoundTripTests(): {
  results: RoundTripTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: RoundTripTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const globalAny = globalThis as unknown as { localStorage?: FakeLocalStorage };
  const previousLocalStorage = globalAny.localStorage;
  const fakeStorage = createFakeLocalStorage();
  globalAny.localStorage = fakeStorage;

  try {
    // --------------------------------------------------------------------------
    // Session A : première instance, persistance réelle au premier lancement
    // (stockage vide → seedDemoTrials(true) → JSON.stringify → setItem).
    // --------------------------------------------------------------------------
    const sessionA = new TrialStoreService();
    const trialsA = sessionA.getTrials();

    if (trialsA.length === 0) {
      record(
        'P3-B-01',
        "La session A persiste au moins un essai dans le stockage simulé",
        false,
        'Au moins 1 essai persisté',
        '0 essai trouvé après initialisation'
      );
      return finalize(results);
    }

    const rawPersisted = fakeStorage.getItem('quv_lab_trials_v2_2');
    const persistedContainsReferenceTrial =
      typeof rawPersisted === 'string' && rawPersisted.length > 0 && rawPersisted.includes(trialsA[0].id);
    record(
      'P3-B-01',
      "La session A écrit réellement une chaîne JSON contenant l'essai dans le stockage simulé (pas seulement en mémoire)",
      persistedContainsReferenceTrial,
      "Chaîne JSON non vide contenant l'id de l'essai persisté",
      `présent=${persistedContainsReferenceTrial}, taille=${rawPersisted?.length ?? 0} caractères`
    );

    const reference = trialsA[0];
    const referenceId = reference.id;
    const snapshotBefore = {
      stages: stagesSummary(reference),
      configurationStatus: reference.configurationStatus,
      acquisitionsCount: Object.keys(reference.acquisitions).length,
      auditTrailCount: reference.auditTrail.length,
      batchesCount: reference.batches.length,
      startDate: reference.startDate
    };

    // --------------------------------------------------------------------------
    // Session B : SECONDE instance indépendante, simulant un rechargement de
    // page complet — même stockage, nouveau constructeur, donc vrai passage
    // par JSON.parse + migrateTrialTerminology (jamais exercé par les tests
    // Gate 54 existants, qui relisent le même objet en mémoire).
    // --------------------------------------------------------------------------
    const sessionB = new TrialStoreService();
    const reloaded = sessionB.getTrial(referenceId);

    if (!reloaded) {
      record(
        'P3-B-02',
        "L'essai de référence est retrouvé après un rechargement complet (nouvelle instance, même stockage)",
        false,
        `Essai ${referenceId} présent après rechargement`,
        'Essai introuvable après rechargement (perte de données au round-trip JSON)'
      );
      return finalize(results);
    }

    const snapshotAfter = {
      stages: stagesSummary(reloaded),
      configurationStatus: reloaded.configurationStatus,
      acquisitionsCount: Object.keys(reloaded.acquisitions).length,
      auditTrailCount: reloaded.auditTrail.length,
      batchesCount: reloaded.batches.length,
      startDate: reloaded.startDate
    };

    record(
      'P3-B-02',
      "L'essai de référence est retrouvé après un rechargement complet (nouvelle instance, même stockage)",
      true,
      `Essai ${referenceId} présent après rechargement`,
      `Essai ${referenceId} retrouvé`
    );

    record(
      'P3-B-03',
      'Les 13 jalons (cycleIndex + statut) sont identiques avant/après round-trip JSON complet',
      snapshotBefore.stages === snapshotAfter.stages,
      snapshotBefore.stages,
      snapshotAfter.stages
    );

    record(
      'P3-B-04',
      'Le statut de verrouillage (configurationStatus) est préservé par le round-trip',
      snapshotBefore.configurationStatus === snapshotAfter.configurationStatus,
      snapshotBefore.configurationStatus,
      snapshotAfter.configurationStatus
    );

    record(
      'P3-B-05',
      "Le nombre d'acquisitions est identique avant/après round-trip (aucune perte, aucune fabrication)",
      snapshotBefore.acquisitionsCount === snapshotAfter.acquisitionsCount,
      String(snapshotBefore.acquisitionsCount),
      String(snapshotAfter.acquisitionsCount)
    );

    record(
      'P3-B-06',
      "Le journal d'audit (auditTrail) conserve le même nombre d'entrées après round-trip",
      snapshotBefore.auditTrailCount === snapshotAfter.auditTrailCount,
      String(snapshotBefore.auditTrailCount),
      String(snapshotAfter.auditTrailCount)
    );

    record(
      'P3-B-07',
      "La date de début d'exposition (startDate, chaîne ISO) n'est pas mutée par le round-trip JSON",
      snapshotBefore.startDate === snapshotAfter.startDate,
      String(snapshotBefore.startDate),
      String(snapshotAfter.startDate)
    );

    return finalize(results);
  } finally {
    // Nettoyage impératif : ne jamais laisser le polyfill affecter d'autres
    // suites de tests exécutées dans le même process (run_tests.ts).
    if (previousLocalStorage === undefined) {
      delete globalAny.localStorage;
    } else {
      globalAny.localStorage = previousLocalStorage;
    }
  }
}

function finalize(results: RoundTripTestResult[]): {
  results: RoundTripTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
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
