/**
 * QUV-Lab — 07 Contrôle Qualité Multi-Niveaux (PROMPT 6 - Section 19)
 * Contrôle qualité des relevés et distinction formelle entre qualité de saisie et conformité normative.
 */

import React from 'react';
import { Trial } from '../../types/trial';
import { ScientificRuleSet } from '../../types/scientific';
import { getActiveFamiliesForStage } from '../../scientific/panelUtils';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  AlertCircle,
  FileCheck,
  HelpCircle
} from 'lucide-react';

interface Props {
  trial: Trial;
  ruleSet: ScientificRuleSet;
}

export function Tab07QualityControl({ trial, ruleSet }: Props) {
  const activePanels = trial.batches.flatMap((b) => b.panels).filter((p) => p.status === 'ACTIVE');
  const totalPanels = activePanels.length;

  let totalAcquisitionsExpected = 0;
  let totalAcquisitionsPresent = 0;
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const activeStages = trial.stages.filter((s) => s.status === 'VALIDATED' || s.status === 'IN_PROGRESS');

  for (const stage of activeStages) {
    if (stage.status === 'INACTIVE') continue;
    const stageApplicableFamilies = getActiveFamiliesForStage(trial.config.activeFamilies, stage);

    for (const panel of activePanels) {
      for (const fam of stageApplicableFamilies) {
        totalAcquisitionsExpected++;
        const key = `${stage.id}__${panel.id}__${fam}`;
        const rec = trial.acquisitions[key];
        if (rec && rec.computed) {
          totalAcquisitionsPresent++;
          if (rec.status === 'COMPLETE') validCount++;
          else if (rec.status === 'WARNING') warningCount++;
          else if (rec.status === 'ERROR') errorCount++;
        }
      }
    }
  }

  const completionRate =
    totalAcquisitionsExpected > 0
      ? Math.round((totalAcquisitionsPresent / totalAcquisitionsExpected) * 100)
      : 0;

  const qualityEvaluationLabel =
    totalAcquisitionsPresent === 0
      ? 'Évaluation non disponible (Aucune donnée saisie)'
      : errorCount > 0
      ? 'Anomalies bloquantes détectées (ERROR)'
      : warningCount > 0
      ? 'Avertissements qualité détectés (WARNING)'
      : 'Relevés métrologiques : GOOD';

  const qualityEvaluationClass =
    totalAcquisitionsPresent === 0
      ? 'text-slate-600'
      : errorCount > 0
      ? 'text-rose-700'
      : warningCount > 0
      ? 'text-amber-700'
      : 'text-emerald-700';

  return (
    <div className="space-y-6">
      {/* 1. BANNIÈRE STRICTE DE DÉCOUPLAGE QUALITÉ VS CONFORMITÉ NORMATIVE */}
      <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-4 text-xs text-blue-950 shadow-xs">
        <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="font-bold text-sm text-blue-950">
            Principe Cardinal de Traçabilité Métrologique
          </h4>
          <p className="leading-relaxed">
            La <strong>qualité des relevés</strong> (statut métrologique des séries brutes, dispersion, bornes physiques) est <strong>strictement indépendante de la conformité normative finale</strong> de l'essai ou du système de finition.
          </p>
          <div className="p-2.5 bg-white/80 border border-blue-200 rounded-xl font-bold text-blue-900 flex items-center gap-2">
            <span>État actuel :</span>
            <span className={qualityEvaluationClass}>{qualityEvaluationLabel}</span>
            <span>•</span>
            <span className="text-slate-600">Conformité normative NF EN 927-6 : NON ÉVALUÉE (En cours)</span>
          </div>
        </div>
      </div>

      {/* 2. STATISTIQUES GLOBALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux de Complétude</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">{completionRate} %</div>
          <p className="text-[11px] text-slate-500">
            {totalAcquisitionsPresent} relevés sur {totalAcquisitionsExpected} attendus
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Relevés Valides (GOOD)</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">{validCount}</div>
          <p className="text-[11px] text-slate-500">Aucune déviation ni dispersion suspecte</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Avertissements (WARNING)</span>
          <div className="text-2xl font-bold text-amber-700 font-mono">{warningCount}</div>
          <p className="text-[11px] text-slate-500">Dispersion ou écart de protocole détecté</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Invalides (ERROR)</span>
          <div className="text-2xl font-bold text-rose-700 font-mono">{errorCount}</div>
          <p className="text-[11px] text-slate-500">Points manquants ou incohérences physiques</p>
        </div>
      </div>

      {/* 3. CONTRÔLE PAR LOT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
          Contrôle Qualité par Lot Référentiel
        </h4>

        <div className="space-y-3">
          {trial.batches.map((batch) => {
            const batchActivePanels = batch.panels.filter((p) => p.status === 'ACTIVE');
            return (
              <div
                key={batch.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm text-slate-900">{batch.reference}</span>
                    <span className="text-slate-500">({batchActivePanels.length} éprouvettes actives)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{batch.coatingSystem}</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-slate-500 font-normal">Dispersion : Donnée non calculée</span>
                  <span className="text-slate-500 font-normal">Géométrie : Critère non implémenté</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                    Évaluation non disponible
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
