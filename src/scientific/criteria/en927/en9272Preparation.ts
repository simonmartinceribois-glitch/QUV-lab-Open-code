/**
 * Préparation NF EN 927-2:2014 (référentiel historique/transitoire —
 * HISTORICAL_TRANSITIONAL) — couche PREPARATION (mapping strict, AUCUN calcul métier).
 *
 * Cette couche extrait et met en forme les données d'un essai vers des données
 * PRÉPARÉES pour l'évaluation au jalon C12. Elle ne calcule aucune moyenne, aucun
 * arrondi, aucune somme : tout traitement numérique appartient à
 * en9272Calculations.ts.
 *
 * Jalons acceptés : C12 unique = cycle 12 à 2016 h (12 × 168 h). T0, C1..C11 et
 * toute interpolation/extrapolation sont exclus. Éprouvettes exposées : E1/E2/E3
 * uniquement (témoin T exclu).
 *
 * Cotation de l'ADHÉRENCE (classement séquentiel 2014) : le pipeline QUV-Lab est
 * exclusivement qualitatif (classes ISO 2409 0..5). Le classement 2014 évalue
 * l'adhérence par la cotation maximale des observations visuelles, lue depuis
 * `perCategoryMaxRating` sous la clé `CROSS_CUT_ADHESION` (repli `ADHESION`),
 * sur l'échelle 0..5, comparée au seuil par opérateur ≤. Le blocage "force en
 * MPa / 2 mesures par éprouvette" appartient à l'évolution de migration vers la
 * NF EN 927-2:2022 (traçabilité documentaire conservée dans
 * en9272Requirements.ts, jamais utilisée pour le calcul 2014). Aucune
 * conversion de classe vers une force en MPa n'est jamais réalisée.
 */

import type { Trial, ExposureStage, BatchDefinition, PanelDefinition } from '../../../types/trial';
import {
  getActiveE1E2E3PanelsOfBatch,
  getActiveStages,
  formatBatchSystem
} from '../../panelUtils';
import { NF9272_REQUIRED_CYCLE_INDEX, NF9272_REQUIRED_EXPOSURE_HOURS } from './en9272Requirements';

export type Nf9272DefectCategory = 'BLISTERING' | 'CRACKING' | 'FLAKING';

/** Valeur de cotation (0..5) d'une éprouvette pour une catégorie de défaut. */
export interface Nf9272SpecimenValue {
  panelId: string;
  panelLabel: string;
  /** Cotation maximale de la catégorie sur l'éprouvette (perCategoryMaxRating, 0..5). */
  value: number;
}

export interface Nf9272PreparedDefectData {
  category: Nf9272DefectCategory;
  stageId: string | null;
  /** Lot (système de finition) ciblé par l'évaluation. `null` si non résolu. */
  batchId: string | null;
  /** Libellé système ciblé, ex. 'LOT A — Lasure'. */
  batchLabel: string | null;
  /** Valeurs par éprouvette exposée E1/E2/E3 du lot ciblé. */
  specimens: Nf9272SpecimenValue[];
  /** Éprouvettes exposées REQUISES mais sans donnée exploitable (acquisition absente, cotation invalide). */
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

export interface Nf9272PreparedAdhesionData {
  category: 'ADHESION';
  stageId: string | null;
  /** Lot (système de finition) ciblé par l'évaluation. `null` si non résolu. */
  batchId: string | null;
  /** Libellé système ciblé, ex. 'LOT A — Lasure'. */
  batchLabel: string | null;
  /**
   * Cotation par éprouvette exposée E1/E2/E3 du lot ciblé, lue depuis les
   * observations visuelles (`perCategoryMaxRating` sous la clé
   * `CROSS_CUT_ADHESION`, repli `ADHESION`), échelle 0..5.
   */
  specimens: Nf9272SpecimenValue[];
  /** Éprouvettes exposées REQUISES mais sans cotation exploitable (acquisition absente, cotation invalide). */
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
  /** Source de la valeur : cotation ISO 2409 issue des observations visuelles (aucune force MPa). */
  source: 'OBSERVATIONS_RATING';
}

export type Nf9272PreparedData = Nf9272PreparedDefectData | Nf9272PreparedAdhesionData;

/**
 * Retourne le jalon C12 du référentiel (cycle 12, 2016 h, statut exploitable),
 * ou `null`.
 *
 * Conditions CUMULATIVES (verrou P2 de l'audit 4) :
 *  - cycleIndex === 12 ET scheduledExposureHours === 2016 (identité, pas un
 *    simple repère cyclique) ;
 *  - statut du jalon EXPLOITABLE selon le modèle `StageStatus` du projet :
 *    `status !== 'INACTIVE'` (règle officielle `getActiveStages`). Un jalon
 *    désactivé (INACTIVE) ne peut JAMAIS produire d'évaluation scientifique,
 *    même s'il porte les bonnes valeurs cycle/durée.
 *
 * Cas renvoyant `null` (→ INSUFFICIENT_DATA à l'évaluation) :
 *  - C12 absent de l'essai ;
 *  - C12 présent mais INACTIVE ;
 *  - cycle 12 avec une durée ≠ 2016 h, ou cycle ≠ 12 avec 2016 h.
 *
 * Aucune autre étape n'est acceptée ; aucun calcul de durée.
 */
export function findNf9272Jalon(trial: Trial): ExposureStage | null {
  const activeStages = getActiveStages(trial.stages);
  const stage = activeStages.find(
    (s) =>
      s.cycleIndex === NF9272_REQUIRED_CYCLE_INDEX &&
      s.scheduledExposureHours === NF9272_REQUIRED_EXPOSURE_HOURS
  );
  return stage ?? null;
}

/**
 * Éprouvettes exposées E1/E2/E3 actives du SYSTÈME CIBLÉ (lot).
 *
 * Règle d'agrégation (testée) : N'importe quel mélange entre systèmes A/B dans
 * une même moyenne est proscrit. `batchId` cible UN lot ; sans `batchId`, seul
 * un essai à UN SEUL lot est exploitable (retour des E1/E2/E3 de ce lot).
 * Un essai multi-lots sans sélection doit être REJETÉ par l'évaluateur
 * (resolveBatchScope → MULTIPLE_BATCHES_NO_SELECTION) avant tout calcul.
 */
export function collectExposedE1E2E3Panels(
  batches: BatchDefinition[],
  batchId?: string
): PanelDefinition[] {
  return getActiveE1E2E3PanelsOfBatch(batches, batchId);
}

/** Tatouage d'une acquisition d'observations visuelles : `${stage}__${panel}__OBSERVATIONS`. */
export function observationsAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__OBSERVATIONS`;
}

function readCategoryRating(panel: PanelDefinition, stageId: string, trial: Trial, category: Nf9272DefectCategory): { value: number } | null {
  const acquisition = trial.acquisitions[observationsAcquisitionKey(stageId, panel.id)];
  const perCategory = (acquisition?.computed as { perCategoryMaxRating?: Record<string, number> | undefined } | undefined)
    ?.perCategoryMaxRating;
  if (!acquisition || !perCategory) return null;
  const rating = perCategory[category];
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  return { value: rating };
}

/**
 * Clés d'observations reconnues pour la cotation de l'ADHÉRENCE (échelle 0..5) :
 * `CROSS_CUT_ADHESION` puis repli `ADHESION`.
 */
export const NF9272_ADHESION_OBSERVATION_CATEGORIES = ['CROSS_CUT_ADHESION', 'ADHESION'] as const;

function readAdhesionRating(panel: PanelDefinition, stageId: string, trial: Trial): { value: number } | null {
  const acquisition = trial.acquisitions[observationsAcquisitionKey(stageId, panel.id)];
  const perCategory = (acquisition?.computed as { perCategoryMaxRating?: Record<string, number> | undefined } | undefined)
    ?.perCategoryMaxRating;
  if (!acquisition || !perCategory) return null;
  const rating = perCategory[NF9272_ADHESION_OBSERVATION_CATEGORIES[0]] ?? perCategory[NF9272_ADHESION_OBSERVATION_CATEGORIES[1]];
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  return { value: rating };
}

function findTargetBatch(trial: Trial, options?: { batchId?: string }): BatchDefinition | null {
  if (options?.batchId) {
    return trial.batches.find((b) => b.id === options.batchId) ?? null;
  }
  return trial.batches.length === 1 ? trial.batches[0] : null;
}

/**
 * Prépare les cotations de défauts (Blistering/Cracking/Flaking) d'UNE catégorie
 * au jalon C12, pour le SYSTÈME CIBLÉ (lot). Mapping pur : recopie des valeurs
 * par éprouvette E1/E2/E3 du lot ; aucune agrégation. Un lot multi-système non
 * sélectionné DOIT être rejeté en amont par le résolveur de lot.
 */
export function prepareNf9272DefectData(
  trial: Trial,
  stage: ExposureStage,
  category: Nf9272DefectCategory,
  options?: { batchId?: string }
): Nf9272PreparedDefectData {
  const specimens: Nf9272SpecimenValue[] = [];
  const missingSpecimens: Nf9272PreparedDefectData['missingSpecimens'] = [];

  const batch = findTargetBatch(trial, options);

  for (const panel of collectExposedE1E2E3Panels(trial.batches, batch?.id)) {
    const read = readCategoryRating(panel, stage.id, trial, category);
    if (read) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, value: read.value });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    category,
    stageId: stage.id,
    batchId: batch?.id ?? null,
    batchLabel: batch ? formatBatchSystem(batch) : null,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}

/**
 * Préparation de la cotation de l'ADHÉRENCE (classement séquentiel 2014) au
 * jalon C12, pour le SYSTÈME CIBLÉ (lot).
 *
 * Source : cotation maximale des OBSERVATIONS VISUELLES ISO 2409 (0..5), lue
 * depuis `perCategoryMaxRating` sous la clé `CROSS_CUT_ADHESION` (repli
 * `ADHESION`), éprouvette par éprouvette E1/E2/E3 du lot ciblé. Aucune force
 * en MPa, aucune conversion, aucun wrapper : mapping pur.
 *
 * Le cas documentaire NF EN 927-2:2022 (2 mesures individuelles de force)
 * n'est PAS traité par ce référentiel de calcul : il relève de l'évolution de
 * migration dédiée (NBG-3).
 */
export function prepareNf9272AdhesionData(
  trial: Trial,
  stage: ExposureStage,
  options?: { batchId?: string }
): Nf9272PreparedAdhesionData {
  const specimens: Nf9272SpecimenValue[] = [];
  const missingSpecimens: Nf9272PreparedAdhesionData['missingSpecimens'] = [];

  const batch = findTargetBatch(trial, options);

  for (const panel of collectExposedE1E2E3Panels(trial.batches, batch?.id)) {
    const read = readAdhesionRating(panel, stage.id, trial);
    if (read) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, value: read.value });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    category: 'ADHESION',
    stageId: stage.id,
    batchId: batch?.id ?? null,
    batchLabel: batch ? formatBatchSystem(batch) : null,
    specimens,
    missingSpecimens,
    available: specimens.length > 0,
    source: 'OBSERVATIONS_RATING'
  };
}

/**
 * Point d'entrée PREPARATION : choisi la préparation adaptée à un critère.
 * Ne contient, par construction, aucun calcul métier.
 * `options.batchId` cible un système (lot) unique ; voir `resolveBatchScope`.
 */
export function prepareNf9272CriterionData(
  trial: Trial,
  stage: ExposureStage,
  criterion: Nf9272DefectCategory | 'ADHESION',
  options?: { batchId?: string }
): Nf9272PreparedData {
  if (criterion === 'ADHESION') return prepareNf9272AdhesionData(trial, stage, options);
  return prepareNf9272DefectData(trial, stage, criterion, options);
}