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
import { isFullBackup, restoreFullBackupMedia } from '../services/fullBackupService';
import { mediaStorage } from '../services/mediaStorageService';

interface Props {
  onClose: () => void;
  onImported: (trialId: string) => void;
}

export function ImportTrialModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Doublon d'identifiant : l'opérateur peut importer l'essai en copie.
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  // Import réussi mais photos partiellement restaurées : on reste ouvert pour l'afficher.
  const [mediaWarning, setMediaWarning] = useState<{ trialId: string; message: string } | null>(null);

  const canImport = !!file && operatorId.trim().length > 0 && !busy;

  const handleImport = async (asCopy = false) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDuplicate(false);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('Fichier illisible : le contenu n’est pas un JSON valide.');
      }
      const trial = globalTrialStore.importTrialFromExport(payload, operatorId, file.name, { asCopy });
      if (isFullBackup(payload)) {
        const summary = await restoreFullBackupMedia(payload, trial, mediaStorage);
        if (summary.failed.length > 0) {
          onImported(trial.id);
          setMediaWarning({
            trialId: trial.id,
            message: `Essai importé. Photographies : ${summary.restored} restaurée(s), ${summary.alreadyPresent} déjà présente(s), ${summary.failed.length} en échec.`
          });
          return;
        }
      }
      onImported(trial.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      const details = (err as { details?: { reason?: unknown } } | null)?.details;
      setDuplicate(details?.reason === 'DUPLICATE_TRIAL_ID');
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
            Sélectionnez une <span className="font-mono">SAUVEGARDE_COMPLETE_*.json</span> (photographies incluses) ou un
            dossier <span className="font-mono">DOSSIER_SCIENTIFIQUE_*.json</span> (sans photographies) exporté depuis
            l’onglet 08 → « 8. Rapport Scientifique &amp; Exports ». Un essai ou une photo déjà présents ne sont jamais écrasés.
          </p>

          <label className="block space-y-1">
            <span className="font-bold text-slate-600">Fichier JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
                setDuplicate(false);
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

          {mediaWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{mediaWarning.message}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {duplicate && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span>Importer une copie indépendante (nouvel identifiant, référence suffixée « -COPIE ») ?</span>
              <button
                type="button"
                onClick={() => handleImport(true)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 shrink-0"
              >
                Importer comme copie
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            {mediaWarning ? 'Fermer' : 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => handleImport(false)}
            disabled={!canImport || !!mediaWarning}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Import…' : mediaWarning ? 'Importé' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
