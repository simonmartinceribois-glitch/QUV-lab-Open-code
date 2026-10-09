/**
 * QUV-Lab — Lots & échantillons (onglet 02) : champs modifiables après
 * création et calcul des différences à tracer dans le journal de bord.
 *
 * Champs : épaisseur sèche du film par lot ; orientation du fil et face
 * d'exposition par éprouvette (le témoin n'a pas de face, une éprouvette
 * exclue n'est plus modifiable). Fonctions pures partagées par l'interface
 * (récapitulatif avant validation) et le store (application + journal).
 */
import type { Trial, BatchDefinition, PanelDefinition, WoodGrainOrientation, ExposureFace } from '../types/trial';

export interface LotsSpecimensForm {
  /** batchId → épaisseur saisie (µm), '' = non renseignée. */
  thickness: Record<string, string>;
  /** panelId → orientation du fil. */
  grain: Record<string, string>;
  /** panelId → face d'exposition (éprouvettes exposées uniquement). */
  face: Record<string, string>;
}

export type LotsSpecimensField = 'dryFilmThicknessMicrons' | 'grainOrientation' | 'exposureFace';

export interface LotsSpecimensChange {
  kind: 'BATCH' | 'PANEL';
  entityId: string;
  batchId: string;
  field: LotsSpecimensField;
  label: string;
  /** Lot ou éprouvette concerné(e), lisible (ex. « LOT A » ou « LOT A-2 »). */
  target: string;
  before: string;
  after: string;
}

export const GRAIN_ORIENTATIONS: WoodGrainOrientation[] = ['Quartier', 'Faux quartier', 'Dosse'];
export const EXPOSURE_FACES: ExposureFace[] = ['Face externe', 'Face interne'];

const LABELS: Record<LotsSpecimensField, string> = {
  dryFilmThicknessMicrons: 'Épaisseur sèche (µm)',
  grainOrientation: 'Orientation du fil',
  exposureFace: "Face d'exposition"
};

export function isWitnessPanel(panel: PanelDefinition, index: number): boolean {
  return index === 0 || panel.label === 'T' || panel.roleCode === 'T';
}

export function specimenCode(batch: BatchDefinition, panel: PanelDefinition, index: number): string {
  const label = isWitnessPanel(panel, index)
    ? 'T'
    : panel.label === 'P02' ? '1' : panel.label === 'P03' ? '2' : panel.label === 'P04' ? '3' : panel.label;
  return `${batch.reference}-${label}`;
}

/** Valeurs affichées quand l'éprouvette n'a pas de valeur enregistrée (affichage historique). */
export function effectiveGrain(panel: PanelDefinition, index: number): string {
  return panel.grainOrientation || (isWitnessPanel(panel, index) ? 'Quartier' : index === 3 ? 'Faux quartier' : 'Quartier');
}

export function effectiveFace(panel: PanelDefinition): string {
  return panel.exposureFace || 'Face externe';
}

export function lotsSpecimensFormFromTrial(trial: Trial): LotsSpecimensForm {
  const form: LotsSpecimensForm = { thickness: {}, grain: {}, face: {} };
  for (const batch of trial.batches) {
    form.thickness[batch.id] = batch.dryFilmThicknessMicrons === undefined || batch.dryFilmThicknessMicrons === null ? '' : String(batch.dryFilmThicknessMicrons);
    batch.panels.forEach((panel, index) => {
      form.grain[panel.id] = effectiveGrain(panel, index);
      if (!isWitnessPanel(panel, index)) form.face[panel.id] = effectiveFace(panel);
    });
  }
  return form;
}

/** Une adhérence mesurée sur le lot fige son épaisseur une fois l'essai verrouillé (fix/batch-thickness). */
export function isBatchThicknessLocked(trial: Trial, batchId: string): boolean {
  if (trial.configurationStatus !== 'LOCKED') return false;
  return Object.values(trial.acquisitions || {}).some(
    (a) => a.batchId === batchId && a.familyId === 'ADHESION' && a.raw !== null && a.raw !== undefined
  );
}

function normalizeThickness(value: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return '';
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? String(n) : trimmed;
}

export function diffLotsSpecimens(trial: Trial, form: LotsSpecimensForm): LotsSpecimensChange[] {
  const current = lotsSpecimensFormFromTrial(trial);
  const changes: LotsSpecimensChange[] = [];
  for (const batch of trial.batches) {
    const before = normalizeThickness(current.thickness[batch.id] ?? '');
    const after = normalizeThickness(form.thickness[batch.id] ?? current.thickness[batch.id] ?? '');
    if (before !== after) {
      changes.push({ kind: 'BATCH', entityId: batch.id, batchId: batch.id, field: 'dryFilmThicknessMicrons', label: LABELS.dryFilmThicknessMicrons, target: batch.reference, before, after });
    }
    batch.panels.forEach((panel, index) => {
      if (panel.status === 'EXCLUDED') return;
      const target = specimenCode(batch, panel, index);
      const grainAfter = form.grain[panel.id] ?? current.grain[panel.id];
      if (grainAfter !== current.grain[panel.id]) {
        changes.push({ kind: 'PANEL', entityId: panel.id, batchId: batch.id, field: 'grainOrientation', label: LABELS.grainOrientation, target, before: current.grain[panel.id], after: grainAfter });
      }
      if (!isWitnessPanel(panel, index)) {
        const faceAfter = form.face[panel.id] ?? current.face[panel.id];
        if (faceAfter !== current.face[panel.id]) {
          changes.push({ kind: 'PANEL', entityId: panel.id, batchId: batch.id, field: 'exposureFace', label: LABELS.exposureFace, target, before: current.face[panel.id], after: faceAfter });
        }
      }
    });
  }
  return changes;
}

/** Erreurs bloquantes sur les différences (valeurs hors liste, épaisseur invalide ou figée). */
export function validateLotsSpecimensChanges(trial: Trial, changes: LotsSpecimensChange[]): string[] {
  const errors: string[] = [];
  for (const c of changes) {
    if (c.field === 'dryFilmThicknessMicrons') {
      if (isBatchThicknessLocked(trial, c.batchId)) {
        errors.push(`${c.target} : épaisseur figée (adhérence déjà mesurée sur ce lot).`);
      } else if (c.after !== '') {
        const n = Number(c.after);
        if (!Number.isFinite(n) || n <= 0 || n > 1000) errors.push(`${c.target} : épaisseur entre 1 et 1000 µm attendue.`);
      }
    } else if (c.field === 'grainOrientation' && !GRAIN_ORIENTATIONS.includes(c.after as WoodGrainOrientation)) {
      errors.push(`${c.target} : orientation du fil non reconnue.`);
    } else if (c.field === 'exposureFace' && !EXPOSURE_FACES.includes(c.after as ExposureFace)) {
      errors.push(`${c.target} : face d'exposition non reconnue.`);
    }
  }
  return errors;
}

export function applyLotsSpecimensChanges(trial: Trial, changes: LotsSpecimensChange[]): void {
  for (const c of changes) {
    const batch = trial.batches.find((b) => b.id === c.batchId);
    if (!batch) continue;
    if (c.field === 'dryFilmThicknessMicrons') {
      batch.dryFilmThicknessMicrons = c.after === '' ? undefined : Number(c.after);
      continue;
    }
    const panel = batch.panels.find((p) => p.id === c.entityId);
    if (!panel) continue;
    if (c.field === 'grainOrientation') panel.grainOrientation = c.after as WoodGrainOrientation;
    else panel.exposureFace = c.after as ExposureFace;
  }
}
