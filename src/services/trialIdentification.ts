/**
 * QUV-Lab — Identification de l'essai (onglet 01) : champs modifiables après
 * création et calcul des différences à tracer dans le journal de bord.
 *
 * Fonctions pures : l'interface s'en sert pour afficher le récapitulatif
 * avant validation, le store pour appliquer et journaliser exactement les
 * mêmes différences.
 */
import type { Trial } from '../types/trial';

export type IdentificationField =
  | 'orderNumber'
  | 'reportNumber'
  | 'title'
  | 'projectOrClient'
  | 'generalNotes'
  | 'lengthMm'
  | 'widthMm'
  | 'thicknessMm'
  | 'unit'
  | 'substrateNature';

/** Valeurs du formulaire : chaînes saisies telles quelles (nombres compris). */
export type IdentificationForm = Record<IdentificationField, string>;

export const IDENTIFICATION_FIELD_LABELS: Record<IdentificationField, string> = {
  orderNumber: 'N° Commande',
  reportNumber: 'N° Rapport',
  title: "Intitulé de l'essai",
  projectOrClient: 'Client',
  generalNotes: 'Notes générales',
  lengthMm: 'Longueur',
  widthMm: 'Largeur',
  thicknessMm: 'Épaisseur',
  unit: 'Unité de mesure',
  substrateNature: 'Nature du support'
};

const NUMERIC_FIELDS: IdentificationField[] = ['lengthMm', 'widthMm', 'thicknessMm'];
const FIELDS = Object.keys(IDENTIFICATION_FIELD_LABELS) as IdentificationField[];

export interface IdentificationChange {
  field: IdentificationField;
  label: string;
  /** Valeur avant / après, sous forme lisible ('' = non renseigné). */
  before: string;
  after: string;
}

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Valeurs actuellement enregistrées dans l'essai, au format du formulaire. */
export function identificationFormFromTrial(trial: Trial): IdentificationForm {
  const dims = trial.commonCharacteristics?.dimensions;
  return {
    orderNumber: text(trial.metadata.orderNumber),
    reportNumber: text(trial.metadata.reportNumber),
    title: text(trial.metadata.title),
    projectOrClient: text(trial.metadata.projectOrClient),
    generalNotes: text(trial.metadata.generalNotes),
    lengthMm: text(dims?.lengthMm),
    widthMm: text(dims?.widthMm),
    thicknessMm: text(dims?.thicknessMm),
    unit: dims?.unit ?? 'mm',
    substrateNature: text(trial.commonCharacteristics?.substrateNature)
  };
}

function normalize(field: IdentificationField, value: string): string {
  const trimmed = value.trim();
  if (NUMERIC_FIELDS.includes(field) && trimmed !== '') {
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) ? String(n) : trimmed;
  }
  return trimmed;
}

/**
 * Erreurs de saisie bloquantes (dimension non numérique ou ≤ 0, unité hors
 * liste). Un champ numérique vidé est refusé : on ne peut pas « effacer »
 * une dimension déjà enregistrée sans la remplacer.
 */
export function validateIdentificationForm(form: IdentificationForm, current: IdentificationForm): string[] {
  const errors: string[] = [];
  for (const field of NUMERIC_FIELDS) {
    const raw = form[field].trim();
    if (raw === '') {
      if (current[field] !== '') errors.push(`${IDENTIFICATION_FIELD_LABELS[field]} : valeur obligatoire.`);
      continue;
    }
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) errors.push(`${IDENTIFICATION_FIELD_LABELS[field]} : nombre strictement positif attendu.`);
  }
  if (form.unit !== 'mm' && form.unit !== 'cm') errors.push('Unité de mesure : mm ou cm attendu.');
  return errors;
}

/** Différences champ par champ entre l'essai et le formulaire (ordre d'affichage). */
export function diffIdentification(trial: Trial, form: IdentificationForm): IdentificationChange[] {
  const current = identificationFormFromTrial(trial);
  const changes: IdentificationChange[] = [];
  for (const field of FIELDS) {
    const before = normalize(field, current[field]);
    const after = normalize(field, form[field]);
    if (before !== after) changes.push({ field, label: IDENTIFICATION_FIELD_LABELS[field], before, after });
  }
  return changes;
}

/** Applique les différences sur l'essai (les autres champs restent intacts). */
export function applyIdentificationChanges(trial: Trial, changes: IdentificationChange[]): void {
  const metadataFields: IdentificationField[] = ['orderNumber', 'reportNumber', 'title', 'projectOrClient', 'generalNotes'];
  for (const change of changes) {
    if (metadataFields.includes(change.field)) {
      (trial.metadata as unknown as Record<string, string>)[change.field] = change.after;
      continue;
    }
    const characteristics = (trial.commonCharacteristics = trial.commonCharacteristics ?? {});
    if (change.field === 'substrateNature') {
      characteristics.substrateNature = change.after;
      continue;
    }
    const dims = (characteristics.dimensions = characteristics.dimensions ?? { unit: 'mm' });
    if (change.field === 'unit') {
      dims.unit = change.after as 'mm' | 'cm';
    } else {
      dims[change.field as 'lengthMm' | 'widthMm' | 'thicknessMm'] = Number(change.after);
    }
  }
}
