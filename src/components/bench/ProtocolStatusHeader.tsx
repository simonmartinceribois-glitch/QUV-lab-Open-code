/**
 * QUV-Lab — En-tête PROTOCOLE DE MESURE standard / adapté (P5).
 * Composant d'affichage pur : référence scientifique, configuration réalisée,
 * statut PROTOCOLE STANDARD / ⚠️ PROTOCOLE ADAPTÉ et justification éventuelle.
 */

import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface ProtocolStatusHeaderProps {
  isAdapted: boolean;
  reference: string;
  realized: string;
  justification?: string;
}

export function ProtocolStatusHeader({
  isAdapted,
  reference,
  realized,
  justification
}: ProtocolStatusHeaderProps) {
  const hasJustification = Boolean(justification && justification.trim().length > 0);
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        isAdapted ? 'border-amber-300 bg-amber-50/70' : 'border-emerald-300 bg-emerald-50/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className={`font-bold flex items-center gap-1.5 ${isAdapted ? 'text-amber-800' : 'text-emerald-800'}`}>
            {isAdapted ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
            {isAdapted ? '⚠️ PROTOCOLE ADAPTÉ' : 'PROTOCOLE STANDARD'}
          </div>
          <div className="font-mono text-slate-600 flex flex-wrap gap-x-1.5">
            <span>Référence scientifique : {reference}</span>
            <span className="text-slate-300">|</span>
            <span>Réalisée : {realized}</span>
          </div>
          {isAdapted && (
            <div className="text-amber-900">
              <span className="font-bold">Justification : </span>
              {hasJustification ? (justification as string).trim() : 'NON RENSEIGNÉE'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}