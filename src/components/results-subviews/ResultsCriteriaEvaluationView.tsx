/**
 * QUV-Lab — SOUS-VUE « CRITÈRES COMPLÉMENTAIRES » (Onglet Résultats)
 * NF EN 927-2:2014 (HISTORICAL_TRANSITIONAL) & INFIPERF / FCBA
 *
 * Affiche EXCLUSIVEMENT les résultats dérivés du service d'évaluation applicative.
 * Aucun calcul n'est réalisé ici. La présentation est factuelle :
 *  - aucun verdict global ;
 *  - aucune déclaration de conformité (2022 / CE / produit conforme) ;
 *  - NON_STABLE est une catégorie valide, jamais un échec ;
 *  - INSUFFICIENT_DATA / NO_CATEGORY_MET / INVALID_TEST restent distincts.
 *
 * En multi-lots, une sélection explicite du lot est OBLIGATOIRE (aucune
 * agrégation inter-systèmes, règle §25.5).
 */

import React, { useMemo, useState } from 'react';
import type { Trial } from '../../types/trial';
import type { ScientificRuleSet } from '../../types/scientific';
import { evaluateScientificCriteria } from '../../services/scientificCriteriaEvaluationService';
import {
  buildScientificCriteriaPresentation,
  checkForbiddenVocabulary
} from './scientificCriteriaPresentation';
import { Layers, FlaskConical, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface Props {
  trial: Trial;
  ruleSet: ScientificRuleSet;
}

const DATA_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  VALID: { label: 'Essai classable', tone: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  INVALID_TEST: { label: 'INVALID_TEST — écart > 4,0', tone: 'bg-rose-100 text-rose-900 border-rose-300' },
  INSUFFICIENT_DATA: { label: 'INSUFFICIENT_DATA', tone: 'bg-amber-50 text-amber-900 border-amber-300' }
};

export function ResultsCriteriaEvaluationView({ trial, ruleSet }: Props) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    trial.batches[0]?.id ?? ''
  );

  const effectiveBatchId = trial.batches.some((b) => b.id === selectedBatchId)
    ? selectedBatchId
    : (trial.batches[0]?.id ?? null);

  const multiBatch = trial.batches.length > 1;

  const evaluation = useMemo(
    () =>
      evaluateScientificCriteria(trial, ruleSet, {
        batchId: effectiveBatchId ?? undefined
      }),
    [trial, ruleSet, effectiveBatchId]
  );

  const presentation = useMemo(() => buildScientificCriteriaPresentation(evaluation), [evaluation]);
  const forbiddenOk = useMemo(() => checkForbiddenVocabulary(presentation), [presentation]);
  const forbiddenOkAll =
    forbiddenOk.absentCeConforme &&
    forbiddenOk.absentConformite2022 &&
    forbiddenOk.absentProduitConforme &&
    forbiddenOk.nonStablePresenteFactuellement;

  const nf = presentation.nf9272;
  const inf = presentation.infiperf;
  const dataStatus = DATA_STATUS_LABELS[nf.dataStatusKind] ?? DATA_STATUS_LABELS.VALID;

  return (
    <div className="space-y-6">
      {/* En-tête de la sous-vue */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-700" />
              CRITÈRES COMPLÉMENTAIRES
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Évaluations complémentaires après vieillissement QUV — jamais une
              déclaration de conformité du produit à la norme.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 whitespace-nowrap">
            Moteur v{presentation.ruleSetVersion}
          </span>
        </div>

        {!forbiddenOkAll && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            Garde-fou de vocabulaire déclenché : la présentation contient un terme
            de conformité interdit. La vérification est aussi verrouillée par tests.
          </div>
        )}

        {/* Périmètre système (lot) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold text-slate-700 shrink-0">
            {multiBatch ? 'Système de finition évalué :' : 'Système de finition :'}
          </span>
          {multiBatch ? (
            <select
              value={effectiveBatchId ?? ''}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
            >
              {trial.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference || b.id} — {b.coatingSystem || 'système non renseigné'}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-semibold text-slate-900">
              {nf.batchDisplay ?? 'Aucun lot'}
            </span>
          )}
          {multiBatch && (
            <p className="text-[11px] text-slate-500">
              La sélection est obligatoire : aucun mélange inter-systèmes n'est produit.
            </p>
          )}
        </div>
      </div>

      {/* ===== NF EN 927-2:2014 ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              NF EN 927-2 — {nf.edition ? `édition ${nf.edition}` : 'édition —'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Référentiel historique appliqué à titre transitoire.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-slate-900 text-white">
            Statut : {nf.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Référence</span>
            <span className="font-mono font-bold text-slate-900">{nf.reference}:{nf.edition}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Jalon évalué</span>
            <span className="font-semibold text-slate-800">{nf.jalonDisplay}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Lot évalué</span>
            <span className="font-semibold text-slate-800">{nf.batchDisplay ?? '—'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Statut de données</span>
            <span className={`inline-block px-2 py-0.5 rounded-lg font-bold border ${dataStatus.tone}`}>
              {dataStatus.label}
            </span>
          </div>
        </div>

        {nf.dataStatusKind === 'VALID' && nf.classification && (
          <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/50">
            <span className="block text-[10px] font-black uppercase tracking-widest text-blue-700">
              Classification séquentielle 2014
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`px-4 py-1.5 rounded-xl text-sm font-black text-white ${
                  nf.classification === 'STABLE'
                    ? 'bg-emerald-600'
                    : nf.classification === 'SEMI_STABLE'
                      ? 'bg-amber-500'
                      : nf.classification === 'NON_STABLE'
                        ? 'bg-purple-600'
                        : 'bg-slate-600'
                }`}
              >
                {nf.classification}
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {nf.classification === 'NON_STABLE'
                  ? 'Catégorie valide — dégradation marquée, jamais un échec.'
                  : nf.classification === 'NO_CATEGORY_MET'
                    ? 'Essai validé, aucune catégorie 2014 satisfaite — résultat normal.'
                    : 'Égalité aux seuils favorable (opérateur ≤).'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              <span className="font-semibold text-slate-700">
                Σ12 : <span className="font-mono font-black text-slate-900">{nf.sum12}</span>
              </span>
              <span className="font-semibold text-slate-700">
                Δmax : <span className="font-mono font-black text-slate-900">{nf.maxDifference}</span>
              </span>
              <span className="font-semibold text-slate-700">
                Verdict global : <span className="font-black text-slate-500">aucun (chaque critère indépendant)</span>
              </span>
            </div>
          </div>
        )}

        {nf.dataStatusKind === 'INSUFFICIENT_DATA' && (
          <div className="flex items-start gap-2 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 text-xs text-amber-900">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-black">Données insuffisantes.</span>{' '}
              <span className="font-medium">
                {nf.scopeBlockedReason ??
                  (nf.criteria.find((c) => c.status === 'INSUFFICIENT_DATA')?.message ?? 'Jalon C12 absent ou inexploitable.')}
              </span>
            </div>
          </div>
        )}

        {nf.dataStatusKind === 'INVALID_TEST' && (
          <div className="flex items-start gap-2 p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/50 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-black">Essai invalidé.</span>{' '}
              <span className="font-medium">
                Écart max−min des 12 valeurs &gt; 4,0 : la classification 2014 ne s'applique pas.
              </span>
            </div>
          </div>
        )}

        {/* Résultats par critère */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-bold">Critère</th>
                <th className="py-2 pr-3 font-bold">Statut</th>
                <th className="py-2 pr-3 font-bold">Moyenne C12</th>
                <th className="py-2 pr-3 font-bold">Seuil applicable</th>
                <th className="py-2 font-bold">Contrôle</th>
              </tr>
            </thead>
            <tbody>
              {nf.criteria.map((c) => (
                <tr key={c.criterionId} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">{c.label}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg font-bold border ${
                        c.status === 'FAVORABLE'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : c.status === 'DEFAVORABLE'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono font-bold text-slate-900">{c.value}</td>
                  <td className="py-2 pr-3 font-mono text-slate-700">≤ {c.threshold}</td>
                  <td className="py-2 font-semibold">
                    {c.pass === true ? 'PASS' : c.pass === false ? 'HORS SEUIL' : c.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {nf.complementaryNotice}
          {!nf.provenanceEmplacementsConnus &&
            ' La provenance documentaire des seuils est signalée « À DÉFINIR / À VALIDER SCIENTIFIQUEMENT ».'}
        </p>
      </div>

      {/* ===== INFIPERF ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-teal-600" />
              INFIPERF — {inf.edition ? `édition ${inf.edition}` : 'édition —'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Référentiel complémentaire indépendant — jamais une exigence NF EN 927-6.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-200">
            Évaluation complémentaire
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-bold">Indicateur</th>
                <th className="py-2 pr-3 font-bold">Statut</th>
                <th className="py-2 pr-3 font-bold">Valeur</th>
                <th className="py-2 pr-3 font-bold">Seuil / règle</th>
                <th className="py-2 font-bold">Message</th>
              </tr>
            </thead>
            <tbody>
              {inf.indicators.map((ind) => (
                <tr key={ind.indicator} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold text-slate-800">{ind.label}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg font-bold border ${
                        ind.status === 'FAVORABLE'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : ind.status === 'DEFAVORABLE'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : ind.status === 'VIGILANCE'
                              ? 'bg-orange-50 text-orange-900 border-orange-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {ind.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono font-bold text-slate-900">{ind.value}</td>
                  <td className="py-2 pr-3 font-mono text-slate-700">{ind.threshold}</td>
                  <td className="py-2 text-slate-600 font-medium">{ind.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {inf.complementaryNotice}
        </p>
      </div>
    </div>
  );
}