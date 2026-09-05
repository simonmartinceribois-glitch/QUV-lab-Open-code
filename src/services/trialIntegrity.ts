/**
 * QUV-Lab — Gardes d'integrite relationnelle (Gate 3.1)
 * Issu du decoupage de trialStore.ts (refactor/split-trialstore). Code deplace a l'identique.
 */
import { Trial } from '../types/trial';
import { UUID } from '../types/scientific';

/**
 * Familles de mesure canoniques (P2 robustesse imports) : toute autre valeur
 * est rejetée avant pipeline (jamais stockée comme acquisition EMPTY silencieuse).
 */
const KNOWN_MEASUREMENT_FAMILIES: readonly string[] = [
  'COLOR',
  'GLOSS',
  'PERSOZ',
  'ADHESION',
  'OBSERVATIONS'
];

/**
 * Valide la famille d'une acquisition entrante (import/saisie/API).
 * Rejette explicitement toute famille inconnue avant tout effet de bord.
 */
export function validateAcquisitionFamily(familyId: unknown): void {
  if (typeof familyId !== 'string' || !KNOWN_MEASUREMENT_FAMILIES.includes(familyId)) {
    throw new IntegrityViolationError(
      `Famille de mesure inconnue : ${JSON.stringify(familyId)}. Familles attendues : ${KNOWN_MEASUREMENT_FAMILIES.join(', ')}.`,
      { familyId: typeof familyId === 'string' ? familyId : 'NON_STRING' }
    );
  }
}

/**
 * Valide la structure minimale d'un RAW entrant (import/saisie/API).
 * Le RAW doit être un objet non nul (jamais null, primitif ni tableau) :
 * les moteurs aval classent ensuite chaque mesure (VALID/MISSING/INVALID)
 * sans jamais fabriquer de valeur. Rejet explicite avant tout effet de bord.
 */
export function validateAcquisitionRaw(raw: unknown): void {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IntegrityViolationError(
      `Donnée brute (RAW) mal formée : objet de mesures attendu, reçu ${Array.isArray(raw) ? 'tableau' : typeof raw}. Aucune valeur par défaut fabriquée.`,
      { rawType: Array.isArray(raw) ? 'array' : typeof raw }
    );
  }
}

/**
 * Vérifie la structure minimale d'un essai chargé (localStorage/import) :
 * garde-fou structurel strict (jamais d'exception, jamais de fabrication).
 *
 * Refuse : null/primitif/tableau, id absent/non-string/vide, stages ou batches
 * absents/non-array, acquisitions absente/non-objet/tableau, config
 * absente/non-objet/tableau, stage sans id/cycleIndex valide, batch sans
 * id/panels valides, panel sans id (ni batchId/index/label/status requis du
 * modèle), acquisition sans clés métier (id, trialId, stageId, batchId,
 * panelId, familyId, raw présent, status, alerts, trace).
 * Aucune validation scientifique ici (NF EN 927-6, populations, calendrier :
 * couches métier existantes).
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidStageElement(stage: unknown): boolean {
  if (!isPlainRecord(stage)) return false;
  if (!isNonEmptyString(stage['id'])) return false;
  const cycleIndex = stage['cycleIndex'];
  if (typeof cycleIndex !== 'number' || !Number.isFinite(cycleIndex)) return false;
  return true;
}

function isValidPanelElement(panel: unknown): boolean {
  if (!isPlainRecord(panel)) return false;
  if (!isNonEmptyString(panel['id'])) return false;
  if (!isNonEmptyString(panel['batchId'])) return false;
  if (typeof panel['index'] !== 'number' || !Number.isFinite(panel['index'])) return false;
  if (typeof panel['label'] !== 'string') return false;
  if (typeof panel['status'] !== 'string') return false;
  return true;
}

function isValidBatchElement(batch: unknown): boolean {
  if (!isPlainRecord(batch)) return false;
  if (!isNonEmptyString(batch['id'])) return false;
  if (!Array.isArray(batch['panels'])) return false;
  return (batch['panels'] as unknown[]).every(isValidPanelElement);
}

function isValidAcquisitionEntry(entry: unknown): boolean {
  if (!isPlainRecord(entry)) return false;
  const requiredIds = ['id', 'trialId', 'stageId', 'batchId', 'panelId'];
  for (const key of requiredIds) {
    if (!isNonEmptyString(entry[key])) return false;
  }
  // familyId : chaîne non vide ET famille canonique (jamais UNKNOWN/vide/numérique).
  // Structurel uniquement : les règles scientifiques des familles restent aux moteurs.
  if (typeof entry['familyId'] !== 'string' || !KNOWN_MEASUREMENT_FAMILIES.includes(entry['familyId'])) return false;
  // RAW : même règle structurelle qu'à l'import — objet non-null non-tableau.
  // `{}` reste accepté (mesure MISSING = moteurs) ; null/primitif/tableau refusés.
  // Jamais de 0 fabriqué, jamais de normalisation silencieuse.
  const raw = entry['raw'];
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (typeof entry['status'] !== 'string') return false;
  if (!Array.isArray(entry['alerts'])) return false;
  if (!isPlainRecord(entry['trace'])) return false;
  return true;
}

export function isStructurallyValidTrial(trial: unknown): trial is Trial {
  if (!isPlainRecord(trial)) return false;
  if (!isNonEmptyString(trial['id'])) return false;
  if (!Array.isArray(trial['stages']) || !(trial['stages'] as unknown[]).every(isValidStageElement)) return false;
  if (!Array.isArray(trial['batches']) || !(trial['batches'] as unknown[]).every(isValidBatchElement)) return false;
  if (!isPlainRecord(trial['acquisitions'])) return false;
  if (!isPlainRecord(trial['config'])) return false;
  for (const entry of Object.values(trial['acquisitions'] as Record<string, unknown>)) {
    if (!isValidAcquisitionEntry(entry)) return false;
  }
  return true;
}

/**
 * Erreur spécifique de violation d'intégrité relationnelle du modèle QUV (Gate 3.1)
 */
export class IntegrityViolationError extends Error {
  public readonly code = 'INTEGRITY_VIOLATION';
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'IntegrityViolationError';
    this.details = details;
    Object.setPrototypeOf(this, IntegrityViolationError.prototype);
  }
}

/**
 * Garde-fou d'intégrité relationnelle pour les acquisitions (Gate 3.1 - Risque 1)
 * Vérifie que batchId existe, que panelId appartient bien à ce lot,
 * et que stageId appartient bien à l'essai, avant toute écriture.
 */
export function validateAcquisitionTarget(
  trial: Trial,
  stageId: UUID,
  batchId: UUID,
  panelId: UUID
): void {
  if (!trial) {
    throw new IntegrityViolationError("Essai indéfini lors de la validation de la cible d'acquisition.");
  }

  // 1. Vérification de l'existence du lot
  const batch = trial.batches?.find((b) => b.id === batchId);
  if (!batch) {
    throw new IntegrityViolationError(
      `Le lot ${batchId} n'existe pas dans l'essai ${trial.id}.`,
      { trialId: trial.id, batchId, stageId, panelId }
    );
  }

  // 2. Vérification de l'appartenance de l'éprouvette au lot
  const panel = batch.panels?.find((p) => p.id === panelId);
  if (!panel) {
    throw new IntegrityViolationError(
      `L'éprouvette ${panelId} n'appartient pas au lot ${batchId} (lot "${batch.reference}").`,
      { trialId: trial.id, batchId, panelId, stageId }
    );
  }

  // 3. Vérification de l'existence de l'étape dans l'essai
  const stage = trial.stages?.find((s) => s.id === stageId);
  if (!stage) {
    throw new IntegrityViolationError(
      `L'étape d'exposition ${stageId} n'appartient pas à l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, batchId, panelId }
    );
  }
}

/**
 * Garde-fou d'intégrité relationnelle pour les photographies (Gate 3.1 - Risque 2)
 * Vérifie que stageId appartient à l'essai et que panelId appartient à un lot de l'essai.
 */
export function validatePhotoTarget(
  trial: Trial,
  stageId: UUID,
  panelId: UUID
): void {
  if (!trial) {
    throw new IntegrityViolationError("Essai indéfini lors de la validation de la cible photographique.");
  }

  // 1. Vérification de l'existence de l'étape
  const stage = trial.stages?.find((s) => s.id === stageId);
  if (!stage) {
    throw new IntegrityViolationError(
      `L'étape d'exposition ${stageId} n'appartient pas à l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, panelId }
    );
  }

  // 2. Vérification de l'existence de l'éprouvette dans l'un des lots de l'essai
  let foundPanel = false;
  if (Array.isArray(trial.batches)) {
    for (const b of trial.batches) {
      if (b.panels?.some((p) => p.id === panelId)) {
        foundPanel = true;
        break;
      }
    }
  }

  if (!foundPanel) {
    throw new IntegrityViolationError(
      `L'éprouvette ${panelId} n'existe pas dans les lots de l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, panelId }
    );
  }
}
