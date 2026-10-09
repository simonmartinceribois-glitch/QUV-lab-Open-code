/**
 * QUV-Lab — 01 Identification (PROMPT 6 v6.1 - Sections 7 & 8)
 * Les informations sont saisies à la création de l'essai et s'affichent ici en
 * lecture seule. Modification : « Modifier » (confirmation) → édition →
 * « Valider les modifications » (récapitulatif + opérateur, confirmation).
 * Chaque champ modifié est tracé dans 09 Journal de bord (avant → après).
 */

import React, { useState } from 'react';
import { Trial } from '../../types/trial';
import { globalTrialStore } from '../../services/trialStore';
import {
  diffIdentification,
  identificationFormFromTrial,
  validateIdentificationForm
} from '../../services/trialIdentification';
import type { IdentificationField, IdentificationForm } from '../../services/trialIdentification';
import { ConfirmDialog } from '../ConfirmDialog';
import { CheckCircle2, FileText, Sliders, Pencil, X, Check, AlertTriangle } from 'lucide-react';

interface Props {
  trial: Trial;
  onTrialUpdated: () => void;
}

type Dialog = 'confirmEdit' | 'confirmValidate' | null;

const display = (value: string) => (value.trim() === '' ? '—' : value);

export function Tab01Identification({ trial, onTrialUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<IdentificationForm>(() => identificationFormFromTrial(trial));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [operatorId, setOperatorId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = identificationFormFromTrial(trial);
  const changes = editing ? diffIdentification(trial, form) : [];
  const formErrors = editing ? validateIdentificationForm(form, current) : [];

  const setField = (field: IdentificationField) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = () => {
    setForm(identificationFormFromTrial(trial));
    setEditing(true);
    setDialog(null);
    setError(null);
    setNotice(null);
  };

  const cancelEdit = () => {
    setForm(identificationFormFromTrial(trial));
    setEditing(false);
    setError(null);
  };

  const requestValidation = () => {
    setError(null);
    if (formErrors.length > 0) {
      setError(formErrors.join(' '));
      return;
    }
    if (changes.length === 0) {
      setEditing(false);
      setNotice('Aucune modification à valider.');
      return;
    }
    setDialog('confirmValidate');
  };

  const confirmValidation = () => {
    try {
      const applied = globalTrialStore.updateTrialIdentification(trial.id, form, operatorId);
      setDialog(null);
      setEditing(false);
      setNotice(`${applied.length} modification(s) validée(s) et tracée(s) dans 09 Journal de bord.`);
      onTrialUpdated();
    } catch (err) {
      setDialog(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const values = editing ? form : current;
  const inputClass = (extra = '') =>
    `w-full text-xs px-3 py-2 border rounded-lg ${extra} ${
      editing
        ? 'bg-white border-slate-300 focus:ring-2 focus:ring-blue-500'
        : 'bg-slate-50 border-slate-200 text-slate-700 cursor-default'
    }`;

  return (
    <div className="space-y-6">
      {/* En-tête + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{trial.metadata.reference}</h3>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">{trial.status}</span>
            </div>
            <p className="text-xs text-slate-500">
              Créé le {new Date(trial.createdAt).toLocaleDateString('fr-FR')} par {trial.metadata.createdBy}
            </p>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
            <button
              type="button"
              onClick={requestValidation}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
            >
              <Check className="w-4 h-4" />
              Valider les modifications
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDialog('confirmEdit')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <Pencil className="w-4 h-4" />
            Modifier
          </button>
        )}
      </div>

      {editing && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
          Mode modification : les changements ne sont enregistrés qu'après « Valider les modifications ».
        </div>
      )}
      {notice && !editing && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 1. Métadonnées */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
          1. Identification Administrative & Contexte
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Référence Essai</label>
            <input
              type="text"
              value={trial.metadata.reference}
              disabled
              className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">N° Commande (CO-VANXXXX)</label>
            <input
              type="text"
              value={values.orderNumber}
              onChange={setField('orderNumber')}
              readOnly={!editing}
              placeholder={editing ? 'Ex: CO-2030-001' : '—'}
              className={inputClass('font-mono font-semibold')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">N° Rapport (RA-VANXXXX)</label>
            <input
              type="text"
              value={values.reportNumber}
              onChange={setField('reportNumber')}
              readOnly={!editing}
              placeholder={editing ? 'Ex: RA-2030-001' : '—'}
              className={inputClass('font-mono font-semibold')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Intitulé / Titre de l'Essai</label>
            <input type="text" value={values.title} onChange={setField('title')} readOnly={!editing} placeholder="—" className={inputClass()} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Client</label>
            <input
              type="text"
              value={values.projectOrClient}
              onChange={setField('projectOrClient')}
              readOnly={!editing}
              placeholder="—"
              className={inputClass()}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Opérateur / Responsable Création</label>
            <input
              type="text"
              value={trial.metadata.createdBy}
              disabled
              className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Notes Générales & Contexte d'Essai</label>
            <input
              type="text"
              value={values.generalNotes}
              onChange={setField('generalNotes')}
              readOnly={!editing}
              placeholder={editing ? "Contexte général de l'étude..." : '—'}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {/* 2. Caractéristiques communes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center justify-between">
          <span>2. Dimensions Communes des Éprouvettes (Niveau PROJET)</span>
          <span className="text-blue-600 font-bold normal-case">Saisies UNE SEULE FOIS pour tout le projet</span>
        </h4>

        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Dimensions physiques uniques applicables à tous les lots et éprouvettes
            </span>
            <span className="text-[11px] text-slate-500 italic">NF EN 927-6 §5 : 150 × 75 × 15 mm recommandé</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(['lengthMm', 'widthMm', 'thicknessMm'] as const).map((field) => (
              <div key={field}>
                <label className="block text-slate-700 mb-1 font-semibold">
                  {field === 'lengthMm' ? 'Longueur' : field === 'widthMm' ? 'Largeur' : 'Épaisseur'} ({values.unit})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[field]}
                  onChange={setField(field)}
                  readOnly={!editing}
                  placeholder="—"
                  className={inputClass('font-medium')}
                />
              </div>
            ))}
            <div>
              <label className="block text-slate-700 mb-1 font-semibold">Unité de mesure</label>
              <select value={values.unit} onChange={setField('unit')} disabled={!editing} className={inputClass(editing ? 'font-medium' : 'font-medium appearance-none')}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Nature du support (Général)</label>
            <input
              type="text"
              value={values.substrateNature}
              onChange={setField('substrateNature')}
              readOnly={!editing}
              placeholder={editing ? 'Ex: Bois massif' : '—'}
              className={inputClass()}
            />
          </div>
        </div>
      </div>

      {dialog === 'confirmEdit' && (
        <ConfirmDialog
          title="Modifier"
          message="Voulez-vous modifier l'identification de cet essai ? Les modifications validées seront tracées dans 09 Journal de bord."
          onConfirm={startEdit}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'confirmValidate' && (
        <ConfirmDialog
          title="Valider les modifications"
          message="Confirmez-vous l'enregistrement des modifications suivantes ?"
          confirmDisabled={operatorId.trim() === ''}
          onConfirm={confirmValidation}
          onCancel={() => setDialog(null)}
        >
          <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-3 py-2">Champ</th>
                <th className="text-left px-3 py-2">Avant</th>
                <th className="text-left px-3 py-2">Après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {changes.map((c) => (
                <tr key={c.field}>
                  <td className="px-3 py-2 font-semibold">{c.label}</td>
                  <td className="px-3 py-2 text-slate-500 line-through">{display(c.before)}</td>
                  <td className="px-3 py-2 font-bold text-slate-900">{display(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Opérateur (obligatoire)</span>
            <input
              type="text"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="Initiales ou nom"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
