/**
 * QUV-Lab — Assistant : étape 1 Identification & Métadonnées (refactor/split-wizard).
 * JSX déplacé à l'identique depuis CreateTrialWizardModal.tsx (step === 1).
 * Aucun état ici : valeurs + setters reçus en props depuis le parent.
 */

import type { TextSetter } from './wizardTypes';

interface Props {
  reference: string;
  onReferenceChange: TextSetter;
  title: string;
  onTitleChange: TextSetter;
  projectOrClient: string;
  onProjectOrClientChange: TextSetter;
  createdBy: string;
  onCreatedByChange: TextSetter;
  generalNotes: string;
  onGeneralNotesChange: TextSetter;
}

export function WizardStep1Identification({
  reference,
  onReferenceChange,
  title,
  onTitleChange,
  projectOrClient,
  onProjectOrClientChange,
  createdBy,
  onCreatedByChange,
  generalNotes,
  onGeneralNotesChange
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Référence Essai (Unique) *
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold ${
              !reference.trim() ? 'border-rose-300 bg-rose-50/20' : 'border-slate-300'
            }`}
            placeholder="Ex: QUV-2026-042"
          />
          {!reference.trim() && (
            <p className="text-[11px] text-rose-600 mt-1 font-medium">
              La référence unique est obligatoire pour la traçabilité.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Projet
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Évaluation durabilité finitions lasures sur chêne"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Client
          </label>
          <input
            type="text"
            value={projectOrClient}
            onChange={(e) => onProjectOrClientChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Ceribois - Programme Recherche R&D"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Opérateur Responsable / Créateur *
          </label>
          <input
            type="text"
            value={createdBy}
            onChange={(e) => onCreatedByChange(e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium ${
              !createdBy.trim() ? 'border-rose-300 bg-rose-50/20' : 'border-slate-300'
            }`}
            placeholder="Ex: Simon Martin (Technicien)"
          />
          {!createdBy.trim() && (
            <p className="text-[11px] text-rose-600 mt-1 font-medium">
              L'opérateur responsable est requis pour la traçabilité réglementaire de l'essai.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Descriptif de l'essai
        </label>
        <textarea
          rows={3}
          value={generalNotes}
          onChange={(e) => onGeneralNotesChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Objectif de l'étude, particularités de mise en œuvre, consignes spéciales..."
        />
      </div>
    </div>
  );
}
