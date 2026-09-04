/**
 * QUV-Lab — Assistant de création : types partagés des étapes (refactor/split-wizard).
 * Aucune logique : seuls types. Les setters sont typés Dispatch pour un déplacement verbatim.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { MeasurementFamilyId } from '../../types/scientific';

// Déplacée depuis CreateTrialWizardModal.tsx (suppression du cycle
// CreateTrialWizardModal → step → wizardTypes → CreateTrialWizardModal).
// Propriétés strictement inchangées.
export interface LotFormItem {
  id: string;
  reference: string;
  woodSpecies: string;
  productReference: string;
  manufacturerOrSupplier: string;
  coatingSystem: string;
  coatCount: number;
  substratePreparation: string;
  applicationMethod: string;
  applicationConditions: string;
  applicationDate: string;
  dryingOrConditioningTime: string;
  batchNotes: string;
  panelCount: number;
}

export type TextSetter = Dispatch<SetStateAction<string>>;
export type NumberSetter = Dispatch<SetStateAction<number>>;
export type DimUnit = 'mm' | 'cm';
export type DimUnitSetter = Dispatch<SetStateAction<DimUnit>>;

export interface StepNavigation {
  step: number;
  onStepChange: (step: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
}

export type { MeasurementFamilyId };
