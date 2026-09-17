/**
 * Préparation NF EN 927-2:2022 — couche PREPARATION (mapping strict, AUCUN calcul métier).
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
 * Sécurité données adhérence : le pipeline QUV-Lab est exclusivement qualitatif
 * (classes ISO 2409 0..5). Les 2 mesures INDIVIDUELLES de force d'adhérence
 * exigées par le référentiel NF EN 927-2 n'existent pas ; la préparation le
 * signale explicitement. Aucune conversion de classe vers une force en MPa n'est
 * jamais réalisée.
 */

import type { Trial, ExposureStage, BatchDefinition, PanelDefinition } from '../../../types/trial';
import { getActiveE1E2E3Panels } from '../../panelUtils';
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
  /** Valeurs par éprouvette exposée E1/E2/E3. */
  specimens: Nf9272SpecimenValue[];
  /** Éprouvettes exposées REQUISES mais sans donnée exploitable (acquisition absente, cotation invalide). */
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

export interface Nf9272PreparedAdhesionData {
  category: 'ADHESION';
  stageId: string | null;
  /**
   * `true` uniquement si des mesures individuelles de FORCE d'adhérence
   * (numériques, 2 par éprouvette) sont disponibles au jalon C12.
   * Faux aujourd'hui : le pipeline ne fournit que des classes ISO 2409 (0..5).
   */
  available: false;
  reason: 'FORCE_MEASURES_ABSENT';
}

export type Nf9272PreparedData = Nf9272PreparedDefectData | Nf9272PreparedAdhesionData;

/**
 * Retourne le jalon C12 du référentiel (cycle 12, 2016 h), ou `null`.
 * Aucune autre étape n'est acceptée ; aucun calcul de durée.
 */
export function findNf9272Jalon(trial: Trial): ExposureStage | null {
  const stage = trial.stages.find(
    (s) =>
      s.cycleIndex === NF9272_REQUIRED_CYCLE_INDEX &&
      s.scheduledExposureHours === NF9272_REQUIRED_EXPOSURE_HOURS
  );
  return stage ?? null;
}

/** Éprouvettes exposées E1/E2/E3 actives de toutes les séries de l'essai. */
export function collectExposedE1E2E3Panels(batches: BatchDefinition[]): PanelDefinition[] {
  return batches.flatMap((batch) => getActiveE1E2E3Panels(batch.panels));
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
 * Prépare les cotations de défauts (Blistering/Cracking/Flaking) d'UNE catégorie
 * au jalon C12. Mapping pur : recopie des valeurs par éprouvette E1/E2/E3 ;
 * aucune agrégation.
 */
export function prepareNf9272DefectData(
  trial: Trial,
  stage: ExposureStage,
  category: Nf9272DefectCategory
): Nf9272PreparedDefectData {
  const specimens: Nf9272SpecimenValue[] = [];
  const missingSpecimens: Nf9272PreparedDefectData['missingSpecimens'] = [];

  for (const panel of collectExposedE1E2E3Panels(trial.batches)) {
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
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}

/**
 * Préparation de l'ADHÉRENCE au jalon C12.
 *
 * BLOCAGE CONNU (Cas B de l'addendum) : le référentiel NF EN 927-2:2022 exige des
 * valeurs de FORCE d'adhérence individuelle (2 mesures/éprouvette). Le pipeline
 * QUV-Lab ne produit que des classes ISO 2409 (0..5) — jamais de mesure de force.
 * Aucune conversion de classe vers une force en MPa n'est réalisée (cf.
 * reportGenerator et BenchComputedPanel). La préparation signale le blocage ;
 * l'évaluateur produira INSUFFICIENT_DATA documenté.
 */
export function prepareNf9272AdhesionData(trial: Trial, stage: ExposureStage): Nf9272PreparedAdhesionData {
  return {
    category: 'ADHESION',
    stageId: stage.id,
    available: false,
    reason: 'FORCE_MEASURES_ABSENT'
  };
}

/**
 * Point d'entrée PREPARATION : choisi la préparation adaptée à un critère.
 * Ne contient, par construction, aucun calcul métier.
 */
export function prepareNf9272CriterionData(
  trial: Trial,
  stage: ExposureStage,
  criterion: Nf9272DefectCategory | 'ADHESION'
): Nf9272PreparedData {
  if (criterion === 'ADHESION') return prepareNf9272AdhesionData(trial, stage);
  return prepareNf9272DefectData(trial, stage, criterion);
}