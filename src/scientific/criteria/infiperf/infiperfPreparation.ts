/**
 * Préparation INFIPERF / FCBA — couche PREPARATION (mapping strict, aucun calcul).
 *
 * Extrait les données des éprouvettes exposées E1/E2/E3 d'un jalon donné pour
 * les indicateurs INFIPERF :
 *  - retentions de brillance (retentionRatePercent) ;
 *  - dureté Persoz (meanDampingTime) ;
 *  - évolutions colorimétriques (deltaL/deltaA/deltaB/deltaE) ;
 *  - cotation d'aspect général (perCategoryMaxRating.GENERAL_APPEARANCE).
 *
 * Le témoin T est exclu. Aucune moyenne ni arrondi ici : tout traitement
 * numérique appartient à infiperfCalculations.ts.
 */

import type { Trial } from '../../../types/trial';
import { getActiveE1E2E3PanelsOfBatch } from '../../panelUtils';

/** Portée système (lot) transmise aux préparations INFIPERF. */
export interface InfiperfPreparationOptions {
  /** Lot ciblé ; sans lui, seuls les essais mono-lot sont exploités (aucun mélange inter-systèmes). */
  batchId?: string;
}

export interface InfiperfSpecimenRetention {
  panelId: string;
  panelLabel: string;
  /** Rétention de brillance (%) de l'éprouvette, telle que produite par COMPUTED. */
  retentionRatePercent: number | null;
}

export interface InfiperfPreparedRetentionData {
  stageId: string | null;
  specimens: InfiperfSpecimenRetention[];
  /** Éprouvettes exposées REQUISES mais sans mesure exploitable. */
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

/** Tatouage d'une acquisition de brillance : `${stage}__${panel}__GLOSS`. */
export function glossAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__GLOSS`;
}

/** Tatouage d'une acquisition Persoz : `${stage}__${panel}__PERSOZ`. */
export function persozAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__PERSOZ`;
}

/** Tatouage d'une acquisition couleur : `${stage}__${panel}__COLOR`. */
export function colorAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__COLOR`;
}

/** Tatouage d'une acquisition d'observations visuelles : `${stage}__${panel}__OBSERVATIONS`. */
export function observationsAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__OBSERVATIONS`;
}

function readRetention(trial: Trial, stageId: string, panelId: string): number | null {
  const acquisition = trial.acquisitions[glossAcquisitionKey(stageId, panelId)];
  const computed = acquisition?.computed as { retentionRatePercent?: unknown } | undefined;
  const retention = computed?.retentionRatePercent;
  return typeof retention === 'number' && Number.isFinite(retention) ? retention : null;
}

/**
 * Prépare les rétentions de brillance d'un jalon pour les éprouvettes E1/E2/E3
 * du système ciblé (lot). Mapping pur : aucune agrégation n'est réalisée ici.
 */
export function prepareInfiperfRetentionData(
  trial: Trial,
  stageId: string,
  options?: InfiperfPreparationOptions
): InfiperfPreparedRetentionData {
  const specimens: InfiperfSpecimenRetention[] = [];
  const missingSpecimens: InfiperfPreparedRetentionData['missingSpecimens'] = [];

  for (const panel of getActiveE1E2E3PanelsOfBatch(trial.batches, options?.batchId)) {
    const retention = readRetention(trial, stageId, panel.id);
    if (retention !== null) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, retentionRatePercent: retention });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    stageId,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}

// --- PERSOZ ---

export interface InfiperfSpecimenPersoz {
  panelId: string;
  panelLabel: string;
  /** Temps d'amortissement moyen Persoz (s) de l'éprouvette, tel que produit par COMPUTED. */
  meanDampingTime: number;
}

export interface InfiperfPreparedPersozData {
  stageId: string | null;
  specimens: InfiperfSpecimenPersoz[];
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

function readPersoz(trial: Trial, stageId: string, panelId: string): number | null {
  const acquisition = trial.acquisitions[persozAcquisitionKey(stageId, panelId)];
  const computed = acquisition?.computed as { meanDampingTime?: unknown } | undefined;
  const value = computed?.meanDampingTime;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function prepareInfiperfPersozData(
  trial: Trial,
  stageId: string,
  options?: InfiperfPreparationOptions
): InfiperfPreparedPersozData {
  const specimens: InfiperfSpecimenPersoz[] = [];
  const missingSpecimens: InfiperfPreparedPersozData['missingSpecimens'] = [];

  for (const panel of getActiveE1E2E3PanelsOfBatch(trial.batches, options?.batchId)) {
    const value = readPersoz(trial, stageId, panel.id);
    if (value !== null) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, meanDampingTime: value });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    stageId,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}

// --- COULEUR ---

export interface InfiperfSpecimenColor {
  panelId: string;
  panelLabel: string;
  deltaL: number | null;
  deltaA: number | null;
  deltaB: number | null;
  deltaE: number | null;
}

export interface InfiperfPreparedColorData {
  stageId: string | null;
  specimens: InfiperfSpecimenColor[];
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

function readColor(trial: Trial, stageId: string, panelId: string): Pick<InfiperfSpecimenColor, 'deltaL' | 'deltaA' | 'deltaB' | 'deltaE'> | null {
  const acquisition = trial.acquisitions[colorAcquisitionKey(stageId, panelId)];
  const computed = acquisition?.computed as
    | { deltaL?: unknown; deltaA?: unknown; deltaB?: unknown; deltaE?: unknown }
    | undefined;
  if (!computed) return null;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  return {
    deltaL: finite(computed.deltaL) ? computed.deltaL : null,
    deltaA: finite(computed.deltaA) ? computed.deltaA : null,
    deltaB: finite(computed.deltaB) ? computed.deltaB : null,
    deltaE: finite(computed.deltaE) ? computed.deltaE : null
  };
}

export function prepareInfiperfColorData(
  trial: Trial,
  stageId: string,
  options?: InfiperfPreparationOptions
): InfiperfPreparedColorData {
  const specimens: InfiperfSpecimenColor[] = [];
  const missingSpecimens: InfiperfPreparedColorData['missingSpecimens'] = [];

  for (const panel of getActiveE1E2E3PanelsOfBatch(trial.batches, options?.batchId)) {
    const read = readColor(trial, stageId, panel.id);
    if (read) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, ...read });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    stageId,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}

// --- ASPECT GÉNÉRAL ---

export interface InfiperfSpecimenAspect {
  panelId: string;
  panelLabel: string;
  /** Cotation d'aspect général (0..5) de l'éprouvette, telle que produite par COMPUTED. */
  generalAppearanceRating: number;
}

export interface InfiperfPreparedAspectData {
  stageId: string | null;
  specimens: InfiperfSpecimenAspect[];
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

function readGeneralAppearance(trial: Trial, stageId: string, panelId: string): number | null {
  const acquisition = trial.acquisitions[observationsAcquisitionKey(stageId, panelId)];
  const perCategory = (acquisition?.computed as { perCategoryMaxRating?: Record<string, number> | undefined } | undefined)
    ?.perCategoryMaxRating;
  if (!acquisition || !perCategory) return null;
  const rating = perCategory.GENERAL_APPEARANCE;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  return rating;
}

export function prepareInfiperfAspectData(
  trial: Trial,
  stageId: string,
  options?: InfiperfPreparationOptions
): InfiperfPreparedAspectData {
  const specimens: InfiperfSpecimenAspect[] = [];
  const missingSpecimens: InfiperfPreparedAspectData['missingSpecimens'] = [];

  for (const panel of getActiveE1E2E3PanelsOfBatch(trial.batches, options?.batchId)) {
    const value = readGeneralAppearance(trial, stageId, panel.id);
    if (value !== null) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, generalAppearanceRating: value });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    stageId,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}