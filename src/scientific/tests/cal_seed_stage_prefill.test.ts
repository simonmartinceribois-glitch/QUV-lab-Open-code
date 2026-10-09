/**
 * QUV-Lab — G52-CAL / Étape 06 — INVARIANTS DE CRÉATION : AUCUNE ACQUISITION FICTIVE
 *
 * Correctif : à la création d'un essai réel, generateStandardExposureStages()
 * produit UNIQUEMENT le calendrier/protocole. Aucune fabrication de mesure RAW-like :
 * - jalons planifiés = NOT_STARTED (T0 et C12 compris, sans exception artificielle)
 * - jalons hors plan = INACTIVE
 * - measuredAt / validatedBy / validatedAt / notes restent undefined
 * - trial.acquisitions = {} quel que soit le plan choisi à l'Étape 06
 * - aucun jalon VALIDATED / IN_PROGRESS sans acquisition correspondante
 */

import { globalTrialStore } from '../../services/trialStore';
import type { MeasurementFamilyId } from '../../types/scientific';
import type { Trial, TrialMetadata } from '../../types/trial';

export interface CalSeedTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runCalSeedStagePrefillTests(): {
  results: CalSeedTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: CalSeedTestResult[] = [];
  const record = (
    id: string,
    name: string,
    passed: boolean,
    expected: string,
    actual: string,
    details?: string
  ) => {
    results.push({ id, name, passed, expected, actual, details });
  };

  const baseBatches = [
    {
      reference: 'LOT-CAL-SEED',
      coatingSystem: 'Peinture microporeuse',
      woodSpecies: 'Pin sylvestre',
      panelCount: 3,
      applicationDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      dryFilmThicknessMicrons: 65
    }
  ];

  const familySet: MeasurementFamilyId[] = ['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION', 'OBSERVATIONS'];

  const createSeedTrial = (
    reference: string,
    selectedMeasurementCycles?: number[]
  ): Trial => {
    const meta: TrialMetadata = {
      reference,
      title: 'Essai CAL-SEED',
      projectOrClient: 'Labo R&D',
      createdBy: 'Implémenteur',
      generalNotes: 'Invariants de création sans acquisition fictive'
    };
    return globalTrialStore.createTrial({
      metadata: meta,
      batches: baseBatches,
      activeFamilies: familySet,
      selectedMeasurementCycles
    });
  };

  // --------------------------------------------------------------------------
  // CAL-SEED-01 : les jalons planifiés ne possèdent aucune acquisition fictive
  // --------------------------------------------------------------------------
  {
    // Plan Standard Complet (13 jalons — défaut de l'Étape 06)
    const full = createSeedTrial('CAL-SEED-01-FULL');
    // Plan Jalons Clés / 3 semaines (T0, C3, C6, C9, C12)
    const key = createSeedTrial('CAL-SEED-01-KEY', [0, 3, 6, 9, 12]);

    const plannedAreClean = (trial: Trial): boolean => {
      const planned = trial.stages.filter((s) => s.status !== 'INACTIVE');
      return planned.length > 0 && planned.every(
        (s) =>
          s.status === 'NOT_STARTED' &&
          s.measuredAt === undefined &&
          s.validatedBy === undefined &&
          s.validatedAt === undefined &&
          s.notes === undefined
      );
    };

    const inactiveAreClean = (trial: Trial): boolean => {
      const inactive = trial.stages.filter((s) => s.status === 'INACTIVE');
      return inactive.every(
        (s) =>
          s.measuredAt === undefined &&
          s.validatedBy === undefined &&
          s.validatedAt === undefined &&
          s.notes === undefined
      );
    };

    const t0Full = full.stages.find((s) => s.cycleIndex === 0)!;
    const t0Key = key.stages.find((s) => s.cycleIndex === 0)!;
    const c1Key = key.stages.find((s) => s.cycleIndex === 1)!;

    const ok =
      plannedAreClean(full) &&
      plannedAreClean(key) &&
      inactiveAreClean(key) === true &&
      // T0 reste un jalon planifié : NOT_STARTED, sans exception artificielle de mesure
      t0Full.status === 'NOT_STARTED' &&
      t0Key.status === 'NOT_STARTED' &&
      t0Full.measuredAt === undefined &&
      t0Key.measuredAt === undefined &&
      c1Key.status === 'INACTIVE' &&
      c1Key.measuredAt === undefined;

    record(
      'CAL-SEED-01',
      'Jalons planifiés NOT_STARTED sans acquisition fictive (measuredAt/validatedBy/validatedAt/notes undefined)',
      ok,
      'planifiés NOT_STARTED + métadonnées undefined, T0 sans exception, hors-plan INACTIVE',
      `t0Full=${t0Full.status}, c1Key=${c1Key.status} (INACTIVE), acquisitions=${Object.keys(full.acquisitions).length}`
    );
  }

  // --------------------------------------------------------------------------
  // CAL-SEED-02 : trial.acquisitions === {} quel que soit le plan de mesurage
  // --------------------------------------------------------------------------
  {
    const full = createSeedTrial('CAL-SEED-02-FULL'); // Standard Complet
    const quarterly = createSeedTrial('CAL-SEED-02-QUARTERLY', [0, 3, 6, 9, 12]); // Jalons Clés
    const light = createSeedTrial('CAL-SEED-02-LIGHT', [0, 6, 12]); // Protocole Allégé

    const counts = [
      Object.keys(full.acquisitions).length,
      Object.keys(quarterly.acquisitions).length,
      Object.keys(light.acquisitions).length
    ];

    const ok = counts.every((c) => c === 0);

    record(
      'CAL-SEED-02',
      'trial.acquisitions vide ({}) immédiatement après createTrial pour les 3 plans de l\'Étape 06',
      ok,
      '0 acquisition pour Standard Complet, Jalons Clés, Protocole Allégé',
      `complet=${counts[0]}, clés=${counts[1]}, allégé=${counts[2]}`
    );
  }

  // --------------------------------------------------------------------------
  // CAL-SEED-03 : aucun jalon VALIDATED / IN_PROGRESS sans acquisition correspondante
  // --------------------------------------------------------------------------
  {
    const trial = createSeedTrial('CAL-SEED-03');

    // À la création : aucun jalon ne peut être VALIDATED/IN_PROGRESS puisque acquisitions = {}
    const doiVerdictsAtCreation = trial.stages.filter(
      (s) => s.status === 'VALIDATED' || s.status === 'IN_PROGRESS'
    );
    const cleanAtCreation = doiVerdictsAtCreation.length === 0;

    // Chemin métier réel : une acquisition sur T0 + une validation rendent le jalon VALIDATED
    // (la relation jalon ⇄ acquisition est alors cohérente, contrairement à la création).
    const panelT = trial.batches[0].panels[0];
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const rawColorMemo = {
      readings: [
        { pointIndex: 1, L: 60.1, a: 5.2, b: 20.3 },
        { pointIndex: 2, L: 60.2, a: 5.1, b: 20.4 }
      ]
    };

    globalTrialStore.recordAcquisition({
      trialId: trial.id,
      stageId: stageT0.id,
      batchId: trial.batches[0].id,
      panelId: panelT.id,
      familyId: 'COLOR',
      raw: rawColorMemo,
      operatorId: 'Implémenteur'
    });
    const afterAcq = globalTrialStore.getTrial(trial.id)!;
    globalTrialStore.validateStage(afterAcq.id, stageT0.id, 'Implémenteur');
    const afterValidation = globalTrialStore.getTrial(trial.id)!;
    const t0After = afterValidation.stages.find((s) => s.cycleIndex === 0)!;
    const hasT0Acquisition = Object.values(afterValidation.acquisitions).some(
      (a) => a.stageId === t0After.id
    );

    const realPathConsistent =
      t0After.status === 'VALIDATED' &&
      t0After.validatedBy === 'Implémenteur' &&
      t0After.validatedAt !== undefined &&
      hasT0Acquisition === true;

    record(
      'CAL-SEED-03',
      'Aucun jalon VALIDATED/IN_PROGRESS à la création ; le statut ne devient VALIDATED que par opération métier réelle avec acquisition présente',
      cleanAtCreation && realPathConsistent,
      '0 verdict à la création ; T0 VALIDATED seulement après recordAcquisition + validateStage (acquisition présente)',
      `verdictsCreation=${doiVerdictsAtCreation.length}, t0After=${t0After.status}, hasAcq=${hasT0Acquisition}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}