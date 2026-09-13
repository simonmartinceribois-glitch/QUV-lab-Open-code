/**
 * QUV-Lab — Étape 6 Calendrier & Plan de mesurage : applicabilité des familles par jalon.
 *
 * LOGIQUE PURE (aucune dépendance React/DOM) : détermine, pour chaque famille active,
 * si elle est applicable à un jalon donné, en réutilisant UNIQUEMENT la règle scientifique
 * canonique `isFamilyScheduledForStage()` (panelUtils). Aucune règle n'est dupliquée ici.
 *
 * Cette fonction répond uniquement à la question :
 *   « famille X applicable au jalon Y ? »
 *
 * Elle ne retourne JAMAIS un booléen de type `canBeMeasured` et ne détermine en aucun cas
 * si le bouton global d'un cycle est activé. La sélection globale des jalons reste
 * indépendante de l'applicabilité par famille (cf. isCycleGloballySelectable).
 */

import type { MeasurementFamilyId } from '../../types/scientific';
import { isFamilyScheduledForStage } from '../../scientific/panelUtils';
import { generateStandardExposureStages } from '../../services/trialStages';

export interface FamilyApplicability {
  family: MeasurementFamilyId;
  applicable: boolean;
}

export interface StageLike {
  cycleIndex: number;
  stageType?: string;
  scheduledExposureHours?: number;
}

/**
 * Applicabilité par famille pour un jalon donné.
 * - activeFamilies vide ou stage absent → tableau vide (déterministe, jamais `null`).
 * - Ordre stable : ordre des familles actives.
 * - Ne construit aucune information de désactivation globale.
 */
export function getMeasurementApplicability(
  activeFamilies: MeasurementFamilyId[],
  stage: StageLike | null | undefined
): FamilyApplicability[] {
  if (!activeFamilies || activeFamilies.length === 0 || !stage) return [];
  return activeFamilies.map((family) => ({
    family,
    applicable: isFamilyScheduledForStage(family, stage)
  }));
}

/**
 * Décision de sélection GLOBALE d'un jalon.
 * NE DÉPEND QUE du caractère obligatoire (T0/C12). L'applicabilité d'une famille
 * n'entre JAMAIS dans cette décision : une famille non applicable (ex. ADHESION sur
 * C1..C11) ne peut pas désactiver globalement un cycle.
 */
export function isCycleGloballySelectable(isMandatory: boolean): boolean {
  return !isMandatory;
}

/**
 * R1 (audit 11-12/09/2026) — Source canonique unique du caractère obligatoire
 * d'un jalon (T0/C12). Remplace la condition dupliquée `cycle === 0 || cycle
 * === 12` qui existait en dur dans WizardStep6Calendar.tsx.
 */
export function isMandatoryCycle(cycle: number): boolean {
  return cycle === 0 || cycle === 12;
}

export interface CalendarCycleDescriptor {
  cycle: number;
  hours: number;
  label: string;
  type: 'INITIAL' | 'INTERMEDIATE' | 'FINAL';
}

/**
 * Génère les 13 jalons du calendrier (T0, C1..C11, C12) pour l'affichage du
 * sélecteur de plan de mesurage (étape 6 de l'assistant, AVANT la création
 * réelle de l'essai — aucun `trialId` ni `Trial.stages` n'existe encore à ce
 * stade).
 *
 * Contre-audit (post-11-12/09/2026) : la première version de cette fonction
 * recalculait indépendamment `(i + 1) * 168` et `2016`, dupliquant les
 * constantes physiques déjà définies canoniquement dans
 * `generateStandardExposureStages()` (src/services/trialStages.ts), qui
 * génère les VRAIS `Trial.stages` persistés à la création de l'essai. Cette
 * fonction délègue désormais à cette source unique plutôt que de redéfinir
 * la durée des cycles côté wizard : seuls `cycle`, `hours` et le type de
 * jalon sont réellement utilisés par WizardStep6Calendar.tsx (le champ
 * `label` généré ici n'est pas affiché — le composant construit son propre
 * texte à partir de `cycle`/`hours`).
 */
export function buildCalendarCycles(): CalendarCycleDescriptor[] {
  const stages = generateStandardExposureStages('preview');
  return stages.map((s) => ({
    cycle: s.cycleIndex,
    hours: s.scheduledExposureHours,
    label: s.name,
    type:
      s.stageType === 'INITIAL_PRE_EXPOSURE'
        ? 'INITIAL'
        : s.stageType === 'FINAL_POST_EXPOSURE'
          ? 'FINAL'
          : 'INTERMEDIATE'
  }));
}

/**
 * R1 (audit 11-12/09/2026) — Décision RÉELLE de câblage du clic sur un jalon.
 *
 * C'est EXACTEMENT cette fonction que `WizardStep6Calendar.tsx` invoque dans
 * son gestionnaire `onClick`. Avant cette extraction, le test « anti-
 * régression » (G54-CAL-16→19) appelait `isCycleGloballySelectable` avec un
 * booléen écrit à la main dans le test lui-même — ce qui valide la table de
 * vérité d'une négation, jamais le câblage réel du composant. En important
 * CETTE fonction dans le composant ET dans le test (voir G54-CAL-20), une
 * régression du câblage (ex. ajout d'une condition sur l'applicabilité par
 * famille dans le calcul d'activation du clic) est détectée par le test.
 */
export function isStageClickEnabled(cycle: number): boolean {
  return isCycleGloballySelectable(isMandatoryCycle(cycle));
}

/**
 * R2 (audit 11-12/09/2026) — Extraction des préréglages du plan de mesurage,
 * auparavant codés en dur et dupliqués dans le seul gestionnaire d'événement
 * `setPlanPreset` de CreateTrialWizardModal.tsx (aucune fonction pure
 * testable). Source canonique unique, réutilisée par le composant ET par le
 * test UX 45 (ex-`pass: true` codé en dur, cf. UXTestsSuite.tsx).
 */
export type CalendarPreset = 'FULL' | 'QUARTERLY' | 'LIGHT';

export function getPresetCycles(preset: CalendarPreset): number[] {
  switch (preset) {
    case 'FULL':
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case 'QUARTERLY':
      return [0, 3, 6, 9, 12];
    case 'LIGHT':
      return [0, 6, 12];
  }
}