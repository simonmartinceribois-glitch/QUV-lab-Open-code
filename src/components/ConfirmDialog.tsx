/**
 * QUV-Lab — Boîte de dialogue de confirmation Oui / Non.
 * Le contenu (`children`) permet d'afficher un récapitulatif ou un champ
 * supplémentaire ; `confirmDisabled` bloque « Oui » tant qu'il est incomplet.
 */
import React from 'react';
import { HelpCircle } from 'lucide-react';

interface Props {
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel = 'Oui',
  cancelLabel = 'Non',
  confirmDisabled = false,
  onConfirm,
  onCancel
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        <div className="p-6 space-y-4 text-xs text-slate-700">
          {message && <p>{message}</p>}
          {children}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
