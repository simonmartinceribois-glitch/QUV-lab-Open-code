/**
 * QUV-Lab — Assistant : étape 2 Caractéristiques communes (refactor/split-wizard).
 * JSX déplacé à l'identique depuis CreateTrialWizardModal.tsx (step === 2).
 * Aucun état ici : valeurs + setters reçus en props depuis le parent.
 */

import { Sliders } from 'lucide-react';
import type { DimUnitSetter, NumberSetter, TextSetter } from './wizardTypes';

interface Props {
  lengthMm: number;
  onLengthChange: NumberSetter;
  widthMm: number;
  onWidthChange: NumberSetter;
  thicknessMm: number;
  onThicknessChange: NumberSetter;
  dimUnit: 'mm' | 'cm';
  onDimUnitChange: DimUnitSetter;
  substrateNature: string;
  onSubstrateNatureChange: TextSetter;
  preparationNotes: string;
  onPreparationNotesChange: TextSetter;
  conditioningNotes: string;
  onConditioningNotesChange: TextSetter;
  commonProtocolNotes: string;
  onCommonProtocolNotesChange: TextSetter;
}

export function WizardStep2Characteristics({
  lengthMm,
  onLengthChange,
  widthMm,
  onWidthChange,
  thicknessMm,
  onThicknessChange,
  dimUnit,
  onDimUnitChange,
  substrateNature,
  onSubstrateNatureChange,
  preparationNotes,
  onPreparationNotesChange,
  conditioningNotes,
  onConditioningNotesChange,
  commonProtocolNotes,
  onCommonProtocolNotesChange
}: Props) {
  return (
    <div className="space-y-4">
      {/* Dimensions */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          Dimensions normalisées des éprouvettes
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Longueur</label>
            <input
              type="number"
              value={lengthMm}
              onChange={(e) => onLengthChange(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Largeur</label>
            <input
              type="number"
              value={widthMm}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Épaisseur</label>
            <input
              type="number"
              value={thicknessMm}
              onChange={(e) => onThicknessChange(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Unité</label>
            <select
              value={dimUnit}
              onChange={(e) => onDimUnitChange(e.target.value as any)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="mm">Millimètres (mm)</option>
              <option value="cm">Centimètres (cm)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Matériau & Substrat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Nature du support / matériau de référence
          </label>
          <input
            type="text"
            value={substrateNature}
            onChange={(e) => onSubstrateNatureChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Bois massif"
          />
        </div>

      </div>

      {/* Préparation & Conditionnement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Informations de préparation du support
          </label>
          <textarea
            rows={2}
            value={preparationNotes}
            onChange={(e) => onPreparationNotesChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Ponçage, dépoussiérage, état de surface..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Informations de conditionnement
          </label>
          <textarea
            rows={2}
            value={conditioningNotes}
            onChange={(e) => onConditioningNotesChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Température, hygrométrie, durée de stabilisation..."
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Paramètres communs au protocole de l'essai
        </label>
        <input
          type="text"
          value={commonProtocolNotes}
          onChange={(e) => onCommonProtocolNotesChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Notes communes..."
        />
      </div>
    </div>
  );
}
