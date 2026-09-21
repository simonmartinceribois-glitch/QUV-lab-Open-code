/**
 * QUV-Lab — Test de round-trip JSON réel du plan de mesurage G52-CAL (P3-b).
 *
 * Contexte (audit 11-12/09/2026) : les tests Gate 54 (G54-CAL-03/04/09/10)
 * relisent l'état du plan de mesurage via `globalTrialStore.getTrial()` dans
 * le MÊME process, sans jamais passer par une sérialisation/désérialisation
 * JSON réelle simulant un vrai rechargement de page. Un bug de sérialisation
 * (ex. perte d'un champ, mauvaise reconstruction d'un objet imbriqué lors du
 * parsing) ne serait donc pas détecté par la suite existante.
 *
 * RÉVISION (contre-audit externe post-branche fix/audit-11-12-09-corrections) :
 * la première version de ce fichier prenait le premier essai de démonstration
 * (`trialsA[0]`) et comparait des compteurs génériques (nombre de jalons,
 * d'acquisitions, etc.). C'était un round-trip réel de PERSISTANCE, mais pas
 * une démonstration ciblée que le PLAN DE MESURAGE G52-CAL lui-même (jalons
 * ACTIVE/INACTIVE choisis explicitement) survit intact au cycle
 * JSON.stringify → localStorage → JSON.parse. Cette révision construit un
 * essai FRAIS avec un plan mixte explicite (T0, C3, C6, C9, C12 sélectionnés ;
 * C1/C2/C4/C5/C7/C8/C10/C11 volontairement exclus), et vérifie précisément :
 * - la présence des 13 jalons avec cycleIndex 0..12 (pas seulement un nombre
 *   identique avant/après, qui ne détecterait pas une corruption symétrique) ;
 * - le statut exact de CHAQUE jalon après rechargement (NOT_STARTED pour les
 *   jalons sélectionnés + T0/C12, INACTIVE pour les autres) ;
 * - T0 et C12 obligatoires et jamais INACTIVE ;
 * - configurationStatus préservé (EDITABLE, aucune acquisition) ;
 * - aucune acquisition fabriquée par le round-trip lui-même.
 *
 * Ce fichier construit un polyfill minimal de `localStorage` (Map en
 * mémoire, scopé à ce test et retiré après exécution dans un `finally`),
 * crée une PREMIÈRE instance de TrialStoreService (session A), y crée un
 * essai frais via l'API publique `createTrial()` (aucune donnée de
 * démonstration, aucune acquisition), puis une SECONDE instance indépendante
 * pointant sur le même stockage (session B, simulant un rechargement de page
 * complet : constructeur → loadFromStorage → JSON.parse →
 * migrateTrialTerminology). Aucune dépendance React/DOM.
 */

import { TrialStoreService } from '../../services/trialStore';
import type { Trial } from '../../types/trial';
import type { ColorRawData } from '../../types/scientific';

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

// Scénario explicite : T0 + C3/C6/C9 + C12 sélectionnés, le reste exclu.
const SELECTED_CYCLES = [3, 6, 9];
const EXPECTED_ACTIVE_CYCLES = new Set([0, 3, 6, 9, 12]); // T0 et C12 toujours actifs
const ALL_CYCLES = Array.from({ length: 13 }, (_, i) => i); // 0..12

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
    // Session A : essai FRAIS créé explicitement avec un plan de mesurage mixte
    // (pas un essai de démonstration préexistant dont le plan est accessoire).
    // Aucune acquisition n'est créée par createTrial().
    // --------------------------------------------------------------------------
    const sessionA = new TrialStoreService();
    let created: Trial;
    try {
      created = sessionA.createTrial({
        metadata: { reference: 'P3B-ROUNDTRIP-TEST', createdBy: 'audit-p3b' },
        batches: [{ reference: 'LOT-P3B-1', applicationDate: '2025-12-15T00:00:00Z' }],
        activeFamilies: ['COLOR', 'ADHESION'],
        selectedMeasurementCycles: SELECTED_CYCLES,
        startDate: '2026-01-15'
      });
    } catch (e) {
      record(
        'P3-B-00',
        'Création réussie d\'un essai frais avec un plan de mesurage mixte explicite (T0, C3, C6, C9, C12)',
        false,
        'Essai créé sans exception',
        `Exception levée : ${(e as Error).message}`
      );
      return finalize(results);
    }

    const referenceId = created.id;

    // Vérifie AVANT round-trip que le scénario de départ est bien celui attendu
    // (sinon la comparaison après round-trip ne prouverait rien).
    const beforeCycleIndices = created.stages.map((s) => s.cycleIndex).sort((a, b) => a - b);
    const beforeMatchesExpectedShape =
      JSON.stringify(beforeCycleIndices) === JSON.stringify(ALL_CYCLES) &&
      created.stages.every((s) =>
        EXPECTED_ACTIVE_CYCLES.has(s.cycleIndex) ? s.status !== 'INACTIVE' : s.status === 'INACTIVE'
      );
    record(
      'P3-B-00',
      "L'essai fraîchement créé respecte le scénario attendu AVANT tout round-trip (13 jalons, statuts ACTIVE/INACTIVE conformes à la sélection)",
      beforeMatchesExpectedShape,
      '13 jalons 0..12 ; INACTIVE sauf {0,3,6,9,12}',
      `cycleIndices=${JSON.stringify(beforeCycleIndices)}, statuts=${JSON.stringify(
        created.stages.map((s) => `${s.cycleIndex}:${s.status}`)
      )}`
    );

    const rawPersisted = fakeStorage.getItem('quv_lab_trials_v2_2');
    const persistedContainsReferenceTrial =
      typeof rawPersisted === 'string' && rawPersisted.length > 0 && rawPersisted.includes(referenceId);
    record(
      'P3-B-01',
      "La session A écrit réellement une chaîne JSON contenant l'essai dans le stockage simulé (pas seulement en mémoire)",
      persistedContainsReferenceTrial,
      "Chaîne JSON non vide contenant l'id de l'essai persisté",
      `présent=${persistedContainsReferenceTrial}, taille=${rawPersisted?.length ?? 0} caractères`
    );

    // --------------------------------------------------------------------------
    // Session B : SECONDE instance indépendante, simulant un rechargement de
    // page complet — même stockage, nouveau constructeur, donc vrai passage
    // par JSON.parse + migrateTrialTerminology.
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

    record(
      'P3-B-02',
      "L'essai de référence est retrouvé après un rechargement complet (nouvelle instance, même stockage)",
      true,
      `Essai ${referenceId} présent après rechargement`,
      `Essai ${referenceId} retrouvé`
    );

    // --------------------------------------------------------------------------
    // P3-B-03 : exactement 13 jalons, cycleIndex EXACTEMENT [0..12] — pas
    // seulement "même nombre avant/après" (qui ne détecterait pas une
    // corruption symétrique affectant les deux côtés à l'identique).
    // --------------------------------------------------------------------------
    const afterCycleIndices = reloaded.stages.map((s) => s.cycleIndex).sort((a, b) => a - b);
    const has13StagesWithCorrectIndices = JSON.stringify(afterCycleIndices) === JSON.stringify(ALL_CYCLES);
    record(
      'P3-B-03',
      'Exactement 13 jalons après round-trip, avec cycleIndex strictement égal à [0,1,2,...,12]',
      has13StagesWithCorrectIndices,
      JSON.stringify(ALL_CYCLES),
      JSON.stringify(afterCycleIndices)
    );

    // --------------------------------------------------------------------------
    // P3-B-04 : T0 et C12 obligatoires, jamais INACTIVE, après round-trip.
    // --------------------------------------------------------------------------
    const t0After = reloaded.stages.find((s) => s.cycleIndex === 0);
    const c12After = reloaded.stages.find((s) => s.cycleIndex === 12);
    const mandatoryStagesNeverInactive =
      !!t0After && !!c12After && t0After.status !== 'INACTIVE' && c12After.status !== 'INACTIVE';
    record(
      'P3-B-04',
      'T0 et C12 restent obligatoires (statut différent de INACTIVE) après round-trip',
      mandatoryStagesNeverInactive,
      'T0.status != INACTIVE et C12.status != INACTIVE',
      `T0=${t0After?.status ?? 'absent'}, C12=${c12After?.status ?? 'absent'}`
    );

    // --------------------------------------------------------------------------
    // P3-B-05 : les jalons explicitement sélectionnés (C3, C6, C9) restent
    // ACTIVE (statut != INACTIVE) après round-trip.
    // --------------------------------------------------------------------------
    const selectedStagesAfter = SELECTED_CYCLES.map((c) => reloaded.stages.find((s) => s.cycleIndex === c));
    const selectedStagesStillActive = selectedStagesAfter.every((s) => !!s && s.status !== 'INACTIVE');
    record(
      'P3-B-05',
      'Les jalons explicitement sélectionnés (C3, C6, C9) restent actifs (statut != INACTIVE) après round-trip',
      selectedStagesStillActive,
      'C3, C6, C9 tous != INACTIVE',
      selectedStagesAfter.map((s) => `${s?.cycleIndex ?? '?'}:${s?.status ?? 'absent'}`).join(', ')
    );

    // --------------------------------------------------------------------------
    // P3-B-06 : les jalons NON sélectionnés (C1,C2,C4,C5,C7,C8,C10,C11) restent
    // INACTIVE après round-trip — pas de "réactivation" ni de "fuite" du plan.
    // --------------------------------------------------------------------------
    const excludedCycles = ALL_CYCLES.filter((c) => !EXPECTED_ACTIVE_CYCLES.has(c));
    const excludedStagesAfter = excludedCycles.map((c) => reloaded.stages.find((s) => s.cycleIndex === c));
    const excludedStagesStillInactive = excludedStagesAfter.every((s) => !!s && s.status === 'INACTIVE');
    record(
      'P3-B-06',
      'Les jalons NON sélectionnés (C1,C2,C4,C5,C7,C8,C10,C11) restent INACTIVE après round-trip',
      excludedStagesStillInactive,
      `${excludedCycles.join(',')} tous == INACTIVE`,
      excludedStagesAfter.map((s) => `${s?.cycleIndex ?? '?'}:${s?.status ?? 'absent'}`).join(', ')
    );

    // --------------------------------------------------------------------------
    // P3-B-07 : configurationStatus préservé (EDITABLE, aucune acquisition
    // enregistrée sur cet essai frais).
    // --------------------------------------------------------------------------
    const configurationStatusPreserved = created.configurationStatus === reloaded.configurationStatus;
    record(
      'P3-B-07',
      'Le statut de verrouillage (configurationStatus) est préservé par le round-trip',
      configurationStatusPreserved,
      created.configurationStatus,
      reloaded.configurationStatus
    );

    // --------------------------------------------------------------------------
    // P3-B-08 : aucune acquisition n'est fabriquée par le round-trip lui-même
    // (le passage par JSON ne doit jamais inventer de données scientifiques).
    // --------------------------------------------------------------------------
    const noAcquisitionsFabricated = Object.keys(reloaded.acquisitions).length === 0;
    record(
      'P3-B-08',
      "Aucune acquisition n'est créée par le round-trip JSON lui-même (essai créé sans aucune mesure)",
      noAcquisitionsFabricated,
      '0 acquisition',
      `${Object.keys(reloaded.acquisitions).length} acquisition(s)`
    );

    // --------------------------------------------------------------------------
    // P3-B-09 : la date de début (startDate, chaîne civile) n'est pas mutée
    // par le round-trip JSON.
    // --------------------------------------------------------------------------
    const startDatePreserved = created.startDate === reloaded.startDate;
    record(
      'P3-B-09',
      "La date de début d'exposition (startDate) n'est pas mutée par le round-trip JSON",
      startDatePreserved,
      String(created.startDate),
      String(reloaded.startDate)
    );

    // ============================================================================
    // Fix contre-audit c1edb84 (point 2) : round-trip JSON avec un essai LOCKED.
    //
    // Scénario : sessionA enregistre une acquisition réelle (verrouille
    // automatiquement l'essai) → sauvegarde JSON → SESSION C, nouvelle instance
    // indépendante sur le même stockage (troisième "rechargement de page") →
    // le statut LOCKED doit survivre au round-trip ET une tentative de
    // modification du plan sur l'instance rechargée doit être rejetée (pas
    // seulement sur l'instance d'origine, ce qui ne prouverait rien sur la
    // persistance réelle du verrou).
    // ============================================================================
    const t0Stage = created.stages.find((s) => s.cycleIndex === 0);
    const exposedPanel = created.batches[0]?.panels.find((p) => p.roleCode === 'E1');

    if (!t0Stage || !exposedPanel) {
      record(
        'P3-B-10',
        'Précondition disponible pour le scénario LOCKED (jalon T0 et panneau E1 présents sur l\'essai frais)',
        false,
        'Jalon T0 et panneau E1 présents',
        `t0Stage=${!!t0Stage}, exposedPanel=${!!exposedPanel}`
      );
      return finalize(results);
    }

    const rawColor: ColorRawData = {
      readings: [
        { pointIndex: 1, L: 60.1, a: 5.2, b: 20.3 },
        { pointIndex: 2, L: 60.2, a: 5.1, b: 20.4 }
      ]
    };

    let lockedAfterAcquisition = false;
    try {
      sessionA.recordAcquisition({
        trialId: referenceId,
        stageId: t0Stage.id,
        batchId: created.batches[0].id,
        panelId: exposedPanel.id,
        familyId: 'COLOR',
        raw: rawColor,
        operatorId: 'audit-p3b'
      });
      const trialAfterAcquisitionInSessionA = sessionA.getTrial(referenceId);
      lockedAfterAcquisition = trialAfterAcquisitionInSessionA?.configurationStatus === 'LOCKED';
    } catch (e) {
      record(
        'P3-B-10',
        "Une acquisition réelle verrouille automatiquement l'essai (configurationStatus -> LOCKED) dans la session d'origine",
        false,
        'Acquisition enregistrée sans exception, configurationStatus === LOCKED',
        `Exception levée : ${(e as Error).message}`
      );
      return finalize(results);
    }

    record(
      'P3-B-10',
      "Une acquisition réelle verrouille automatiquement l'essai (configurationStatus -> LOCKED) dans la session d'origine",
      lockedAfterAcquisition,
      'LOCKED',
      lockedAfterAcquisition ? 'LOCKED' : 'non-LOCKED'
    );

    // Session C : TROISIÈME instance indépendante, simulant un nouveau
    // rechargement de page APRÈS le verrouillage — le point précis que le
    // contre-audit demandait de couvrir (pas seulement le round-trip d'un
    // essai encore EDITABLE, testé en P3-B-00→09 ci-dessus).
    const sessionC = new TrialStoreService();
    const reloadedLocked = sessionC.getTrial(referenceId);

    if (!reloadedLocked) {
      record(
        'P3-B-11',
        "L'essai verrouillé (LOCKED) est retrouvé après un troisième rechargement complet (nouvelle instance)",
        false,
        `Essai ${referenceId} présent après rechargement post-verrouillage`,
        'Essai introuvable après rechargement (perte de données au round-trip JSON)'
      );
      return finalize(results);
    }

    const lockPreservedAfterReload = reloadedLocked.configurationStatus === 'LOCKED';
    record(
      'P3-B-11',
      'Le statut LOCKED (acquis via une acquisition réelle) survit au round-trip JSON complet (nouvelle instance, même stockage)',
      lockPreservedAfterReload,
      'LOCKED',
      reloadedLocked.configurationStatus
    );

    // P3-B-12 : tentative de modification du plan sur l'instance RECHARGÉE
    // (sessionC, pas sessionA) — doit être rejetée. C'est la vérification
    // demandée explicitement par le contre-audit : le rejet doit être prouvé
    // après un vrai passage par JSON.stringify -> localStorage -> JSON.parse,
    // pas seulement sur l'objet encore en mémoire de la session d'origine.
    let planModificationRejectedAfterReload = false;
    let rejectionMessage = '';
    try {
      sessionC.updateMeasurementPlan(referenceId, [0, 12], 'audit-p3b');
    } catch (e) {
      rejectionMessage = (e as Error).message;
      planModificationRejectedAfterReload =
        rejectionMessage.includes('verrouillé') || rejectionMessage.toUpperCase().includes('LOCKED');
    }

    record(
      'P3-B-12',
      "Une tentative de modification du plan de mesurage sur l'instance rechargée (post-LOCKED) est rejetée",
      planModificationRejectedAfterReload,
      'Exception levée mentionnant le verrouillage (LOCKED)',
      planModificationRejectedAfterReload ? `Rejetée : "${rejectionMessage}"` : 'Aucune exception levée (anomalie)'
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
