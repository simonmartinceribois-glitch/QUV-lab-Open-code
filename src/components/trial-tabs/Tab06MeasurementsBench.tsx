/**
 * QUV-Lab — 06 Poste de Paillasse & Saisie de Campagne (PROMPT 6 - Sections 14, 15, 16 & 17)
 * Ergonomie de paillasse optimisée : Campagne par Famille sur tous les lots et panneaux,
 * navigation rapide, calculs scientifiques instantanés, contrôle qualité temps-réel, NEXT automatique.
 */

import React, { useState, useEffect } from 'react';
import {
  Trial,
  PanelAcquisitionRecord,
  BatchDefinition,
  PanelDefinition
} from '../../types/trial';
import {
  MeasurementFamilyId,
  ScientificRuleSet,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  AdhesionRawData,
  VisualObservationsRawData,
  VisualObservationItem,
  QualityStatus
} from '../../types/scientific';
import { globalTrialStore, generateUUID } from '../../services/trialStore';
import {
  ISO2409_CLASSES,
  getApplicableGridSpacing,
  calculateDelayCompliance
} from '../../scientific/adhesionEngine';
import { isFamilyScheduledForStage, getActiveFamiliesForStage } from '../../scientific/panelUtils';
import {
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Layers,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  Zap,
  Info,
  Sliders,
  ShieldCheck,
  Ban
} from 'lucide-react';

interface Props {
  trial: Trial;
  selectedStageId: string;
  selectedFamilyId: MeasurementFamilyId;
  ruleSet: ScientificRuleSet;
  onStageChange?: (stageId: string) => void;
  onFamilyChange: (family: MeasurementFamilyId) => void;
  onTrialUpdated: () => void;
}

export function Tab06MeasurementsBench({
  trial,
  selectedStageId,
  selectedFamilyId,
  ruleSet,
  onStageChange,
  onFamilyChange,
  onTrialUpdated
}: Props) {
  // Gate 54 (D-1 / D-2 UI) : Les jalons INACTIVE sont exclus du plan de mesurage.
  // currentStage doit impérativement être résolu parmi les jalons actifs.
  const activeStages = trial.stages.filter((s) => s.status !== 'INACTIVE');
  const measuredStages = activeStages.filter(
    (s) => isFamilyScheduledForStage(selectedFamilyId, s)
  );
  const currentStage =
    activeStages.find((s) => s.id === selectedStageId) || measuredStages[0] || activeStages[0] || trial.stages[0];
  const isInitialStage = currentStage.cycleIndex === 0;
  const isStageInactive = currentStage.status === 'INACTIVE';

  // Synchronisation avec le parent si selectedStageId transmis était inactif
  useEffect(() => {
    if (selectedStageId && onStageChange) {
      const isSelectedActive = activeStages.some((s) => s.id === selectedStageId);
      if (!isSelectedActive && currentStage && currentStage.status !== 'INACTIVE') {
        onStageChange(currentStage.id);
      }
    }
  }, [selectedStageId, activeStages, currentStage, onStageChange]);

  // Redirection automatique si la famille actuelle n'est pas planifiée au jalon sélectionné (ex: ADHESION sur C1..C11)
  useEffect(() => {
    if (!isFamilyScheduledForStage(selectedFamilyId, currentStage)) {
      const allowedFams = getActiveFamiliesForStage(trial.config.activeFamilies, currentStage);
      const fallback = allowedFams[0] || 'COLOR';
      onFamilyChange(fallback);
    }
  }, [currentStage.id, selectedFamilyId, trial.config.activeFamilies, onFamilyChange]);

  // Liste plate des panneaux actifs
  const activePanelsList = trial.batches.flatMap((b) =>
    b.panels.filter((p) => p.status === 'ACTIVE').map((p) => ({ batch: b, panel: p }))
  );

  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    activePanelsList.length > 0 ? activePanelsList[0].panel.id : ''
  );

  const [operatorId, setOperatorId] = useState<string>('Simon Martin (Technicien)');
  const [showValidationSummaryModal, setShowValidationSummaryModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Panneau actif sélectionné
  const currentPanelItem = activePanelsList.find((item) => item.panel.id === selectedPanelId) || activePanelsList[0];
  const currentBatch = currentPanelItem?.batch;
  const currentPanel = currentPanelItem?.panel;

  // Configuration de la famille active
  const famConfig = trial.config.familyConfigs[selectedFamilyId];
  const colorCount = famConfig?.countConfig?.configuredCount || 4;
  const persozCount = famConfig?.countConfig?.configuredCount || 3;
  const glossSeries = famConfig?.seriesConfig?.configuredConfiguration.seriesCount || 2;
  const glossReadingsPerSeries = famConfig?.seriesConfig?.configuredConfiguration.readingsPerSeries || 2;

  // Acquisition en cours
  const acqKey = `${currentStage.id}__${currentPanel?.id}__${selectedFamilyId}`;
  const currentRecord = trial.acquisitions[acqKey];

  // --- ÉTATS LOCAUX DE SAISIE RAPIDE ---
  // Couleur : tableau de points L, a, b
  const [colorReadings, setColorReadings] = useState<{ L: string; a: string; b: string }[]>(() => {
    return Array.from({ length: colorCount }, () => ({ L: '', a: '', b: '' }));
  });

  // Brillance : séries de points
  const [glossSeriesData, setGlossSeriesData] = useState<{ orientation: string; values: string[] }[]>(() => {
    return [
      { orientation: 'Sens du fil', values: Array.from({ length: glossReadingsPerSeries }, () => '') },
      { orientation: 'Perpendiculaire', values: Array.from({ length: glossReadingsPerSeries }, () => '') }
    ];
  });

  // Persoz : répétitions en secondes
  const [persozValues, setPersozValues] = useState<string[]>(() => {
    return Array.from({ length: persozCount }, () => '');
  });

  // Observations : liste de cotations
  const [observations, setObservations] = useState<VisualObservationItem[]>([
    { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
    { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Aspect uniforme' }
  ]);

  // Adhérence au quadrillage : classe (0 à 5) et observation
  const [adhesionClass, setAdhesionClass] = useState<number | null>(0);
  const [adhesionObservation, setAdhesionObservation] = useState<string>('');

  // Synchronisation lors du changement de panneau ou famille
  useEffect(() => {
    if (!currentPanel) return;
    const rec = trial.acquisitions[`${currentStage.id}__${currentPanel.id}__${selectedFamilyId}`];

    if (selectedFamilyId === 'COLOR') {
      const raw = rec?.raw as ColorRawData;
      if (raw && Array.isArray(raw.readings)) {
        const arr = Array.from({ length: colorCount }, (_, i) => {
          const pt = raw.readings[i];
          return {
            L: pt?.L !== null && pt?.L !== undefined ? pt.L.toString() : '',
            a: pt?.a !== null && pt?.a !== undefined ? pt.a.toString() : '',
            b: pt?.b !== null && pt?.b !== undefined ? pt.b.toString() : ''
          };
        });
        setColorReadings(arr);
      } else {
        setColorReadings(Array.from({ length: colorCount }, () => ({ L: '', a: '', b: '' })));
      }
    } else if (selectedFamilyId === 'GLOSS') {
      const raw = rec?.raw as GlossRawData;
      if (raw && Array.isArray(raw.series)) {
        const arr = raw.series.map((s) => ({
          orientation: s.orientation,
          values: s.readings.map((r) => (r.value !== null && r.value !== undefined ? r.value.toString() : ''))
        }));
        setGlossSeriesData(arr);
      } else {
        setGlossSeriesData([
          { orientation: 'Sens du fil', values: Array.from({ length: glossReadingsPerSeries }, () => '') },
          { orientation: 'Perpendiculaire', values: Array.from({ length: glossReadingsPerSeries }, () => '') }
        ]);
      }
    } else if (selectedFamilyId === 'PERSOZ') {
      const raw = rec?.raw as PersozRawData;
      if (raw && Array.isArray(raw.readings)) {
        const arr = raw.readings.map((r) =>
          r.dampingTimeSeconds !== null && r.dampingTimeSeconds !== undefined ? r.dampingTimeSeconds.toString() : ''
        );
        setPersozValues(arr);
      } else {
        setPersozValues(Array.from({ length: persozCount }, () => ''));
      }
    } else if (selectedFamilyId === 'ADHESION') {
      const raw = rec?.raw as AdhesionRawData;
      if (raw && raw.adhesionClass !== undefined && raw.adhesionClass !== null) {
        setAdhesionClass(raw.adhesionClass);
        setAdhesionObservation(raw.observation || '');
      } else {
        setAdhesionClass(0);
        setAdhesionObservation('');
      }
    } else if (selectedFamilyId === 'OBSERVATIONS') {
      const raw = rec?.raw as VisualObservationsRawData;
      if (raw && Array.isArray(raw.observations)) {
        setObservations(raw.observations);
      } else {
        setObservations([
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Aspect uniforme' }
        ]);
      }
    }
  }, [selectedPanelId, selectedFamilyId, currentStage.id]);

  // Fonction d'enregistrement du panneau courant
  const handleSaveCurrentPanel = (autoAdvance = true) => {
    if (!currentPanel || !currentBatch) return;
    if (currentStage.status === 'INACTIVE') {
      alert("Ce jalon a été exclu du plan de mesurage ; aucune acquisition n'est autorisée.");
      return;
    }

    let rawPayload: unknown = null;

    if (selectedFamilyId === 'COLOR') {
      rawPayload = {
        readings: colorReadings.map((pt, idx) => ({
          pointIndex: idx + 1,
          L: pt.L !== '' ? parseFloat(pt.L) : null,
          a: pt.a !== '' ? parseFloat(pt.a) : null,
          b: pt.b !== '' ? parseFloat(pt.b) : null
        }))
      } as ColorRawData;
    } else if (selectedFamilyId === 'GLOSS') {
      rawPayload = {
        series: glossSeriesData.map((s, sIdx) => ({
          seriesIndex: sIdx + 1,
          orientation: s.orientation,
          readings: s.values.map((v, rIdx) => ({
            pointIndex: rIdx + 1,
            value: v !== '' ? parseFloat(v) : null
          }))
        })),
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-60-LAB', geometry: '60' }
      } as GlossRawData;
    } else if (selectedFamilyId === 'PERSOZ') {
      rawPayload = {
        readings: persozValues.map((v, idx) => ({
          pointIndex: idx + 1,
          dampingTimeSeconds: v !== '' ? parseFloat(v) : null
        })),
        unit: 'SECONDS',
        instrumentMetadata: { temperatureCelsius: 21.5, relativeHumidityPercent: 50 }
      } as PersozRawData;
    } else if (selectedFamilyId === 'ADHESION') {
      const spacingInfo = getApplicableGridSpacing(currentBatch.dryFilmThicknessMicrons);
      if (currentBatch.dryFilmThicknessMicrons === undefined || currentBatch.dryFilmThicknessMicrons === null || currentBatch.dryFilmThicknessMicrons > 250) {
        return;
      }
      rawPayload = {
        adhesionClass: adhesionClass !== null ? adhesionClass : 0,
        gridSpacingMm: spacingInfo.gridSpacingMm || 2,
        coatingThicknessMicrons: currentBatch.dryFilmThicknessMicrons,
        measurementDateTime: new Date().toISOString(),
        applicationDateTime: currentBatch.applicationDate,
        requiredMinimumDelayHours: 168,
        normReference: 'NF EN ISO 2409:2020',
        observation: adhesionObservation.trim() || undefined
      } as AdhesionRawData;
    } else if (selectedFamilyId === 'OBSERVATIONS') {
      rawPayload = {
        observations,
        assessedBy: operatorId,
        assessedAt: new Date().toISOString()
      } as VisualObservationsRawData;
    }

    globalTrialStore.recordAcquisition({
      trialId: trial.id,
      stageId: currentStage.id,
      batchId: currentBatch.id,
      panelId: currentPanel.id,
      familyId: selectedFamilyId,
      raw: rawPayload,
      operatorId
    });

    setSaveSuccessMsg(`Enregistré : ${currentBatch.reference} — ${currentPanel.label}`);
    setTimeout(() => setSaveSuccessMsg(null), 2000);
    onTrialUpdated();

    // NEXT automatique vers le panneau suivant incomplet
    if (autoAdvance) {
      const currentIdx = activePanelsList.findIndex((item) => item.panel.id === currentPanel.id);
      // Chercher d'abord le prochain incomplet
      const nextIncomplete = activePanelsList.find((item, idx) => {
        if (idx <= currentIdx) return false;
        const key = `${currentStage.id}__${item.panel.id}__${selectedFamilyId}`;
        const r = trial.acquisitions[key];
        return !r || !r.computed;
      });

      if (nextIncomplete) {
        setSelectedPanelId(nextIncomplete.panel.id);
      } else if (currentIdx < activePanelsList.length - 1) {
        setSelectedPanelId(activePanelsList[currentIdx + 1].panel.id);
      }
    }
  };

  // Remplissage rapide / Import simulation
  const handleFastPrefill = () => {
    if (selectedFamilyId === 'COLOR') {
      setColorReadings([
        { L: '62.5', a: '8.4', b: '24.2' },
        { L: '62.3', a: '8.5', b: '24.1' },
        { L: '62.6', a: '8.3', b: '24.3' },
        { L: '62.4', a: '8.4', b: '24.2' }
      ]);
    } else if (selectedFamilyId === 'GLOSS') {
      setGlossSeriesData([
        { orientation: 'Sens du fil', values: ['44.5', '44.8'] },
        { orientation: 'Perpendiculaire', values: ['43.2', '43.6'] }
      ]);
    } else if (selectedFamilyId === 'PERSOZ') {
      setPersozValues(['85.2', '84.8', '85.5']);
    }
  };

  const computed = currentRecord?.computed as any;

  // Calcul du résumé de la campagne pour la famille
  const completedPanelsCount = activePanelsList.filter((item) => {
    const k = `${currentStage.id}__${item.panel.id}__${selectedFamilyId}`;
    const r = trial.acquisitions[k];
    return r && r.computed;
  }).length;

  const totalPanelsCount = activePanelsList.length;
  const isFamilyCampaignComplete = completedPanelsCount === totalPanelsCount && totalPanelsCount > 0;

  const currentMeasuredIndex = measuredStages.findIndex((s) => s.id === currentStage.id);
  const stageStepNumber = currentMeasuredIndex >= 0 ? currentMeasuredIndex + 1 : 1;
  const totalStagesCount = measuredStages.length;

  const stageHoursDisplay =
    currentStage.cycleIndex === 0
      ? 'T0 (0 h)'
      : `C${currentStage.cycleIndex} (${currentStage.scheduledExposureHours} h)`;

  const stageActionLabel =
    currentStage.stageType === 'INITIAL_PRE_EXPOSURE'
      ? 'MESURES INITIALES AVANT EXPOSITION'
      : currentStage.stageType === 'FINAL_POST_EXPOSURE'
      ? 'MESURES FINALES APRÈS EXPOSITION'
      : "MESURES EN COURS D'EXPOSITION";

  return (
    <div className="space-y-6">
      {/* 1. TOP BAR : Sélecteur de Famille de Mesure & Étape Active Normative */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-mono font-bold tracking-wider uppercase">
              JALON {stageStepNumber} / {totalStagesCount}
            </span>
            <span className="text-sm font-bold text-white font-mono">{stageHoursDisplay}</span>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              {stageActionLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Poste de Mesure de Paillasse par Famille • {currentStage.name}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {(['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION', 'OBSERVATIONS'] as MeasurementFamilyId[]).map((fam) => {
            const isSelected = selectedFamilyId === fam;
            const isEnabled = trial.config.activeFamilies.includes(fam);
            if (!isEnabled) return null;
            // Règle canonique : ADHESION = T0 et C12 uniquement. À C1..C11, le bouton ne doit simplement pas être rendu.
            if (!isFamilyScheduledForStage(fam, currentStage)) return null;

            return (
              <button
                key={fam}
                onClick={() => onFamilyChange(fam)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>
                  {fam === 'COLOR'
                    ? '🎨 Couleur'
                    : fam === 'GLOSS'
                    ? '✨ Brillance'
                    : fam === 'PERSOZ'
                    ? '⏱️ Persoz'
                    : fam === 'ADHESION'
                    ? '✂️ Adhérence'
                    : '🔍 Observations'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1b. BANDEAU DE SÉLECTION DU JALON DE MESURAGE DU PLAN */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-x-auto w-full">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
            Jalons planifiés :
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {measuredStages.map((st) => {
              const isSelected = st.id === currentStage.id;
              const label = st.cycleIndex === 0 ? 'T0' : `C${st.cycleIndex}`;
              const hoursLabel = st.cycleIndex === 0 ? '0 h' : `${st.scheduledExposureHours} h`;

              // Complétude de ce jalon pour la famille active
              const isCompleted = activePanelsList.length > 0 && activePanelsList.every((item) => {
                const k = `${st.id}__${item.panel.id}__${selectedFamilyId}`;
                return trial.acquisitions[k]?.computed !== null && trial.acquisitions[k]?.computed !== undefined;
              });

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onStageChange && onStageChange(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                    ({hoursLabel})
                  </span>
                  {isCompleted && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" title="Saisie complète" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerte jalon inactif (Gate 54 D-1 / D-2 UI) */}
      {isStageInactive && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold shadow-xs">
          <Ban className="w-5 h-5 text-rose-600 shrink-0" />
          <span>Ce jalon n'est pas actif dans le plan de mesurage. La saisie et l'enregistrement de mesures y sont strictement interdits.</span>
        </div>
      )}

      {/* 2. GRILLE PANORAMIQUE DES ÉPROUVETTES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Éprouvettes de la Campagne ({completedPanelsCount}/{totalPanelsCount})
            </span>
            <span className="text-xs text-slate-500 font-mono">
              • {Math.round((completedPanelsCount / (totalPanelsCount || 1)) * 100)}% complété
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowValidationSummaryModal(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isFamilyCampaignComplete
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Validation Campagne ({selectedFamilyId})
          </button>
        </div>

        {/* Matrice des boutons d'éprouvettes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {activePanelsList.map(({ batch, panel }) => {
            const isSelected = panel.id === currentPanel?.id;
            const rec = trial.acquisitions[`${currentStage.id}__${panel.id}__${selectedFamilyId}`];
            const isDone = !!rec && !!rec.computed;
            const hasWarning = rec?.status === 'WARNING';
            const hasError = rec?.status === 'ERROR';

            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => setSelectedPanelId(panel.id)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20'
                    : isDone
                    ? hasError
                      ? 'border-rose-300 bg-rose-50/50'
                      : hasWarning
                      ? 'border-amber-300 bg-amber-50/50'
                      : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="text-[10px] text-slate-500 font-mono truncate">{batch.reference}</div>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="text-slate-900">{panel.label}</span>
                  <span>
                    {isDone ? (
                      hasError ? (
                        '🔴'
                      ) : hasWarning ? (
                        '🟡'
                      ) : (
                        '🟢'
                      )
                    ) : (
                      '⚪'
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. POSTE DE SAISIE DE PAILLASSE DU PANNEAU ACTIF */}
      {currentPanel && currentBatch && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne Gauche : Formulaire de saisie (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header du panneau */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-blue-100 text-blue-800">
                    {currentBatch.reference}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900">Éprouvette {currentPanel.label}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentBatch.coatingSystem || 'Finition standard'} • Essence : {currentBatch.woodSpecies || 'Chêne'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFastPrefill}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
                  title="Pré-remplissage rapide pour test"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Test Rapide
                </button>
              </div>
            </div>

            {/* Formulaire spécifique à la famille */}
            {/* --- COULEUR --- */}
            {selectedFamilyId === 'COLOR' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saisie des {colorCount} coordonnées colorimétriques (CIE L*a*b*)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">D65 / 10°</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2 px-3 text-left">Point</th>
                        <th className="py-2 px-3 text-center">L* (Clarté)</th>
                        <th className="py-2 px-3 text-center">a* (Axe Vert-Rouge)</th>
                        <th className="py-2 px-3 text-center">b* (Axe Bleu-Jaune)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {colorReadings.map((reading, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">Pt #{idx + 1}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.L}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, L: val } : r)));
                              }}
                              placeholder="ex: 62.4"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.a}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, a: val } : r)));
                              }}
                              placeholder="ex: 8.2"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={reading.b}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColorReadings(colorReadings.map((r, i) => (i === idx ? { ...r, b: val } : r)));
                              }}
                              placeholder="ex: 24.1"
                              className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- BRILLANCE --- */}
            {selectedFamilyId === 'GLOSS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saisie Brillance 60° par Séries & Orientations
                  </span>
                  <span className="text-xs text-slate-500 font-mono">NF EN 927-6 Clause 6.3.3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {glossSeriesData.map((series, sIdx) => (
                    <div key={sIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 font-mono">
                          Série #{sIdx + 1} : {series.orientation}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {series.values.map((val, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-mono">Relevé #{rIdx + 1} :</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.1"
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setGlossSeriesData(
                                    glossSeriesData.map((s, i) =>
                                      i === sIdx
                                        ? { ...s, values: s.values.map((v, j) => (j === rIdx ? newVal : v)) }
                                        : s
                                    )
                                  );
                                }}
                                placeholder="ex: 45.0"
                                className="w-24 px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-[11px] font-bold text-slate-400">GU</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- PERSOZ --- */}
            {selectedFamilyId === 'PERSOZ' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                    Saisie du Temps d'Amortissement Persoz (Secondes)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800">
                    Recommandation Labo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {persozValues.map((val, idx) => (
                    <div key={idx} className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-purple-900">Répétition #{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={val}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setPersozValues(persozValues.map((v, i) => (i === idx ? newVal : v)));
                          }}
                          placeholder="ex: 85.0"
                          className="w-full px-2 py-1.5 text-center font-bold bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-xs font-bold text-purple-700">s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- ADHÉRENCE — ESSAI AU QUADRILLAGE (NF EN ISO 2409:2020) --- */}
            {selectedFamilyId === 'ADHESION' && (() => {
              const thickness = currentBatch?.dryFilmThicknessMicrons;
              const spacingResult = getApplicableGridSpacing(thickness);
              const delayResult = calculateDelayCompliance(currentBatch?.applicationDate, new Date().toISOString(), 168);
              const isWitness = currentPanel?.role === 'WITNESS' || currentPanel?.index === 1;

              return (
                <div className="space-y-4">
                  {/* 1. Cadre de préparation et traçabilité ISO 2409 (Section 7) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        Paramètres Préparatoires du Quadrillage — NF EN ISO 2409:2020
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-md">
                        Évaluation qualitative de séparation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="text-slate-500 text-[11px]">Lot & Subjectile :</div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {currentBatch?.reference} ({currentBatch?.woodSpecies || 'Bois'})
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="text-slate-500 text-[11px]">Épaisseur sèche (ISO 2808) :</div>
                        <div className={`font-bold mt-0.5 ${thickness !== undefined && thickness <= 250 ? 'text-indigo-900' : 'text-rose-600'}`}>
                          {thickness !== undefined ? `${thickness} µm` : '⚠️ Non renseignée'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="text-slate-500 text-[11px]">Espacement requis du peigne :</div>
                        <div className={`font-bold mt-0.5 ${thickness !== undefined && thickness <= 250 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {thickness !== undefined && thickness <= 250 ? `${spacingResult.gridSpacingMm} mm (6×6 incisions)` : '🔴 Bloqué'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="text-slate-500 text-[11px]">Conditionnement avant essai :</div>
                        <div className="font-bold text-slate-800 mt-0.5">23 ± 2 °C / 50 ± 5 % HR (≥ 16 h)</div>
                      </div>
                    </div>

                    {/* Traçabilité du délai d'application */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg gap-2">
                      <div>
                        <span className="text-slate-500 font-medium">Application finition : </span>
                        <span className="font-mono font-bold text-slate-800">{currentBatch?.applicationDate || 'Non renseignée'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Délai écoulé : </span>
                        {delayResult.elapsedTimeHours !== null ? (
                          <span className={`font-bold ${delayResult.status === 'CONFORME' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {Math.floor(delayResult.elapsedTimeHours / 24)} j {Math.round(delayResult.elapsedTimeHours % 24)} h ({delayResult.status === 'CONFORME' ? '✅ Conforme ≥ 168 h' : '⚠️ < 168 h'})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Date d'application manquante</span>
                        )}
                      </div>
                    </div>

                    {/* Ségrégation T0 / Exposition */}
                    {isInitialStage ? (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Étape T0 (Initial) :</strong> Mesure de référence réalisée sur l'éprouvette Témoin <strong>{currentBatch?.reference}-T</strong>. Cette donnée brute initiale est sanctuarisée et ne sera jamais écrasée par les mesures d'exposition.
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Étape d'Exposition ({currentStage.name}) :</strong> Évaluation de la résistance à la séparation après vieillissement accéléré sur éprouvette exposée <strong>{currentBatch?.reference}-{currentPanel?.label}</strong>.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Garde-fous normatifs */}
                  {thickness === undefined && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-2">
                      <div className="font-bold flex items-center gap-2 text-sm text-rose-800">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        Donnée manquante — Épaisseur sèche du revêtement requise
                      </div>
                      <p>
                        Conformément à la NF EN ISO 2409:2020, l'espacement du peigne de quadrillage dépend strictement de l'épaisseur du film sec (≤ 60 µm : 1 mm sur subjectile dur ou 2 mm sur bois ; 61–120 µm : 2 mm ; 121–250 µm : 3 mm).
                      </p>
                      <p className="font-bold">
                        La saisie du résultat d'adhérence est bloquée tant que l'épaisseur sèche du lot n'est pas renseignée dans l'onglet Lots & Éprouvettes.
                      </p>
                    </div>
                  )}

                  {thickness !== undefined && thickness > 250 && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-2">
                      <div className="font-bold flex items-center gap-2 text-sm text-rose-800">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        🔴 Méthode non appropriée (Épaisseur {thickness} µm &gt; 250 µm)
                      </div>
                      <p>
                        La NF EN ISO 2409:2020 spécifie formellement que l'essai de quadrillage ne s'applique pas aux revêtements dont l'épaisseur totale est supérieure à 250 µm.
                      </p>
                      <p className="font-bold">
                        La saisie est bloquée conformément au domaine d'application de la norme.
                      </p>
                    </div>
                  )}

                  {/* 3. Sélecteur interactif des Classes de Quadrillage ISO 2409 */}
                  {thickness !== undefined && thickness <= 250 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Classification visuelle du quadrillage (ISO 2409:2020)
                        </span>
                        <span className="text-xs text-slate-500">
                          Espacement retenu : <strong>{spacingResult.gridSpacingMm} mm</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {Object.values(ISO2409_CLASSES).map((cls) => {
                          const isSelected = adhesionClass === cls.rating;
                          return (
                            <button
                              key={cls.rating}
                              type="button"
                              onClick={() => setAdhesionClass(cls.rating)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                                  cls.rating === 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : cls.rating === 1
                                    ? 'bg-blue-100 text-blue-800'
                                    : cls.rating === 2
                                    ? 'bg-amber-100 text-amber-800'
                                    : cls.rating === 3
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  Classe {cls.rating}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500">
                                  Détachement : {cls.affectedAreaPercent}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-800 mb-1">{cls.shortLabel}</div>
                              <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">{cls.description}</p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Observations de l'opérateur */}
                      <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Observations spécifiques sur le quadrillage (facultatif) :
                        </label>
                        <input
                          type="text"
                          value={adhesionObservation}
                          onChange={(e) => setAdhesionObservation(e.target.value)}
                          placeholder="Ex : Rupture cohésive dans le bois, détachement net sur fil du bois, petits éclats aux croisillons..."
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* --- OBSERVATIONS --- */}
            {selectedFamilyId === 'OBSERVATIONS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cotations des Défauts d'Aspect (ISO 4628 / ISO 2409)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">0 = Intact, 5 = Altération Sévère</span>
                </div>

                <div className="space-y-2.5">
                  {observations.map((obs, idx) => (
                    <div
                      key={obs.category}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="sm:w-1/3">
                        <span className="font-bold text-slate-900">{obs.categoryLabel}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-slate-500 font-semibold">Note :</label>
                        <select
                          value={obs.rating}
                          onChange={(e) => {
                            const rVal = parseInt(e.target.value, 10);
                            setObservations(
                              observations.map((o, i) =>
                                i === idx
                                  ? {
                                      ...o,
                                      rating: rVal,
                                      status: rVal === 0 ? 'CONFORME' : 'OBSERVE',
                                      comment: rVal === 0 ? 'Aucun' : `Défaut note ${rVal}`
                                    }
                                  : o
                              )
                            );
                          }}
                          className="px-2 py-1 font-bold bg-white border border-slate-300 rounded-lg"
                        >
                          <option value={0}>0 — Aucun défaut</option>
                          <option value={1}>1 — Très léger</option>
                          <option value={2}>2 — Modéré</option>
                          <option value={3}>3 — Prononcé (Alerte)</option>
                          <option value={4}>4 — Très prononcé</option>
                          <option value={5}>5 — Rupture / Destruction</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={obs.comment || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setObservations(observations.map((o, i) => (i === idx ? { ...o, comment: val } : o)));
                          }}
                          placeholder="Remarques éventuelles..."
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions de validation du panneau */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                {saveSuccessMsg && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                    <Check className="w-4 h-4" />
                    {saveSuccessMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isStageInactive}
                  onClick={() => handleSaveCurrentPanel(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all ${
                    isStageInactive
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
                <button
                  type="button"
                  disabled={isStageInactive}
                  onClick={() => handleSaveCurrentPanel(true)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
                    isStageInactive
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider ce Panneau & Passer au Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Calculs Scientifiques Instantanés & Contrôle Qualité (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Card Qualité du relevé */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Contrôle Qualité Temps-Réel
                </h5>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    computed?.qualityAssessment?.status === 'GOOD'
                      ? 'bg-emerald-100 text-emerald-800'
                      : computed?.qualityAssessment?.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-800'
                      : computed?.qualityAssessment?.status === 'INVALID'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {computed?.qualityAssessment?.status || 'EN_ATTENTE'}
                </span>
              </div>

              {computed?.qualityAssessment ? (
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Points valides :</span>
                    <strong className="text-slate-900">
                      {computed.qualityAssessment.validCount} / {computed.qualityAssessment.totalCount}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Complétude :</span>
                    <strong className="text-emerald-700">
                      {computed.qualityAssessment.completionRatePercent}%
                    </strong>
                  </div>

                  {/* Alertes éventuelles */}
                  {currentRecord?.alerts && currentRecord.alerts.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                        Alertes Métrologiques :
                      </span>
                      {currentRecord.alerts.map((al, aIdx) => (
                        <div
                          key={aIdx}
                          className={`p-2 rounded-lg text-[11px] font-medium flex items-start gap-1.5 ${
                            al.severity === 'BLOCKING'
                              ? 'bg-rose-50 border border-rose-200 text-rose-800'
                              : 'bg-amber-50 border border-amber-200 text-amber-900'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{al.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Saisissez les points et enregistrez pour déclencher l'évaluation.
                </div>
              )}
            </div>

            {/* Card Grandeurs Calculées Instantanées */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
                Grandeurs Dérivées (Moteur PROMPT 5)
              </h5>

              {computed ? (
                <div className="space-y-2.5 text-xs text-slate-700 font-mono">
                  {/* COULEUR */}
                  {selectedFamilyId === 'COLOR' && (
                    <>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne L* :</span>
                        <strong>{computed.meanL !== null ? computed.meanL.toFixed(2) : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne a* :</span>
                        <strong>{computed.meanA !== null ? computed.meanA.toFixed(2) : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne b* :</span>
                        <strong>{computed.meanB !== null ? computed.meanB.toFixed(2) : '—'}</strong>
                      </div>
                      {!isInitialStage && (
                        <div className="flex justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-bold">
                          <span>Écart Total ΔE*ab :</span>
                          <span>{computed.deltaE !== null ? computed.deltaE.toFixed(2) : '—'}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* BRILLANCE */}
                  {selectedFamilyId === 'GLOSS' && (
                    <>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Moyenne Brillance :</span>
                        <strong>{computed.meanGloss !== null ? `${computed.meanGloss.toFixed(1)} GU` : '—'}</strong>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span>Écart-type s :</span>
                        <strong>{computed.stdDevGloss !== null ? computed.stdDevGloss.toFixed(2) : '—'}</strong>
                      </div>
                      {!isInitialStage && (
                        <div className="flex justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-bold">
                          <span>Taux de Rétention :</span>
                          <span>
                            {computed.retentionRatePercent !== null
                              ? `${computed.retentionRatePercent.toFixed(1)} %`
                              : '—'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* PERSOZ */}
                  {selectedFamilyId === 'PERSOZ' && (
                    <>
                      <div className="flex justify-between p-2 bg-purple-50 rounded-lg text-purple-950">
                        <span>Moyenne Amortissement :</span>
                        <strong>
                          {computed.meanDampingTime !== null ? `${computed.meanDampingTime.toFixed(1)} s` : '—'}
                        </strong>
                      </div>
                      <div className="flex justify-between p-2 bg-purple-50 rounded-lg text-purple-950">
                        <span>Coeff. Variation CV% :</span>
                        <strong>
                          {computed.coefficientOfVariationPercent !== null
                            ? `${computed.coefficientOfVariationPercent.toFixed(1)} %`
                            : '—'}
                        </strong>
                      </div>
                    </>
                  )}

                  {/* ADHESION */}
                  {selectedFamilyId === 'ADHESION' && (
                    <>
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Classe d'Adhérence :</span>
                          <span className="px-2.5 py-0.5 bg-indigo-600 text-white font-bold rounded-lg text-sm">
                            Classe {computed.adhesionClass ?? '—'}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-900 italic leading-relaxed">{computed.classDescription}</p>
                      </div>

                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-xs">
                        <span className="text-slate-600">Peigne de quadrillage :</span>
                        <strong>{computed.gridSpacingUsedMm ? `${computed.gridSpacingUsedMm} mm (6×6)` : '—'}</strong>
                      </div>

                      <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-xs">
                        <span className="text-slate-600">Délai d'application :</span>
                        <strong>{computed.elapsedTimeHours !== undefined && computed.elapsedTimeHours !== null ? `${computed.elapsedTimeHours} h` : '—'}</strong>
                      </div>

                      {!isInitialStage && computed.witnessT0AdhesionClass !== undefined && (
                        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>Évolution vs T0 :</span>
                            <span>
                              {computed.deltaAdhesionClass !== null && computed.deltaAdhesionClass !== undefined
                                ? (computed.deltaAdhesionClass >= 0 ? `+${computed.deltaAdhesionClass}` : `${computed.deltaAdhesionClass}`)
                                : '—'}
                            </span>
                          </div>
                          <div className="text-[11px] text-blue-700">
                            (Classe {computed.adhesionClass} actuelle vs Classe {computed.witnessT0AdhesionClass} à T0 sur témoin)
                          </div>
                        </div>
                      )}

                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                        <strong>Rappel normatif NF EN ISO 2409:2020 :</strong>
                        <p className="mt-0.5">
                          L'essai au quadrillage est une méthode empirique d'évaluation de la résistance à la séparation. Ne jamais convertir en contrainte d'adhérence en MPa ni en conformité automatique.
                        </p>
                      </div>
                    </>
                  )}

                  {/* OBSERVATIONS */}
                  {selectedFamilyId === 'OBSERVATIONS' && (
                    <>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-500">Synthèse :</span>
                        <div className="font-sans font-bold text-slate-900 mt-1">{computed.summary}</div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Aucun calcul disponible.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉCAPITULATIF AVANT VALIDATION DE CAMPAGNE FAMILLE */}
      {showValidationSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Validation de Campagne — {selectedFamilyId}
                </h4>
              </div>
              <button
                onClick={() => setShowValidationSummaryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-slate-700 mb-1">
                Bilan de Complétude & Qualité :
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Panneaux actifs attendus : <strong>{totalPanelsCount}</strong>
                </div>
                <div>
                  Panneaux mesurés : <strong>{completedPanelsCount}</strong>
                </div>
                <div>
                  Taux de réalisation :{' '}
                  <strong className="text-emerald-700">
                    {Math.round((completedPanelsCount / (totalPanelsCount || 1)) * 100)}%
                  </strong>
                </div>
                <div>
                  Statut de campagne :{' '}
                  <strong className={isFamilyCampaignComplete ? 'text-emerald-700' : 'text-amber-700'}>
                    {isFamilyCampaignComplete ? 'COMPLÈTE' : 'INCOMPLÈTE'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                La validation atteste de la complétude et de la qualité métrologique des relevés pour cette famille à l'étape <strong>{currentStage.name}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValidationSummaryModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                {selectedFamilyId !== 'OBSERVATIONS' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowValidationSummaryModal(false);
                      const fams = getActiveFamiliesForStage(trial.config.activeFamilies, currentStage);
                      const curIdx = fams.indexOf(selectedFamilyId);
                      if (curIdx < fams.length - 1) {
                        onFamilyChange(fams[curIdx + 1]);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    Passer à la Famille Suivante
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
