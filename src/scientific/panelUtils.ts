/**
 * QUV-Lab — Utilitaires de Filtrage et Ségrégation Éprouvettes & Jalons (GATE 2.2)
 *
 * Règles absolues :
 * 1. Témoin T (conservé à l'obscurité) NE DOIT JAMAIS entrer dans les calculs de moyennes
 *    et dispersions des exposés E1, E2, E3.
 * 2. Les étapes inactives (désactivées par l'opérateur) sont exclues des calculs actifs.
 */

import { PanelDefinition, ExposureStage } from '../types/trial';
import { MeasurementFamilyId } from '../types/scientific';

/**
 * Détermine si une éprouvette est le Témoin non exposé (T)
 */
export function isWitnessPanel(panel: {
  label?: string;
  roleCode?: string;
  role?: string;
}): boolean {
  if (!panel) return false;
  return (
    panel.label === 'T' ||
    panel.roleCode === 'T' ||
    panel.role === 'WITNESS' ||
    panel.label === 'P01' && (panel.role === 'WITNESS' || panel.roleCode === 'T')
  );
}

/**
 * Détermine si une éprouvette est une éprouvette exposée valide (E1, E2, E3, etc.)
 */
export function isExposedPanel(panel: {
  label?: string;
  roleCode?: string;
  role?: string;
  status?: string;
}): boolean {
  if (!panel) return false;
  if (panel.status && panel.status !== 'ACTIVE') return false;
  return !isWitnessPanel(panel);
}

/**
 * Filtre les éprouvettes actives et EXPOSÉES d'une liste (exclut T et les exclus).
 *
 * Sémantique générique conservée : tout panneau actif non-témoin est considéré
 * exposé (cinétiques, synthèses). Pour les statistiques normalisées exigeant
 * exactement E1/E2/E3, utiliser `getActiveE1E2E3Panels()`.
 */
export function getActiveExposedPanels<T extends { label?: string; roleCode?: string; role?: string; status?: string }>(
  panels: T[]
): T[] {
  return panels.filter((p) => isExposedPanel(p));
}

/**
 * Prédicat générique d'éprouvette exposée normalisée E1/E2/E3 : identification
 * SANS ambiguïté par paires appariées du modèle métier
 * (E1/EXPOSED_1, E2/EXPOSED_2, E3/EXPOSED_3).
 * T (témoin), code 'E' générique, EXPOSED_CUSTOM et paires incohérentes refusés.
 * Source unique pour PERSOZ, ADHÉSION C12 et agrégations scientifiques normalisées.
 */
export function isExposedE1E2E3Panel(panel: {
  roleCode?: string;
  role?: string;
}): boolean {
  if (!panel) return false;
  return (
    (panel.roleCode === 'E1' && panel.role === 'EXPOSED_1') ||
    (panel.roleCode === 'E2' && panel.role === 'EXPOSED_2') ||
    (panel.roleCode === 'E3' && panel.role === 'EXPOSED_3')
  );
}

/**
 * Filtre strict des éprouvettes exposées normalisées E1/E2/E3 actives.
 * Population scientifique des agrégations COLOR/GLOSS/PERSOZ/ADHESION et de la
 * synthèse statistique du rapport : T et panneaux non normalisés exclus.
 */
export function getActiveE1E2E3Panels<T extends { roleCode?: string; role?: string; status?: string }>(
  panels: T[]
): T[] {
  return panels.filter((p) => (!p.status || p.status === 'ACTIVE') && isExposedE1E2E3Panel(p));
}

/**
 * Éligibilité stricte PERSOZ (verrou PERSOZ/Témoin renforcé) : E1/E2/E3 via le
 * prédicat générique `isExposedE1E2E3Panel`. T et panneaux non identifiés refusés.
 */
export function isPersozEligiblePanel(panel: {
  roleCode?: string;
  role?: string;
}): boolean {
  return isExposedE1E2E3Panel(panel);
}

/**
 * Éligibilité métier ADHÉSION (verrou ADHÉSION T0/C12) : matrice canonique.
 * - T0 (cycleIndex 0) : témoin T UNIQUEMENT.
 * - C12 (cycleIndex 12) : E1/E2/E3 strictement (prédicat générique, découplé de PERSOZ).
 * - C1..C11 : aucun panneau.
 * `stage` est identifié par son cycleIndex physique (0 = T0, 12 = C12/2016h).
 */
export function isAdhesionEligiblePanel(
  panel: {
    label?: string;
    roleCode?: string;
    role?: string;
  },
  stage: {
    cycleIndex?: number;
  }
): boolean {
  if (!panel || !stage) return false;
  if (stage.cycleIndex === 0) return isWitnessPanel(panel);
  if (stage.cycleIndex === 12) return isExposedE1E2E3Panel(panel);
  return false;
}

/**
 * Récupère l'éprouvette Témoin T d'un lot
 */
export function getWitnessPanel<T extends { label?: string; roleCode?: string; role?: string }>(
  panels: T[]
): T | undefined {
  return panels.find((p) => isWitnessPanel(p));
}

/**
 * Filtre les étapes actives de l'essai (exclut les étapes désactivées / INACTIVE)
 */
export function getActiveStages<T extends { status: string }>(stages: T[]): T[] {
  return stages.filter((s) => s.status !== 'INACTIVE');
}

/**
 * Repère court d'un jalon : 'T0' ou 'C1'..'C12' ('—' si indéfini) (fix/cycle-labels).
 */
export function cycleTag(stage: { cycleIndex: number } | null | undefined): string {
  if (!stage) return '—';
  return stage.cycleIndex === 0 ? 'T0' : `C${stage.cycleIndex}`;
}

/**
 * Libellé compact d'un jalon avec ses heures : 'T0 (0 h)' / 'C3 (504 h)' (fix/cycle-labels).
 */
export function formatStageShort(stage: {
  cycleIndex: number;
  scheduledExposureHours?: number;
} | null | undefined): string {
  if (!stage) return '—';
  return `${cycleTag(stage)} (${stage.scheduledExposureHours ?? 0} h)`;
}

/**
 * Libellé d'option/en-tête : 'T0 — MESURES…' tel quel, sinon 'C3 · 504 h — MESURES…'.
 * Évite le doublon 'T0 · T0 — …' (le nom T0 porte déjà son repère).
 */
export function formatStageOption(stage: {
  cycleIndex: number;
  name?: string;
} | null | undefined): string {
  if (!stage) return '—';
  const tag = cycleTag(stage);
  const name = stage.name || '';
  if (!name || name.startsWith(tag)) return name || tag;
  return `${tag} · ${name}`;
}

/**
 * Titre d'affichage d'un jalon : préfixe T0/Cx + intitulé sans le préfixe d'heures redondant.
 * Ex : '504 h — MESURES EN COURS D'EXPOSITION' → 'C3 — MESURES EN COURS D'EXPOSITION'.
 */
export function formatStageTitle(stage: {
  cycleIndex: number;
  scheduledExposureHours?: number;
  name?: string;
}): string {
  const tag = cycleTag(stage);
  const name = stage.name || '';
  const stripped = name.replace(/^\d+\s*h\s*[—–-]\s*/, '');
  if (stripped !== name) return `${tag} — ${stripped}`;
  if (name.startsWith(tag)) return name;
  return name ? `${tag} — ${name}` : tag;
}

/**
 * Détermine si une étape est obligatoire et non désactivable
 */
export function isMandatoryStage(stage: { cycleIndex: number; stageType?: string }): boolean {
  return (
    stage.cycleIndex === 0 ||
    stage.cycleIndex === 12 ||
    stage.stageType === 'INITIAL_PRE_EXPOSURE' ||
    stage.stageType === 'FINAL_POST_EXPOSURE'
  );
}

/**
 * RÈGLE MÉTIER CANONIQUE QUV-Lab — Famille ADHESION (NF EN ISO 2409:2020) :
 * ADHESION = T0 + C12 UNIQUEMENT.
 *
 * L'adhérence au quadrillage est un essai mécanique destructif. Elle est obligatoire et attendue
 * exclusivement à l'état initial (T0 / 0 h) et à l'état final (C12 / 2016 h).
 * Elle est strictement INTERDITE et NON MESURÉE aux jalons intermédiaires C1 à C11.
 *
 * Cette fonction est la SOURCE DE VÉRITÉ UNIQUE régissant :
 * - Le modèle métier
 * - Le plan de mesurage
 * - La complétude et la progression
 * - L'interface utilisateur (affichage des sélecteurs et boutons de saisie)
 */
export function isFamilyScheduledForStage(
  familyId: MeasurementFamilyId | string,
  stage: { cycleIndex: number; stageType?: string; scheduledExposureHours?: number } | undefined | null
): boolean {
  if (!stage) return false;
  if (familyId === 'ADHESION') {
    // T0 (0 h) ou C12 (2016 h) uniquement
    return (
      stage.cycleIndex === 0 ||
      stage.cycleIndex === 12 ||
      stage.stageType === 'INITIAL_PRE_EXPOSURE' ||
      stage.stageType === 'FINAL_POST_EXPOSURE'
    );
  }
  // Pour toutes les autres familles (COLOR, GLOSS, PERSOZ, OBSERVATIONS, etc.),
  // elles sont applicables à tous les jalons de l'échéancier.
  return true;
}

/**
 * Retourne la liste des familles actives applicables à un jalon d'exposition donné.
 * Filtre les familles actives de l'essai selon leur éligibilité pour ce jalon.
 */
export function getActiveFamiliesForStage(
  activeFamilies: (MeasurementFamilyId | string)[],
  stage: { cycleIndex: number; stageType?: string; scheduledExposureHours?: number } | undefined | null
): MeasurementFamilyId[] {
  if (!activeFamilies || !stage) return [];
  return (activeFamilies as MeasurementFamilyId[]).filter((fam) => isFamilyScheduledForStage(fam, stage));
}

