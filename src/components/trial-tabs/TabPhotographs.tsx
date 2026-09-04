/**
 * QUV-Lab — MODULE PHOTOTHÈQUE & SUIVI VISUEL TEMPOREL (NF EN 927-6)
 *
 * RÈGLE FONDAMENTALE :
 * La Photothèque est un module transversal INDÉPENDANT des familles de mesure (Couleur, Brillance, Persoz, Adhérence, Observations).
 * Une mesure scientifique n'est JAMAIS bloquée par l'absence d'une photo.
 * L'absence de cliché sur un jalon est un choix opératoire et n'est JAMAIS une anomalie.
 *
 * ARCHITECTURE RELATIONNELLE STRICTE :
 * ESSAI → LOT → ÉCHANTILLON → JALON
 * Traçabilité intégrale : ID, Lot, Échantillon, Jalon, Heures cumulées, Date/Heure, Opérateur, Fichier, Légende, Statut (Actif/Archivé).
 *
 * FONCTIONNALITÉS CLÉS :
 * 1. Navigation hiérarchique prioritaire : Essai → Lot → Échantillon → Chronologie
 * 2. Comparateur temporel interactif à N jalons (2, 3, 4, N photographies côte à côte)
 * 3. Garde-fou normatif interdisant ou signalant toute comparaison erronée inter-échantillons
 * 4. Planche d'évolution photographique normalisée pour analyse et rapport
 * 5. Matrice synoptique globale & Galerie multi-critères
 * 6. Remplacement contrôlé avec archivage non-destructif (Gate 2.2)
 */

import React, { useState, useMemo } from 'react';
import { Trial, MediaReference, BatchDefinition, PanelDefinition, ExposureStage } from '../../types/trial';
import { globalTrialStore } from '../../services/trialStore';
import {
  Camera,
  Upload,
  Filter,
  Grid,
  Columns,
  Layers,
  Clock,
  Trash2,
  Maximize2,
  X,
  Plus,
  Calendar,
  User,
  Info,
  CheckCircle2,
  Tag,
  Compass,
  Eye,
  SlidersHorizontal,
  Download,
  AlertCircle,
  Archive,
  History,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Split,
  ChevronRight,
  Folder,
  Sliders,
  Sparkles,
  FileImage,
  Printer,
  ZoomIn,
  ArrowRight
} from 'lucide-react';

interface Props {
  trial: Trial;
  onTrialUpdated: () => void;
}

type PhotothequeViewMode = 'SPECIMEN_TIMELINE' | 'TEMPORAL_COMPARE' | 'MATRIX' | 'GALLERY';

export function TabPhotographs({ trial, onTrialUpdated }: Props) {
  // Mode d'affichage principal
  const [viewMode, setViewMode] = useState<PhotothequeViewMode>('SPECIMEN_TIMELINE');

  // Navigation hiérarchique : Lot actif et Éprouvette active
  const firstBatch = trial.batches[0];
  const firstPanel = firstBatch?.panels[0];

  const [activeBatchId, setActiveBatchId] = useState<string>(firstBatch?.id || '');
  const [activePanelId, setActivePanelId] = useState<string>(firstPanel?.id || '');

  // Sélection pour le mode "Comparer les photographies" (IDs des médias sélectionnés)
  const [selectedPhotoIdsForCompare, setSelectedPhotoIdsForCompare] = useState<string[]>([]);

  // Filtres galerie
  const [selectedGalleryBatchId, setSelectedGalleryBatchId] = useState<string>('ALL');
  const [selectedGalleryStageId, setSelectedGalleryStageId] = useState<string>('ALL');
  const [selectedGallerySpecimenRole, setSelectedGallerySpecimenRole] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Ajout / Remplacement
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhotoBatchId, setNewPhotoBatchId] = useState<string>(firstBatch?.id || '');
  const [newPhotoPanelId, setNewPhotoPanelId] = useState<string>(firstPanel?.id || '');
  const [newPhotoStageId, setNewPhotoStageId] = useState<string>(trial.stages[0]?.id || '');
  const [newPhotoCaption, setNewPhotoCaption] = useState<string>('');
  const [newPhotoFace, setNewPhotoFace] = useState<string>('Face externe');
  const [newPhotoOperator, setNewPhotoOperator] = useState<string>(trial.metadata.createdBy || 'Simon Martin (Technicien)');
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lightbox
  const [lightboxMedia, setLightboxMedia] = useState<MediaReference | null>(null);

  // Mappings
  const panelMap = useMemo(() => {
    const map = new Map<string, { panel: PanelDefinition; batch: BatchDefinition }>();
    trial.batches.forEach((batch) => {
      batch.panels.forEach((panel) => {
        map.set(panel.id, { panel, batch });
      });
    });
    return map;
  }, [trial.batches]);

  const stageMap = useMemo(() => {
    const map = new Map<string, ExposureStage>();
    trial.stages.forEach((st) => {
      map.set(st.id, st);
    });
    return map;
  }, [trial.stages]);

  // Échantillon actif pour la navigation
  const activeBatch = useMemo(() => {
    return trial.batches.find((b) => b.id === activeBatchId) || trial.batches[0];
  }, [trial.batches, activeBatchId]);

  const activePanel = useMemo(() => {
    if (!activeBatch) return null;
    return activeBatch.panels.find((p) => p.id === activePanelId) || activeBatch.panels[0] || null;
  }, [activeBatch, activePanelId]);

  // Synchroniser si l'échantillon change
  const handleSelectSpecimen = (batchId: string, panelId: string) => {
    setActiveBatchId(batchId);
    setActivePanelId(panelId);
    // Auto-sélectionner les photos de cet échantillon pour la comparaison
    const photosOfThisPanel = trial.mediaReferences
      .filter((m) => m.type === 'PHOTO' && m.panelId === panelId && m.status !== 'ARCHIVED')
      .map((m) => m.id);
    setSelectedPhotoIdsForCompare(photosOfThisPanel);
  };

  // Détection d'un cliché actif existant dans le modal
  const existingActivePhotoInModal = useMemo(() => {
    if (!newPhotoPanelId || !newPhotoStageId) return null;
    return (
      trial.mediaReferences.find(
        (m) =>
          m.type === 'PHOTO' &&
          m.panelId === newPhotoPanelId &&
          m.stageId === newPhotoStageId &&
          m.status !== 'ARCHIVED'
      ) || null
    );
  }, [trial.mediaReferences, newPhotoPanelId, newPhotoStageId]);

  // Photographies actives de l'échantillon actuellement sélectionné
  const activePanelPhotos = useMemo(() => {
    if (!activePanel) return [];
    return trial.mediaReferences
      .filter((m) => m.type === 'PHOTO' && m.panelId === activePanel.id)
      .sort((a, b) => {
        const stA = a.stageId ? stageMap.get(a.stageId)?.cycleIndex ?? 0 : 0;
        const stB = b.stageId ? stageMap.get(b.stageId)?.cycleIndex ?? 0 : 0;
        return stA - stB;
      });
  }, [trial.mediaReferences, activePanel, stageMap]);

  // Photographies sélectionnées pour la comparaison temporelle
  const comparedPhotos = useMemo(() => {
    const list = trial.mediaReferences.filter((m) => selectedPhotoIdsForCompare.includes(m.id) && m.type === 'PHOTO');
    // Trier dans l'ordre chronologique strict (cycleIndex croissant)
    return list.sort((a, b) => {
      const stA = a.stageId ? stageMap.get(a.stageId)?.cycleIndex ?? 0 : 0;
      const stB = b.stageId ? stageMap.get(b.stageId)?.cycleIndex ?? 0 : 0;
      return stA - stB;
    });
  }, [trial.mediaReferences, selectedPhotoIdsForCompare, stageMap]);

  // Garde-fou : Vérification si toutes les photos comparées appartiennent au MÊME échantillon
  const compareIntegrityCheck = useMemo(() => {
    if (comparedPhotos.length <= 1) return { isSamePanel: true, panelIds: [] };
    const panelIds = Array.from(new Set(comparedPhotos.map((p) => p.panelId).filter(Boolean)));
    return {
      isSamePanel: panelIds.length <= 1,
      panelIds
    };
  }, [comparedPhotos]);

  // Liste filtrée des photos pour le mode GALERIE
  const filteredGalleryPhotos = useMemo(() => {
    return trial.mediaReferences.filter((media) => {
      if (media.type !== 'PHOTO') return false;

      if (!showArchived && media.status === 'ARCHIVED') return false;

      if (selectedGalleryBatchId !== 'ALL') {
        const info = media.panelId ? panelMap.get(media.panelId) : null;
        if (!info || info.batch.id !== selectedGalleryBatchId) return false;
      }

      if (selectedGalleryStageId !== 'ALL' && media.stageId !== selectedGalleryStageId) {
        return false;
      }

      if (selectedGallerySpecimenRole !== 'ALL' && media.panelId) {
        const info = panelMap.get(media.panelId);
        if (!info) return false;
        if (selectedGallerySpecimenRole === 'WITNESS' && info.panel.label !== 'T') return false;
        if (selectedGallerySpecimenRole === 'EXPOSED' && info.panel.label === 'T') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const captionMatch = media.caption?.toLowerCase().includes(q);
        const filenameMatch = media.filename?.toLowerCase().includes(q);
        const operatorMatch = media.capturedBy?.toLowerCase().includes(q);
        if (!captionMatch && !filenameMatch && !operatorMatch) return false;
      }

      return true;
    });
  }, [
    trial.mediaReferences,
    selectedGalleryBatchId,
    selectedGalleryStageId,
    selectedGallerySpecimenRole,
    showArchived,
    searchQuery,
    panelMap
  ]);

  // Gestion du fichier image
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewPhotoDataUrl(result);
      setUploadError(null);
    };
    reader.onerror = () => {
      setUploadError('Erreur lors de la lecture du fichier image.');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModalForStage = (batchId: string, panelId: string, stageId: string) => {
    setNewPhotoBatchId(batchId);
    setNewPhotoPanelId(panelId);
    setNewPhotoStageId(stageId);
    setNewPhotoCaption('');
    setNewPhotoDataUrl('');
    setUploadError(null);
    setShowAddModal(true);
  };

  const handleSavePhoto = () => {
    if (!newPhotoPanelId || !newPhotoStageId) {
      setUploadError('Veuillez sélectionner une éprouvette et un jalon.');
      return;
    }

    const info = panelMap.get(newPhotoPanelId);
    const stage = stageMap.get(newPhotoStageId);
    const label = info ? `${info.batch.reference}-${info.panel.label}` : 'Echantillon';
    const stageName = stage ? stage.name : 'Jalon';
    const filename = `PHOTO_${label.replace(/\s+/g, '_')}_${stage ? stage.cycleIndex : 0}_${Date.now()}.jpg`;

    // Générer une image par défaut haute fidélité si l'utilisateur n'a pas chargé d'image physique
    const defaultDataUrl =
      newPhotoDataUrl ||
      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bgnew" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%2378350f"/></linearGradient><pattern id="woodpat" width="40" height="10" patternUnits="userSpaceOnUse"><path d="M 0 5 Q 20 0 40 5" stroke="%23ffffff" stroke-width="0.5" stroke-opacity="0.15" fill="none"/></pattern></defs><rect width="600" height="400" fill="url(%23bgnew)"/><rect width="600" height="400" fill="url(%23woodpat)"/><rect x="20" y="20" width="560" height="360" rx="14" fill="none" stroke="%23ffffff" stroke-width="1.5" stroke-opacity="0.35"/><rect x="35" y="35" width="220" height="32" rx="8" fill="%230f172a" fill-opacity="0.85"/><text x="45" y="56" font-family="monospace" font-size="13" font-weight="bold" fill="%2338bdf8">${label}</text><rect x="420" y="35" width="145" height="32" rx="8" fill="%231e293b" fill-opacity="0.85"/><text x="492" y="56" font-family="monospace" font-size="13" font-weight="bold" fill="%23fbbf24" text-anchor="middle">${stage?.name || 'Jalon'}</text><rect x="35" y="295" width="530" height="70" rx="10" fill="%23020617" fill-opacity="0.8"/><text x="50" y="322" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23f8fafc">${newPhotoCaption.trim() || `Cliché documentaire ${label} (${newPhotoFace})`}</text><text x="50" y="346" font-family="monospace" font-size="11" fill="%2394a3b8">NF EN 927-6 • ${newPhotoOperator} • ${new Date().toLocaleDateString('fr-FR')}</text></svg>`;

    try {
      globalTrialStore.attachPhoto({
        trialId: trial.id,
        panelId: newPhotoPanelId,
        stageId: newPhotoStageId,
        filename,
        caption: newPhotoCaption.trim() || `Cliché documentaire ${label} — ${stageName} (${newPhotoFace})`,
        operatorId: newPhotoOperator.trim() || 'Simon Martin (Technicien)',
        storageKey: defaultDataUrl
      });

      setShowAddModal(false);
      setNewPhotoCaption('');
      setNewPhotoDataUrl('');
      setUploadError(null);
      onTrialUpdated();
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors de l'enregistrement de la photo");
    }
  };

  const handleDeletePhoto = (mediaId: string) => {
    // 1. Rechercher si le mediaId est actuellement référencé dans acquisitions[*].mediaIds
    const referencingAcquisitions = Object.values(trial.acquisitions || {}).filter(
      (acq) => Array.isArray(acq.mediaIds) && acq.mediaIds.includes(mediaId)
    );

    // 2. Déterminer le message de confirmation selon la présence de références
    const confirmMessage =
      referencingAcquisitions.length > 0
        ? "Cette photographie est associée à une observation enregistrée. La supprimer n'affectera pas les données de mesure, mais supprimera la preuve photographique associée. Confirmer la suppression ?"
        : 'Confirmez-vous la suppression de cette photographie ?';

    if (!window.confirm(confirmMessage)) return;

    // Traçabilité de suppression dans l'audit trail
    // Note d'architecture : opérateur passé via createdBy à défaut d'une session utilisateur connectée
    globalTrialStore.deletePhoto(trial.id, mediaId, trial.metadata.createdBy || 'OPERATOR');
    if (lightboxMedia?.id === mediaId) {
      setLightboxMedia(null);
    }
    setSelectedPhotoIdsForCompare((prev) => prev.filter((id) => id !== mediaId));
    onTrialUpdated();
  };

  const toggleComparePhoto = (photoId: string) => {
    setSelectedPhotoIdsForCompare((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleLaunchCompareForSpecimen = (panelId: string) => {
    const photos = trial.mediaReferences
      .filter((m) => m.type === 'PHOTO' && m.panelId === panelId && m.status !== 'ARCHIVED')
      .map((m) => m.id);
    setSelectedPhotoIdsForCompare(photos);
    setViewMode('TEMPORAL_COMPARE');
  };

  // Liste des éprouvettes du lot sélectionné dans le modal
  const modalBatchPanels = useMemo(() => {
    const b = trial.batches.find((batch) => batch.id === newPhotoBatchId);
    return b ? b.panels : [];
  }, [trial.batches, newPhotoBatchId]);

  return (
    <div className="space-y-6">
      {/* 1. BANNIÈRE MÉTHODOLOGIQUE & RÈGLES NORMATIVES FONDAMENTALES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Photothèque & Suivi Visuel Temporel
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                    NF EN 927-6
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Module documentaire transversal • Rattachement strict :{' '}
                  <span className="font-semibold text-slate-800">Essai → Lot → Échantillon → Jalon</span>
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('SPECIMEN_TIMELINE')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'SPECIMEN_TIMELINE'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Par Échantillon & Chronologie
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TEMPORAL_COMPARE')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'TEMPORAL_COMPARE'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                Comparer les photographies ({comparedPhotos.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'MATRIX'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Matrice Temporelle
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GALLERY')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'GALLERY'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Galerie Globale
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeBatch && activePanel) {
                  handleOpenAddModalForStage(activeBatch.id, activePanel.id, trial.stages[0]?.id || '');
                } else {
                  setShowAddModal(true);
                }
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau Cliché
            </button>
          </div>
        </div>

        {/* Rappel des 3 règles d'or de la photothèque */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              1. Indépendance Métrologique
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              La photo est une donnée documentaire. Aucune mesure (Couleur, Brillance, Persoz, Adhérence) n'est bloquée en l'absence de cliché.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              2. Plan Photo Facultatif
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              L'absence de photo sur un jalon intermédiaire est un choix de l'opérateur et n'est jamais considérée comme une anomalie.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-purple-600" />
              3. Traçabilité & Intra-Échantillon
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              La comparaison temporelle valide porte sur le <strong>même échantillon</strong> au fil de ses jalons d'exposition (T0, C3, C12...).
            </p>
          </div>
        </div>
      </div>

      {/* 2. VUE PRINCIPALE 1 : NAVIGATION PRIORITAIRE ESSAI -> LOT -> ÉCHANTILLON -> CHRONOLOGIE */}
      {viewMode === 'SPECIMEN_TIMELINE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* A. Arborescence Hiérarchique (Lot & Échantillon) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  Navigation Éprouvettes
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {trial.batches.reduce((sum, b) => sum + b.panels.length, 0)} éprouvettes
                </span>
              </div>

              {/* Liste des Lots et de leurs Éprouvettes */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {trial.batches.map((batch) => {
                  const isBatchSelected = batch.id === activeBatchId;

                  return (
                    <div
                      key={batch.id}
                      className={`border rounded-xl p-2.5 transition-all ${
                        isBatchSelected ? 'bg-blue-50/40 border-blue-300 shadow-2xs' : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 font-mono">{batch.reference}</span>
                          <span className="text-[11px] text-slate-500">
                            • {batch.woodSpecies || 'Bois'}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white font-mono text-slate-600 border border-slate-200">
                          {batch.productReference || 'Finition'}
                        </span>
                      </div>

                      {/* Éprouvettes T, 1, 2, 3 */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {batch.panels.map((panel) => {
                          const isPanelActive = isBatchSelected && panel.id === activePanelId;
                          const isWitness = panel.label === 'T';
                          const photoCount = trial.mediaReferences.filter(
                            (m) => m.type === 'PHOTO' && m.panelId === panel.id && m.status !== 'ARCHIVED'
                          ).length;

                          return (
                            <button
                              key={panel.id}
                              type="button"
                              onClick={() => handleSelectSpecimen(batch.id, panel.id)}
                              className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                                isPanelActive
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`font-mono font-bold text-xs ${isPanelActive ? 'text-white' : isWitness ? 'text-purple-700' : 'text-slate-900'}`}>
                                  {batch.reference}-{panel.label}
                                </span>
                                {isWitness && (
                                  <span
                                    className={`text-[9px] font-bold px-1 rounded ${
                                      isPanelActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    T
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px]">
                                <span className={`flex items-center gap-0.5 ${isPanelActive ? 'text-blue-100' : 'text-slate-500'}`}>
                                  <Camera className="w-3 h-3" />
                                  {photoCount}
                                </span>
                                <span className={isPanelActive ? 'text-blue-200' : 'text-slate-400'}>
                                  {photoCount > 0 ? 'Documenté' : '0 photo'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* B. Chronologie Photographique de l'Échantillon Sélectionné */}
          <div className="lg:col-span-8 space-y-4">
            {activePanel && activeBatch ? (
              <div className="space-y-4">
                {/* Fiche d'identification de l'échantillon sélectionné */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-mono font-bold text-slate-900">
                          {activeBatch.reference} — Éprouvette {activePanel.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                            activePanel.label === 'T'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {activePanel.label === 'T' ? 'Témoin (Chambre Obscure)' : 'Exposé QUV'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activeBatch.woodSpecies || 'Pin sylvestre'} • {activeBatch.productReference || 'Lasure / Finition'} • Épaisseur film sec :{' '}
                        <strong>{activeBatch.dryFilmThicknessMicrons ? `${activeBatch.dryFilmThicknessMicrons} µm` : 'Non renseignée'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLaunchCompareForSpecimen(activePanel.id)}
                        disabled={activePanelPhotos.length < 2}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                        title={activePanelPhotos.length < 2 ? 'Au moins 2 clichés requis pour comparer' : 'Ouvrir la comparaison temporelle'}
                      >
                        <Split className="w-3.5 h-3.5" />
                        Comparer les photographies ({activePanelPhotos.length})
                      </button>
                    </div>
                  </div>

                  {/* Ligne chronologique des Jalons d'exposition */}
                  <div className="pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Chronologie d'Exposition (NF EN 927-6)
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {activePanelPhotos.length} cliché(s) documenté(s) sur {trial.stages.length} jalons
                      </span>
                    </div>

                    {/* Timeline des Jalons */}
                    <div className="space-y-3">
                      {trial.stages.map((stage) => {
                        const photo = trial.mediaReferences.find(
                          (m) =>
                            m.type === 'PHOTO' &&
                            m.panelId === activePanel.id &&
                            m.stageId === stage.id &&
                            m.status !== 'ARCHIVED'
                        );
                        const isSelectedForCompare = photo ? selectedPhotoIdsForCompare.includes(photo.id) : false;

                        return (
                          <div
                            key={stage.id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                              photo
                                ? 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200/80 border-dashed'
                            }`}
                          >
                            {/* Colonne Jalon */}
                            <div className="flex items-center gap-3 min-w-[200px]">
                              {photo && (
                                <input
                                  type="checkbox"
                                  checked={isSelectedForCompare}
                                  onChange={() => toggleComparePhoto(photo.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  title="Cocher pour inclure dans le comparateur temporel"
                                />
                              )}
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {stage.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold rounded bg-slate-100 text-slate-700">
                                    {stage.scheduledExposureHours} h
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {stage.cycleIndex === 0
                                    ? 'Initial (T0 avant exposition)'
                                    : stage.cycleIndex === 12
                                    ? 'Final (2016 h terme essai)'
                                    : `Cycle ${stage.cycleIndex} intermédiaire`}
                                </div>
                              </div>
                            </div>

                            {/* Colonne Photo / Statut */}
                            <div className="grow flex items-center gap-3">
                              {photo ? (
                                <div className="flex items-center gap-3 grow">
                                  <button
                                    type="button"
                                    onClick={() => setLightboxMedia(photo)}
                                    className="relative group shrink-0 aspect-4/3 w-20 bg-slate-900 rounded-lg overflow-hidden border border-slate-200"
                                  >
                                    <img
                                      src={photo.storageKey}
                                      alt={photo.caption || 'Cliché'}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </button>

                                  <div className="text-xs space-y-1 grow">
                                    <p className="font-medium text-slate-800 line-clamp-1">{photo.caption}</p>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                                      <span>{new Date(photo.capturedAt).toLocaleDateString('fr-FR')}</span>
                                      <span>•</span>
                                      <span>{photo.capturedBy}</span>
                                      <span>•</span>
                                      <span className="text-slate-500">{photo.filename}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
                                  <span>Aucun cliché sur ce jalon (documentation facultative)</span>
                                </div>
                              )}
                            </div>

                            {/* Colonne Actions */}
                            <div className="shrink-0 flex items-center gap-2">
                              {photo ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxMedia(photo)}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Agrandir le cliché"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenAddModalForStage(activeBatch.id, activePanel.id, stage.id)
                                    }
                                    className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1"
                                    title="Remplacer le cliché (archivera l'actuel)"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Remplacer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Supprimer ce cliché"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenAddModalForStage(activeBatch.id, activePanel.id, stage.id)
                                  }
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-all"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  Prendre un Cliché
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
                <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                Veuillez sélectionner une éprouvette dans l'arborescence.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. VUE PRINCIPALE 2 : « COMPARER LES PHOTOGRAPHIES » (COMPARAISON TEMPORELLE N-JALONS) */}
      {viewMode === 'TEMPORAL_COMPARE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {/* Header Comparateur */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Split className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Comparaison Photographique Temporelle (NF EN 927-6)
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                  {comparedPhotos.length} jalon(s) comparé(s)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisation côte à côte de la cinétique visuelle dans l'ordre chronologique strict
              </p>
            </div>

            {/* Sélecteur rapide d'échantillon pour la comparaison */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 shrink-0">Échantillon analysé :</label>
              <select
                value={`${activeBatchId}__${activePanelId}`}
                onChange={(e) => {
                  const [bId, pId] = e.target.value.split('__');
                  handleSelectSpecimen(bId, pId);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                {trial.batches.flatMap((b) =>
                  b.panels.map((p) => (
                    <option key={`${b.id}__${p.id}`} value={`${b.id}__${p.id}`}>
                      {b.reference} — Éprouvette {p.label} ({p.label === 'T' ? 'Témoin' : 'Exposé'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Garde-fou normatif de comparaison : Alerte si comparaison inter-échantillons (Point 6) */}
          {!compareIntegrityCheck.isSamePanel && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm font-bold text-amber-900 block mb-1">
                  ⚠️ Avertissement Méthodologique — Comparaison Inter-Échantillons
                </strong>
                <p className="leading-relaxed">
                  Vous comparez actuellement des clichés appartenant à des éprouvettes <strong>différentes</strong>. Pour une analyse de cinétique de vieillissement rigoureuse et représentative selon la norme <strong>NF EN 927-6</strong>, la comparaison temporelle doit porter exclusivement sur le <strong>même échantillon</strong> au fil de ses jalons d'exposition.
                </p>
              </div>
            </div>
          )}

          {/* Grille de sélection des jalons disponibles pour cet échantillon */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span>Sélectionner les jalons à comparer pour cet échantillon :</span>
              <button
                type="button"
                onClick={() => {
                  if (activePanel) {
                    const allOfPanel = trial.mediaReferences
                      .filter((m) => m.type === 'PHOTO' && m.panelId === activePanel.id && m.status !== 'ARCHIVED')
                      .map((m) => m.id);
                    setSelectedPhotoIdsForCompare(allOfPanel);
                  }
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold normal-case"
              >
                Tout cocher ({activePanelPhotos.length})
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {activePanelPhotos.map((photo) => {
                const stage = photo.stageId ? stageMap.get(photo.stageId) : null;
                const isSelected = selectedPhotoIdsForCompare.includes(photo.id);

                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => toggleComparePhoto(photo.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isSelected ? '☑' : '☐'}</span>
                    <span className="font-mono font-bold">{stage?.name || 'Jalon'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {stage?.scheduledExposureHours ?? 0} h
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Affichage Côte-à-Côte des Photographies dans l'ordre chronologique strict */}
          {comparedPhotos.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 space-y-2">
              <Camera className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Aucun cliché sélectionné pour la comparaison</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cochez au moins 2 jalons photographiés ci-dessus pour observer l'évolution visuelle temporelle de l'échantillon.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`grid gap-4 ${
                  comparedPhotos.length === 1
                    ? 'grid-cols-1 max-w-xl mx-auto'
                    : comparedPhotos.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : comparedPhotos.length === 3
                    ? 'grid-cols-1 md:grid-cols-3'
                    : comparedPhotos.length === 4
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5'
                }`}
              >
                {comparedPhotos.map((photo, idx) => {
                  const stage = photo.stageId ? stageMap.get(photo.stageId) : null;
                  const info = photo.panelId ? panelMap.get(photo.panelId) : null;
                  const specimenLabel = info ? `${info.batch.reference}-${info.panel.label}` : 'Éprouvette';

                  return (
                    <div
                      key={photo.id}
                      className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
                    >
                      {/* En-tête jalon normalisé */}
                      <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500 text-white font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-bold font-mono text-xs text-slate-100">
                            {stage ? stage.name : 'Jalon'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {stage?.scheduledExposureHours ?? 0} h
                        </span>
                      </div>

                      {/* Image Thumbnail */}
                      <div className="relative aspect-4/3 bg-slate-950 overflow-hidden group">
                        <img
                          src={photo.storageKey}
                          alt={photo.caption || 'Cliché chronologique'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxMedia(photo)}
                          className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          title="Agrandir et inspecter"
                        >
                          <div className="p-2 rounded-full bg-white/90 text-slate-900 shadow-md">
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </button>
                      </div>

                      {/* Métadonnées de Traçabilité */}
                      <div className="p-3.5 space-y-2 text-xs bg-white">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="font-mono">{specimenLabel}</span>
                          <span className="text-slate-500 font-normal">
                            {new Date(photo.capturedAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>

                        <p className="text-slate-700 text-xs font-medium line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {photo.caption || 'Aucune observation enregistrée.'}
                        </p>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Op : {photo.capturedBy}</span>
                          <button
                            type="button"
                            onClick={() => toggleComparePhoto(photo.id)}
                            className="text-rose-600 hover:underline font-bold"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Planche de Rapport / Résumé de l'Évolution Photographique */}
              <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                    <FileImage className="w-4 h-4 text-blue-700" />
                    Planche d'Évolution Photographique Normalisée (Pour Rapport NF EN 927-6)
                  </h4>
                  <span className="text-[11px] font-mono text-blue-800">
                    Légende : Lot — Échantillon — Jalon — Heures cumulées
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden border border-blue-200">
                    <thead>
                      <tr className="bg-blue-100/70 border-b border-blue-200 text-blue-950">
                        <th className="p-2.5 font-bold">Jalon & Heures</th>
                        <th className="p-2.5 font-bold">Échantillon</th>
                        <th className="p-2.5 font-bold">Date de prise</th>
                        <th className="p-2.5 font-bold">Opérateur</th>
                        <th className="p-2.5 font-bold">Observations Documentaires</th>
                        <th className="p-2.5 font-bold text-right">Fichier Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparedPhotos.map((photo) => {
                        const stage = photo.stageId ? stageMap.get(photo.stageId) : null;
                        const info = photo.panelId ? panelMap.get(photo.panelId) : null;

                        return (
                          <tr key={photo.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {stage?.name || 'Jalon'} ({stage?.scheduledExposureHours ?? 0} h)
                            </td>
                            <td className="p-2.5 font-mono text-blue-700 whitespace-nowrap">
                              {info ? `${info.batch.reference} - ${info.panel.label}` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-600 whitespace-nowrap">
                              {new Date(photo.capturedAt).toLocaleString('fr-FR')}
                            </td>
                            <td className="p-2.5 text-slate-600 whitespace-nowrap">{photo.capturedBy}</td>
                            <td className="p-2.5 text-slate-800">{photo.caption}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-400 text-right">
                              {photo.filename}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. VUE PRINCIPALE 3 : MATRICE SYNOPTIQUE TEMPORELLE GLOBALE */}
      {viewMode === 'MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Matrice Synoptique Photographique</h4>
              <p className="text-xs text-slate-500">
                Cartographie globale de la couverture photographique par éprouvette et par jalon (NF EN 927-6)
              </p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="p-2.5 font-bold text-slate-700">Éprouvette</th>
                <th className="p-2.5 font-bold text-slate-700">Lot & Essence</th>
                {trial.stages.map((st) => (
                  <th key={st.id} className="p-2.5 font-bold text-slate-700 text-center font-mono">
                    {st.name}
                    <span className="block text-[10px] text-slate-400 font-normal">({st.scheduledExposureHours}h)</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trial.batches.flatMap((b) =>
                b.panels.map((p) => {
                  const isWitness = p.label === 'T';
                  const code = `${b.reference}-${p.label}`;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSpecimen(b.id, p.id);
                            setViewMode('SPECIMEN_TIMELINE');
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] hover:underline ${
                            isWitness ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                          }`}
                        >
                          {code}
                        </button>
                      </td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">
                        {b.woodSpecies || 'Bois'} ({b.productReference || '—'})
                      </td>
                      {trial.stages.map((st) => {
                        const photo = trial.mediaReferences.find(
                          (m) =>
                            m.type === 'PHOTO' &&
                            m.panelId === p.id &&
                            m.stageId === st.id &&
                            m.status !== 'ARCHIVED'
                        );

                        return (
                          <td key={st.id} className="p-2 text-center">
                            {photo ? (
                              <button
                                type="button"
                                onClick={() => setLightboxMedia(photo)}
                                className="inline-block relative group"
                                title={`${code} - ${st.name} : ${photo.caption}`}
                              >
                                <img
                                  src={photo.storageKey}
                                  alt="Cliché"
                                  className="w-12 h-10 object-cover rounded border border-slate-300 group-hover:scale-110 transition-transform shadow-2xs"
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAddModalForStage(b.id, p.id, st.id)}
                                className="w-8 h-8 rounded border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-300 hover:text-blue-600 inline-flex items-center justify-center transition-colors text-xs"
                                title="Ajouter un cliché pour ce jalon"
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. VUE PRINCIPALE 4 : GALERIE GLOBALE AVEC FILTRAGE */}
      {viewMode === 'GALLERY' && (
        <div className="space-y-4">
          {/* Barre de Filtres */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Filtres de consultation
              </div>
              <label className="flex items-center gap-2 cursor-pointer lowercase font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs">Afficher les clichés archivés / remplacés</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filtrer par Lot</label>
                <select
                  value={selectedGalleryBatchId}
                  onChange={(e) => setSelectedGalleryBatchId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  <option value="ALL">Tous les lots ({trial.batches.length})</option>
                  {trial.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} — {b.productReference || b.woodSpecies}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filtrer par Jalon / Cycle</label>
                <select
                  value={selectedGalleryStageId}
                  onChange={(e) => setSelectedGalleryStageId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  <option value="ALL">Toutes les étapes ({trial.stages.length})</option>
                  {trial.stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.scheduledExposureHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rôle d'Éprouvette</label>
                <select
                  value={selectedGallerySpecimenRole}
                  onChange={(e) => setSelectedGallerySpecimenRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  <option value="ALL">Tous les rôles (T + Exposés)</option>
                  <option value="WITNESS">Témoins seuls (T)</option>
                  <option value="EXPOSED">Exposés seuls (1, 2, 3)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Recherche (légende, auteur...)</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: farinage, T0, Simon..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Grille de Photos */}
          {filteredGalleryPhotos.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Camera className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Aucun cliché photographique trouvé</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Aucune photo ne correspond aux filtres sélectionnés. Cliquez sur "Nouveau Cliché" pour attacher une image à une éprouvette et un jalon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGalleryPhotos.map((media) => {
                const info = media.panelId ? panelMap.get(media.panelId) : null;
                const stage = media.stageId ? stageMap.get(media.stageId) : null;
                const isWitness = info?.panel.label === 'T';
                const specimenLabel = info ? `${info.batch.reference}-${info.panel.label}` : 'Éprouvette';
                const isArchived = media.status === 'ARCHIVED';

                return (
                  <div
                    key={media.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                      isArchived ? 'border-amber-200 opacity-70 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden border-b border-slate-100 flex items-center justify-center">
                      <img
                        src={media.storageKey}
                        alt={media.caption || 'Photographie éprouvette'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />

                      {/* Badges Overlay */}
                      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-900/80 text-white backdrop-blur-xs">
                          {specimenLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded backdrop-blur-xs ${
                            isWitness ? 'bg-purple-600/90 text-white' : 'bg-blue-600/90 text-white'
                          }`}
                        >
                          {isWitness ? 'Témoin' : 'Exposé'}
                        </span>
                        {isArchived && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-600 text-white flex items-center gap-0.5">
                            <Archive className="w-3 h-3" />
                            Archivé
                          </span>
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLightboxMedia(media)}
                          className="p-2 rounded-full bg-white/90 text-slate-800 hover:bg-white hover:scale-110 transition-transform shadow-md"
                          title="Agrandir et inspecter"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(media.id)}
                          className="p-2 rounded-full bg-rose-600/90 text-white hover:bg-rose-700 hover:scale-110 transition-transform shadow-md"
                          title="Supprimer ce cliché"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Clock className="w-3 h-3 text-blue-600" />
                          {stage ? stage.name : 'Jalon N/A'}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-800">
                          {stage?.scheduledExposureHours ?? 0} h
                        </span>
                      </div>

                      <p className="text-slate-800 font-medium text-xs line-clamp-2" title={media.caption}>
                        {media.caption || 'Aucune observation'}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{media.capturedBy}</span>
                        <span>{new Date(media.capturedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL AJOUT / REMPLACEMENT DE CLICHÉ (GATE 2.2) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                {existingActivePhotoInModal ? 'Remplacer le Cliché Photographique' : 'Nouveau Cliché Photographique'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 text-rose-900 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Avertissement de remplacement si photo existante */}
            {existingActivePhotoInModal && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Unicité active & Remplacement contrôlé :</strong> Un cliché actif existe déjà pour cette éprouvette à ce jalon (<em>{existingActivePhotoInModal.filename}</em>). L'enregistrement de ce nouveau cliché archivera l'ancien dans l'historique sans le détruire.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Lot expérimental *
                </label>
                <select
                  value={newPhotoBatchId}
                  onChange={(e) => {
                    setNewPhotoBatchId(e.target.value);
                    const b = trial.batches.find((batch) => batch.id === e.target.value);
                    if (b && b.panels[0]) setNewPhotoPanelId(b.panels[0].id);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {trial.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} ({b.woodSpecies})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Éprouvette ciblée *
                </label>
                <select
                  value={newPhotoPanelId}
                  onChange={(e) => setNewPhotoPanelId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {modalBatchPanels.map((p) => (
                    <option key={p.id} value={p.id}>
                      Éprouvette {p.label} ({p.label === 'T' ? 'Témoin' : 'Exposé'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Jalon d'exposition *
                </label>
                <select
                  value={newPhotoStageId}
                  onChange={(e) => setNewPhotoStageId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {trial.stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.scheduledExposureHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Face photographiée
                </label>
                <select
                  value={newPhotoFace}
                  onChange={(e) => setNewPhotoFace(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="Face externe">Face externe (exposée UV)</option>
                  <option value="Face interne">Face interne (non exposée)</option>
                  <option value="Tranche / Rive">Tranche / Rive</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  5. Fichier Image (Téléversement ou Glisser-Déposer)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelected}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {newPhotoDataUrl && (
                    <div className="mt-3 aspect-16/9 max-h-36 rounded-lg overflow-hidden border border-slate-200 mx-auto">
                      <img
                        src={newPhotoDataUrl}
                        alt="Aperçu"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  6. Observations / Légende du cliché
                </label>
                <textarea
                  rows={2}
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="Ex : Fissuration locale en zone centrale, début de farinage, décollement en tranche..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Opérateur de prise de vue
                </label>
                <input
                  type="text"
                  value={newPhotoOperator}
                  onChange={(e) => setNewPhotoOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePhoto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                {existingActivePhotoInModal ? "Remplacer et Archiver l'Ancien" : 'Enregistrer la Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. LIGHTBOX D'INSPECTION PLEIN ÉCRAN AVEC HISTORIQUE */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header Lightbox */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
                    {lightboxMedia.filename}
                    {lightboxMedia.status === 'ARCHIVED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        ARCHIVÉ
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Capturé le {new Date(lightboxMedia.capturedAt).toLocaleString('fr-FR')} par {lightboxMedia.capturedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLightboxMedia(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Metadata */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
              <div className="md:col-span-2 aspect-4/3 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={lightboxMedia.storageKey}
                  alt={lightboxMedia.caption}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Sidebar Metadata */}
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block text-[10px]">
                    Identifiants de Traçabilité
                  </span>
                  {lightboxMedia.panelId && panelMap.get(lightboxMedia.panelId) && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Éprouvette & Lot :</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {panelMap.get(lightboxMedia.panelId)?.batch.reference} —{' '}
                        {panelMap.get(lightboxMedia.panelId)?.panel.label}
                      </span>
                    </div>
                  )}

                  {lightboxMedia.stageId && stageMap.get(lightboxMedia.stageId) && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Jalon d'Exposition :</span>
                      <span className="font-semibold text-slate-900">
                        {stageMap.get(lightboxMedia.stageId)?.name} (
                        {stageMap.get(lightboxMedia.stageId)?.scheduledExposureHours} h)
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block text-[10px]">Statut Photothèque :</span>
                    <span className="font-bold text-slate-800">
                      {lightboxMedia.status === 'ARCHIVED' ? 'Archivé (remplacé par un cliché plus récent)' : 'Actif'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                  <span className="font-bold text-blue-950 uppercase tracking-wider block text-[10px]">
                    Légende & Observation
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {lightboxMedia.caption || 'Aucune observation enregistrée.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(lightboxMedia.id)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxMedia(null)}
                    className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

