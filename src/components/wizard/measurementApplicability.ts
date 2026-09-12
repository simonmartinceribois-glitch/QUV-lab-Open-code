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