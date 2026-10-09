/**
 * QUV-Lab — Import d'un essai depuis le dossier scientifique JSON exporté
 * (onglet 08 → « 8. Rapport Scientifique & Exports » → export JSON).
 *
 * Toute la validation est portée par TrialStoreService.importTrialFromExport
 * (fail-closed, jamais d'écrasement) ; ce composant ne fait que lire le
 * fichier et afficher le refus éventuel.
 */
import React, { useState } from 'react';
import { Upload, X, AlertTriangle } from 'lucide-react';
import { globalTrialStore } from '../services/trialStore';

interface Props {
  onClose: () => void;
  onImported: (trialId: string) => void;
}

export function ImportTrialModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canImport = !!file && operatorId.trim().length > 0 && !busy;

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('Fichier illisible : le contenu n’est pas un JSON valide.');
      }
      const trial = globalTrialStore.importTrialFromExport(payload, operatorId, file.name);
      onImported(trial.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importer un essai
          </h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-700">
          <p>
            Sélectionnez un dossier scientifique <span className="font-mono">DOSSIER_SCIENTIFIQUE_*.json</span> exporté
            depuis QUV-Lab. Un essai déjà présent n’est jamais écrasé. Les photographies ne sont pas contenues dans le
            fichier : elles apparaîtront comme introuvables si elles n’existent pas sur ce poste.
          </p>

          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Fichier JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:font-semibold"
            />
          </label>

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

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Import…' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
