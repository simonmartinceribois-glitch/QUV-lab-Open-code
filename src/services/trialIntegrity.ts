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
 * identifiant, étapes, lots avec panneaux, acquisitions et configuration.
 * Retourne false (jamais d'exception) pour les entrées corrompues, qui sont
 * alors ignorées explicitement par l'appelant avec avertissement tracé.
 */
export function isStructurallyValidTrial(trial: unknown): trial is Trial {
  if (trial === null || trial === undefined || typeof trial !== 'object') return false;
  const t = trial as Record<string, unknown>;
  if (typeof t['id'] !== 'string' || t['id'].length === 0) return false;
  if (!Array.isArray(t['stages'])) return false;
  if (!Array.isArray(t['batches'])) return false;
  if (typeof t['acquisitions'] !== 'object' || t['acquisitions'] === null) return false;
  if (typeof t['config'] !== 'object' || t['config'] === null) return false;
  for (const batch of t['batches'] as unknown[]) {
    if (batch === null || typeof batch !== 'object') return false;
    const panels = (batch as Record<string, unknown>)['panels'];
    if (!Array.isArray(panels)) return false;
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
