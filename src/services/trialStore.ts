/**
 * QUV-Lab — Magasin d'Essais & Service de Gestion Métier (PROMPT 6)
 * Gère la persistance locale, les maquettes d'essai de référence, le verrouillage de configuration,
 * l'enregistrement des acquisitions par famille, les validations d'étape et l'audit trail.
 */

import {
  Trial,
  TrialMetadata,
  CommonCharacteristics,
  BatchDefinition,
  PanelDefinition,
  ExposureStage,
  ExposureStageType,
  PanelAcquisitionRecord,
  AuditEvent,
  MediaReference,
  PhotoReference,
  TrialProtocolConfig,
  WoodGrainOrientation,
  ExposureFace,
  SpecimenRole,
  SpecimenRoleCode
} from '../types/trial';
import {
  UUID,
  MeasurementFamilyId,
  ScientificRuleSet,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  AdhesionRawData,
  VisualObservationsRawData,
  ScientificRuleOrigin,
  ScientificReport,
  ScientificReportStatus,
  ScientificReportReviewComment
} from '../types/scientific';
import { getDefaultScientificRuleSet, createCountConfiguration, createSeriesConfiguration } from '../scientific/ruleSet';
import { recalculateAcquisition } from '../scientific/recalculator';
import { createConfigChangeEvent } from '../scientific/auditEngine';
import { buildScientificReport } from './reportGenerator';
import { isFamilyScheduledForStage } from '../scientific/panelUtils';

const STORAGE_KEY = 'quv_lab_trials_v2_2';

/**
 * Générateur d'UUID simple
 */
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Erreur spécifique de violation d'intégrité relationnelle du modèle QUV (Gate 3.1)
 */
export class IntegrityViolationError extends Error {
  public readonly code = 'INTEGRITY_VIOLATION';
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'IntegrityViolationError';
    this.details = details;
    Object.setPrototypeOf(this, IntegrityViolationError.prototype);
  }
}

/**
 * Garde-fou d'intégrité relationnelle pour les acquisitions (Gate 3.1 - Risque 1)
 * Vérifie que batchId existe, que panelId appartient bien à ce lot,
 * et que stageId appartient bien à l'essai, avant toute écriture.
 */
export function validateAcquisitionTarget(
  trial: Trial,
  stageId: UUID,
  batchId: UUID,
  panelId: UUID
): void {
  if (!trial) {
    throw new IntegrityViolationError("Essai indéfini lors de la validation de la cible d'acquisition.");
  }

  // 1. Vérification de l'existence du lot
  const batch = trial.batches?.find((b) => b.id === batchId);
  if (!batch) {
    throw new IntegrityViolationError(
      `Le lot ${batchId} n'existe pas dans l'essai ${trial.id}.`,
      { trialId: trial.id, batchId, stageId, panelId }
    );
  }

  // 2. Vérification de l'appartenance de l'éprouvette au lot
  const panel = batch.panels?.find((p) => p.id === panelId);
  if (!panel) {
    throw new IntegrityViolationError(
      `L'éprouvette ${panelId} n'appartient pas au lot ${batchId} (lot "${batch.reference}").`,
      { trialId: trial.id, batchId, panelId, stageId }
    );
  }

  // 3. Vérification de l'existence de l'étape dans l'essai
  const stage = trial.stages?.find((s) => s.id === stageId);
  if (!stage) {
    throw new IntegrityViolationError(
      `L'étape d'exposition ${stageId} n'appartient pas à l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, batchId, panelId }
    );
  }
}

/**
 * Garde-fou d'intégrité relationnelle pour les photographies (Gate 3.1 - Risque 2)
 * Vérifie que stageId appartient à l'essai et que panelId appartient à un lot de l'essai.
 */
export function validatePhotoTarget(
  trial: Trial,
  stageId: UUID,
  panelId: UUID
): void {
  if (!trial) {
    throw new IntegrityViolationError("Essai indéfini lors de la validation de la cible photographique.");
  }

  // 1. Vérification de l'existence de l'étape
  const stage = trial.stages?.find((s) => s.id === stageId);
  if (!stage) {
    throw new IntegrityViolationError(
      `L'étape d'exposition ${stageId} n'appartient pas à l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, panelId }
    );
  }

  // 2. Vérification de l'existence de l'éprouvette dans l'un des lots de l'essai
  let foundPanel = false;
  if (Array.isArray(trial.batches)) {
    for (const b of trial.batches) {
      if (b.panels?.some((p) => p.id === panelId)) {
        foundPanel = true;
        break;
      }
    }
  }

  if (!foundPanel) {
    throw new IntegrityViolationError(
      `L'éprouvette ${panelId} n'existe pas dans les lots de l'essai ${trial.id}.`,
      { trialId: trial.id, stageId, panelId }
    );
  }
}

/**
 * Génère les 13 étapes d'exposition standard NF EN 927-6 (T0 + 12 cycles de 168h)
 * Si un plan de mesurage restreint est fourni, les cycles non mesurés restent présents
 * dans le modèle physique en tant que cycles d'exposition, avec le statut 'INACTIVE' (masqués de la paillasse).
 * T0 et C12 sont obligatoires et ne peuvent jamais être inactifs.
 */
export function generateStandardExposureStages(trialId: UUID, selectedMeasurementCycles?: number[]): ExposureStage[] {
  const stages: ExposureStage[] = [];
  const baseDate = new Date('2026-08-30T08:00:00Z');

  // Étape initiale T0 (0 h) — MESURES INITIALES AVANT EXPOSITION (Obligatoire)
  stages.push({
    id: `stage-${trialId}-0`,
    trialId,
    cycleIndex: 0,
    stageType: 'INITIAL_PRE_EXPOSURE',
    name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
    scheduledExposureHours: 0,
    actualExposureHours: 0,
    scheduledAt: baseDate.toISOString(),
    measuredAt: baseDate.toISOString(),
    status: 'VALIDATED',
    validatedBy: 'SM',
    validatedAt: '2026-08-30T12:00:00Z',
    notes: 'Mesures initiales de référence réalisées avant toute exposition UV.'
  });

  // 12 Cycles de 168h (168h à 2016h)
  for (let i = 1; i <= 12; i++) {
    const cycleHours = i * 168;
    const scheduledDate = new Date(baseDate.getTime() + i * 7 * 24 * 3600 * 1000);
    const isFinal = i === 12;

    // Détermination de l'inclusion dans le plan de mesurage
    // Par défaut (si non spécifié), tous les cycles sont mesurés.
    // T0 (0) et C12 (12) sont toujours inclus.
    const isPlannedForMeasurement = selectedMeasurementCycles ? (isFinal || selectedMeasurementCycles.includes(i)) : true;

    stages.push({
      id: `stage-${trialId}-${i}`,
      trialId,
      cycleIndex: i,
      stageType: isFinal ? 'FINAL_POST_EXPOSURE' : 'INTERMEDIATE_DURING_EXPOSURE',
      name: isFinal
        ? '2016 h — MESURES FINALES APRÈS EXPOSITION'
        : `${cycleHours} h — MESURES EN COURS D'EXPOSITION`,
      scheduledExposureHours: cycleHours,
      actualExposureHours: i === 1 && isPlannedForMeasurement ? 168 : (i === 2 && isPlannedForMeasurement ? 335.8 : undefined),
      scheduledAt: scheduledDate.toISOString(),
      measuredAt: i === 1 && isPlannedForMeasurement ? '2026-09-06T14:30:00Z' : (i === 2 && isPlannedForMeasurement ? '2026-09-13T10:15:00Z' : undefined),
      status: !isPlannedForMeasurement ? 'INACTIVE' : (i === 1 ? 'VALIDATED' : i === 2 ? 'IN_PROGRESS' : 'NOT_STARTED'),
      validatedBy: i === 1 && isPlannedForMeasurement ? 'SM' : undefined,
      validatedAt: i === 1 && isPlannedForMeasurement ? '2026-09-06T17:00:00Z' : undefined,
      notes: i === 1 && isPlannedForMeasurement ? 'Relevé intermédiaire 168h validé sans anomalie.' : undefined
    });
  }

  return stages;
}

/**
 * Crée un essai de démonstration complet représentatif d'une campagne active
 */
function createDemoTrial(ruleSet: ScientificRuleSet): Trial {
  const trialId = 'quv-trial-2026-042';

  const metadata: TrialMetadata = {
    reference: 'QUV-2026-042',
    orderNumber: 'CO-VAN2026-001',
    reportNumber: 'RA-VAN2026-001',
    title: 'Système Lasurage Chêne Haute Durabilité',
    projectOrClient: 'Projet X — Ceribois & Partenaires',
    coatingSystemDescription: 'Système 3 couches lasure acrylique microporeuse en phase aqueuse',
    substrateDescription: 'Chêne européen (Quercus robur) quartier/faux-quartier 150×75×15 mm',
    createdBy: 'Simon Martin (Technicien Labo)',
    generalNotes: 'Campagne de vieillissement accéléré selon NF EN 927-6 (cycles UV-A 340nm + condensation).'
  };

  const commonCharacteristics: CommonCharacteristics = {
    dimensions: {
      lengthMm: 150,
      widthMm: 75,
      thicknessMm: 15,
      unit: 'mm'
    },
    substrateNature: 'Bois massif',
    materialType: 'Chêne européen (Quercus robur)',
    woodGrainOrientation: 'Sur quartier (NF EN 927-6)',
    preparationNotes: 'Rabotage fin, ponçage grain P120, dépoussiérage, stabilisation 7 jours à 20°C / 65% HR',
    conditioningNotes: 'Conditionnement selon NF EN 927-6 §5 (20±2°C, 65±5% HR jusqu\'à masse constante)',
    generalProtocolNotes: 'Toutes les éprouvettes ont été préparées sur le même lot d\'approvisionnement de bois.'
  };

  const batches: BatchDefinition[] = [
    {
      id: `batch-${trialId}-1`,
      trialId,
      reference: 'LOT XX1C',
      orderIndex: 1,
      coatingSystem: 'Lasure Acrylique Standard (Témoin)',
      woodSpecies: 'Chêne',
      productReference: 'LAS-STD-01',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      dryFilmThicknessMicrons: 55,
      dryFilmThicknessUnit: 'µm',
      dryFilmThicknessMeasurementDate: '2026-08-21',
      dryFilmThicknessOperator: 'SM',
      dryFilmThicknessMethod: 'Peigne de jauge ISO 2808',
      batchNotes: 'Lot témoin sans agent anti-UV renforcé',
      panels: [
        { id: `panel-${trialId}-1-1`, batchId: `batch-${trialId}-1`, index: 1, label: 'T', role: 'WITNESS', roleCode: 'T', grainOrientation: 'Quartier', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-2`, batchId: `batch-${trialId}-1`, index: 2, label: '1', role: 'EXPOSED_1', roleCode: 'E1', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-3`, batchId: `batch-${trialId}-1`, index: 3, label: '2', role: 'EXPOSED_2', roleCode: 'E2', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-1-4`, batchId: `batch-${trialId}-1`, index: 4, label: '3', role: 'EXPOSED_3', roleCode: 'E3', grainOrientation: 'Faux quartier', exposureFace: 'Face externe', status: 'ACTIVE' }
      ]
    },
    {
      id: `batch-${trialId}-2`,
      trialId,
      reference: 'LOT XX2C',
      orderIndex: 2,
      coatingSystem: 'Lasure Formulation Anti-UV HALS 1.5%',
      woodSpecies: 'Chêne',
      productReference: 'LAS-UV15-02',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      dryFilmThicknessMicrons: 95,
      dryFilmThicknessUnit: 'µm',
      dryFilmThicknessMeasurementDate: '2026-08-21',
      dryFilmThicknessOperator: 'SM',
      dryFilmThicknessMethod: 'Peigne de jauge ISO 2808',
      batchNotes: 'Formulation avec stabilisants lumière HALS',
      panels: [
        { id: `panel-${trialId}-2-1`, batchId: `batch-${trialId}-2`, index: 1, label: 'T', role: 'WITNESS', roleCode: 'T', grainOrientation: 'Quartier', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-2`, batchId: `batch-${trialId}-2`, index: 2, label: '1', role: 'EXPOSED_1', roleCode: 'E1', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-3`, batchId: `batch-${trialId}-2`, index: 3, label: '2', role: 'EXPOSED_2', roleCode: 'E2', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-2-4`, batchId: `batch-${trialId}-2`, index: 4, label: '3', role: 'EXPOSED_3', roleCode: 'E3', grainOrientation: 'Faux quartier', exposureFace: 'Face externe', status: 'ACTIVE' }
      ]
    },
    {
      id: `batch-${trialId}-3`,
      trialId,
      reference: 'LOT XX3C',
      orderIndex: 3,
      coatingSystem: 'Lasure Nano-TiO2 Hybride 2.0%',
      woodSpecies: 'Chêne',
      productReference: 'LAS-NANO-03',
      manufacturerOrSupplier: 'Fournisseur Bêta',
      coatCount: 3,
      substratePreparation: 'Ponçage P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: '2026-08-20',
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      dryFilmThicknessMicrons: 185,
      dryFilmThicknessUnit: 'µm',
      dryFilmThicknessMeasurementDate: '2026-08-21',
      dryFilmThicknessOperator: 'SM',
      dryFilmThicknessMethod: 'Peigne de jauge ISO 2808',
      batchNotes: 'Formulation nano-charges minérales absorbantes',
      panels: [
        { id: `panel-${trialId}-3-1`, batchId: `batch-${trialId}-3`, index: 1, label: 'T', role: 'WITNESS', roleCode: 'T', grainOrientation: 'Quartier', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-2`, batchId: `batch-${trialId}-3`, index: 2, label: '1', role: 'EXPOSED_1', roleCode: 'E1', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-3`, batchId: `batch-${trialId}-3`, index: 3, label: '2', role: 'EXPOSED_2', roleCode: 'E2', grainOrientation: 'Quartier', exposureFace: 'Face externe', status: 'ACTIVE' },
        { id: `panel-${trialId}-3-4`, batchId: `batch-${trialId}-3`, index: 4, label: '3', role: 'EXPOSED_3', roleCode: 'E3', grainOrientation: 'Faux quartier', exposureFace: 'Face externe', status: 'ACTIVE' }
      ]
    }
  ];

  const protocolConfig: TrialProtocolConfig = {
    standardReference: 'NF EN 927-6',
    activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION', 'OBSERVATIONS'],
    familyConfigs: {
      COLOR: {
        familyId: 'COLOR',
        enabled: true,
        countConfig: createCountConfiguration('COLOR', 4, ruleSet)
      },
      GLOSS: {
        familyId: 'GLOSS',
        enabled: true,
        seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet)
      },
      PERSOZ: {
        familyId: 'PERSOZ',
        enabled: true,
        countConfig: createCountConfiguration('PERSOZ', 3, ruleSet)
      },
      ADHESION: {
        familyId: 'ADHESION',
        enabled: true
      },
      OBSERVATIONS: {
        familyId: 'OBSERVATIONS',
        enabled: true
      }
    }
  };

  const stages = generateStandardExposureStages(trialId);

  const auditTrail: AuditEvent[] = [
    {
      id: 'audit-1',
      trialId,
      timestamp: '2026-08-30T08:15:00Z',
      operatorId: 'SM',
      action: 'CREATE_TRIAL',
      entityType: 'TRIAL',
      entityId: trialId,
      details: { reference: 'QUV-2026-042', title: metadata.title }
    },
    {
      id: 'audit-2',
      trialId,
      timestamp: '2026-08-30T08:20:00Z',
      operatorId: 'SM',
      action: 'CONFIGURE_PROTOCOL',
      entityType: 'PROTOCOL',
      entityId: 'ALL',
      details: { activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'], colorPoints: 4, glossSeries: '2x2' }
    },
    {
      id: 'audit-3',
      trialId,
      timestamp: '2026-08-30T08:35:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[0].id,
      details: { reference: 'LOT XX1C', panelCount: 4 }
    },
    {
      id: 'audit-4',
      trialId,
      timestamp: '2026-08-30T08:40:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[1].id,
      details: { reference: 'LOT XX2C', panelCount: 4 }
    },
    {
      id: 'audit-5',
      trialId,
      timestamp: '2026-08-30T08:45:00Z',
      operatorId: 'SM',
      action: 'CREATE_BATCH',
      entityType: 'BATCH',
      entityId: batches[2].id,
      details: { reference: 'LOT XX3C', panelCount: 4 }
    },
    {
      id: 'audit-6',
      trialId,
      timestamp: '2026-08-30T09:00:00Z',
      operatorId: 'SYSTEM',
      action: 'LOCK_TRIAL_CONFIGURATION',
      entityType: 'CONFIG',
      entityId: trialId,
      details: { reason: 'Première acquisition scientifique réalisée sur T0.' }
    },
    {
      id: 'audit-7',
      trialId,
      timestamp: '2026-08-30T12:00:00Z',
      operatorId: 'SM',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stages[0].id,
      details: { stageName: 'T0 — Avant exposition', status: 'VALIDATED' }
    },
    {
      id: 'audit-8',
      trialId,
      timestamp: '2026-09-06T17:00:00Z',
      operatorId: 'SM',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stages[1].id,
      details: { stageName: '168 h — Cycle 1', status: 'VALIDATED' }
    }
  ];

  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-08-30T08:15:00Z',
    updatedAt: '2026-09-13T10:30:00Z',
    metadata,
    commonCharacteristics,
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: protocolConfig,
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches,
    acquisitions: {},
    auditTrail,
    mediaReferences: []
  };

  // Remplir les acquisitions pour T0 (validé), 168h (validé), et 336h (en cours)
  seedDemoAcquisitions(trial, ruleSet);

  return trial;
}

/**
 * Génère des acquisitions réalistes pour le scénario de démo
 */
function seedDemoAcquisitions(trial: Trial, ruleSet: ScientificRuleSet): void {
  const stageT0 = trial.stages[0];
  const stage168 = trial.stages[1];
  const stage336 = trial.stages[2];

  // Base L*a*b* par lot
  const baseColors: Record<string, { L: number; a: number; b: number }> = {
    'LOT XX1C': { L: 62.4, a: 8.2, b: 24.1 },
    'LOT XX2C': { L: 61.8, a: 8.5, b: 23.8 },
    'LOT XX3C': { L: 63.1, a: 7.9, b: 24.6 }
  };

  // Base Gloss par lot
  const baseGloss: Record<string, number> = {
    'LOT XX1C': 45.2,
    'LOT XX2C': 48.0,
    'LOT XX3C': 46.5
  };

  // Base Persoz par lot
  const basePersoz: Record<string, number> = {
    'LOT XX1C': 82.0,
    'LOT XX2C': 88.0,
    'LOT XX3C': 91.0
  };

  for (const batch of trial.batches) {
    const cBase = baseColors[batch.reference] || { L: 60, a: 8, b: 24 };
    const gBase = baseGloss[batch.reference] || 45;
    const pBase = basePersoz[batch.reference] || 85;

    for (let pIdx = 0; pIdx < batch.panels.length; pIdx++) {
      const panel = batch.panels[pIdx];

      // --- T0 ---
      // Couleur T0
      const colorRawT0: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(cBase.L + 0.1 * pIdx).toFixed(2), a: +(cBase.a - 0.05 * pIdx).toFixed(2), b: +(cBase.b + 0.1).toFixed(2) },
          { pointIndex: 2, L: +(cBase.L - 0.2 + 0.1 * pIdx).toFixed(2), a: +(cBase.a + 0.02 * pIdx).toFixed(2), b: +(cBase.b - 0.1).toFixed(2) },
          { pointIndex: 3, L: +(cBase.L + 0.15 + 0.05 * pIdx).toFixed(2), a: +(cBase.a - 0.01).toFixed(2), b: +(cBase.b + 0.05).toFixed(2) },
          { pointIndex: 4, L: +(cBase.L - 0.05 + 0.08 * pIdx).toFixed(2), a: +(cBase.a + 0.04).toFixed(2), b: +(cBase.b - 0.02).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'COLOR', colorRawT0, ruleSet);

      // Brillance T0
      const glossRawT0: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(gBase + 0.3 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase - 0.2 + 0.2 * pIdx).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(gBase - 1.2 + 0.3 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase - 0.8 + 0.1 * pIdx).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'GLOSS', glossRawT0, ruleSet);

      // Persoz T0
      const persozRawT0: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(pBase + pIdx).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(pBase - 1 + pIdx).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(pBase + 1 + pIdx).toFixed(1) }
        ],
        unit: 'SECONDS',
        instrumentMetadata: { instrumentId: 'PERSOZ-PENDULUM-02', temperatureCelsius: 21.5, relativeHumidityPercent: 50.2 }
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'PERSOZ', persozRawT0, ruleSet);

      // Observations T0
      const obsRawT0: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Revêtement uniforme et lisse' }
        ],
        assessedBy: 'SM',
        assessedAt: '2026-08-30T11:45:00Z'
      };
      recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'OBSERVATIONS', obsRawT0, ruleSet);

      // Adhérence au quadrillage T0 (ISO 2409:2020 - Témoin T)
      if (panel.role === 'WITNESS' || panel.index === 1) {
        const spacing = (batch.dryFilmThicknessMicrons && batch.dryFilmThicknessMicrons > 120) ? 3 : 2;
        const adhRawT0: AdhesionRawData = {
          adhesionClass: 0,
          gridSpacingMm: spacing,
          coatingThicknessMicrons: batch.dryFilmThicknessMicrons,
          measurementDateTime: '2026-08-30T14:00:00Z',
          applicationDateTime: batch.applicationDate,
          requiredMinimumDelayHours: 168,
          normReference: 'NF EN ISO 2409:2020',
          observation: 'Quadrillage net 6×6, bords des incisions parfaitement lisses, aucun détachement (Classe 0).'
        };
        recordAcquisitionDirect(trial, stageT0.id, batch.id, panel.id, 'ADHESION', adhRawT0, ruleSet);
      }

      // --- 168h ---
      const dL168 = batch.reference === 'LOT XX1C' ? 1.8 : batch.reference === 'LOT XX2C' ? 0.9 : 0.6;
      const dG168 = batch.reference === 'LOT XX1C' ? -4.5 : batch.reference === 'LOT XX2C' ? -2.2 : -1.5;

      const colorRaw168: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(cBase.L + dL168 + 0.1 * pIdx).toFixed(2), a: +(cBase.a + 0.4).toFixed(2), b: +(cBase.b + 0.8).toFixed(2) },
          { pointIndex: 2, L: +(cBase.L + dL168 - 0.1).toFixed(2), a: +(cBase.a + 0.5).toFixed(2), b: +(cBase.b + 0.7).toFixed(2) },
          { pointIndex: 3, L: +(cBase.L + dL168 + 0.2).toFixed(2), a: +(cBase.a + 0.3).toFixed(2), b: +(cBase.b + 0.9).toFixed(2) },
          { pointIndex: 4, L: +(cBase.L + dL168 - 0.05).toFixed(2), a: +(cBase.a + 0.45).toFixed(2), b: +(cBase.b + 0.75).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'COLOR', colorRaw168, ruleSet);

      const glossRaw168: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(gBase + dG168 + 0.2 * pIdx).toFixed(1) },
              { pointIndex: 2, value: +(gBase + dG168 - 0.1).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(gBase + dG168 - 1.0).toFixed(1) },
              { pointIndex: 2, value: +(gBase + dG168 - 0.6).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'GLOSS', glossRaw168, ruleSet);

      const persozRaw168: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(pBase - 2 + pIdx).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(pBase - 3 + pIdx).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(pBase - 1 + pIdx).toFixed(1) }
        ],
        unit: 'SECONDS'
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'PERSOZ', persozRaw168, ruleSet);

      const obsRaw168: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun' },
          { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Légère modification de brillance' }
        ],
        assessedBy: 'SM'
      };
      recordAcquisitionDirect(trial, stage168.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw168, ruleSet);

      // --- 336h (En cours - Lot 1 & Lot 2 remplis, Lot 3 partiel) ---
      if (batch.reference === 'LOT XX1C' || (batch.reference === 'LOT XX2C' && pIdx < 3)) {
        const dL336 = batch.reference === 'LOT XX1C' ? 3.4 : 1.7;
        const dG336 = batch.reference === 'LOT XX1C' ? -9.2 : -4.1;

        const colorRaw336: ColorRawData = {
          readings: [
            { pointIndex: 1, L: +(cBase.L + dL336 + 0.1).toFixed(2), a: +(cBase.a + 0.8).toFixed(2), b: +(cBase.b + 1.4).toFixed(2) },
            { pointIndex: 2, L: +(cBase.L + dL336 - 0.2).toFixed(2), a: +(cBase.a + 0.9).toFixed(2), b: +(cBase.b + 1.3).toFixed(2) },
            { pointIndex: 3, L: +(cBase.L + dL336 + 0.3).toFixed(2), a: +(cBase.a + 0.7).toFixed(2), b: +(cBase.b + 1.5).toFixed(2) },
            { pointIndex: 4, L: +(cBase.L + dL336).toFixed(2), a: +(cBase.a + 0.85).toFixed(2), b: +(cBase.b + 1.35).toFixed(2) }
          ]
        };
        recordAcquisitionDirect(trial, stage336.id, batch.id, panel.id, 'COLOR', colorRaw336, ruleSet);

        const glossRaw336: GlossRawData = {
          series: [
            {
              seriesIndex: 1,
              orientation: 'Sens du fil',
              readings: [
                { pointIndex: 1, value: +(gBase + dG336).toFixed(1) },
                { pointIndex: 2, value: +(gBase + dG336 - 0.5).toFixed(1) }
              ]
            },
            {
              seriesIndex: 2,
              orientation: 'Perpendiculaire',
              readings: [
                { pointIndex: 1, value: +(gBase + dG336 - 1.8).toFixed(1) },
                { pointIndex: 2, value: +(gBase + dG336 - 1.2).toFixed(1) }
              ]
            }
          ],
          instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
        };
        recordAcquisitionDirect(trial, stage336.id, batch.id, panel.id, 'GLOSS', glossRaw336, ruleSet);
      }
    }
  }

  // Seeding de photographies documentaires de démo (T0, 168h, 336h)
  const panelSample = trial.batches[0]?.panels[1]; // XX1C-1
  const stage0 = trial.stages[0]; // T0
  const stage1 = trial.stages[1]; // 168h
  const stage2 = trial.stages[2]; // 336h

  if (panelSample && stage0 && stage1) {
    const makeSvg = (label: string, hours: number, stageName: string, stateText: string, colorHue: string) =>
      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${colorHue}"/><stop offset="100%" stop-color="%2378350f"/></linearGradient><pattern id="wood" width="40" height="10" patternUnits="userSpaceOnUse"><path d="M 0 5 Q 20 0 40 5" stroke="%23ffffff" stroke-width="0.5" stroke-opacity="0.15" fill="none"/></pattern></defs><rect width="600" height="400" fill="url(%23bg)"/><rect width="600" height="400" fill="url(%23wood)"/><rect x="20" y="20" width="560" height="360" rx="16" fill="none" stroke="%23ffffff" stroke-width="1.5" stroke-opacity="0.3"/><circle cx="50" cy="50" r="14" fill="%23ffffff" fill-opacity="0.2"/><text x="50" y="55" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff" text-anchor="middle">📷</text><text x="80" y="55" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23ffffff">${label} — ${hours} h (${stageName})</text><rect x="40" y="290" width="520" height="70" rx="10" fill="%230f172a" fill-opacity="0.75"/><text x="60" y="318" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23f8fafc">Suivi documentaire : ${stateText}</text><text x="60" y="342" font-family="monospace" font-size="11" fill="%2394a3b8">NF EN 927-6 • Éprouvette Pin sylvestre • QUV-Lab France</text></svg>`;

    trial.mediaReferences.push({
      id: 'photo-demo-01',
      trialId: trial.id,
      panelId: panelSample.id,
      stageId: stage0.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeSvg('LOT XX1C - Éprouvette 1', 0, 'T0', 'État initial homogène, brillant intact, surface saine', '%23b45309'),
      filename: 'PHOTO_LOT_XX1C_1_T0_0h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 245000,
      capturedAt: '2026-09-01T08:30:00Z',
      capturedBy: 'Simon Martin (Technicien)',
      caption: 'État initial avant exposition : film lasure satiné homogène, aucun défaut de surface.'
    });

    trial.mediaReferences.push({
      id: 'photo-demo-02',
      trialId: trial.id,
      panelId: panelSample.id,
      stageId: stage1.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeSvg('LOT XX1C - Éprouvette 1', 168, 'Cycle 1 (168 h)', 'Légère perte de brillance superficielle, couleur stable', '%2392400e'),
      filename: 'PHOTO_LOT_XX1C_1_C1_168h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 252000,
      capturedAt: '2026-09-08T09:15:00Z',
      capturedBy: 'Simon Martin (Technicien)',
      caption: 'Après 1 cycle (168 h) : début de matification de la zone supérieure, absence de cloquage.'
    });

    if (stage2) {
      trial.mediaReferences.push({
        id: 'photo-demo-03',
        trialId: trial.id,
        panelId: panelSample.id,
        stageId: stage2.id,
        type: 'PHOTO',
        status: 'ACTIVE',
        storageKey: makeSvg('LOT XX1C - Éprouvette 1', 336, 'Cycle 2 (336 h)', 'Matification accentuée, film adhérent, micro-relief visible', '%2378350f'),
        filename: 'PHOTO_LOT_XX1C_1_C2_336h.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 260000,
        capturedAt: '2026-09-15T10:00:00Z',
        capturedBy: 'Simon Martin (Technicien)',
        caption: 'Après 2 cycles (336 h) : évolution continue de l\'aspect de surface, conservation de l\'intégrité.'
      });
    }

    // Photo pour le témoin T à T0
    const witnessSample = trial.batches[0]?.panels[0];
    if (witnessSample) {
      trial.mediaReferences.push({
        id: 'photo-demo-t0-witness',
        trialId: trial.id,
        panelId: witnessSample.id,
        stageId: stage0.id,
        type: 'PHOTO',
        status: 'ACTIVE',
        storageKey: makeSvg('LOT XX1C - Témoin T', 0, 'T0', 'Éprouvette témoin de référence non exposée', '%231e293b'),
        filename: 'PHOTO_LOT_XX1C_T_T0.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 238000,
        capturedAt: '2026-09-01T08:20:00Z',
        capturedBy: 'Simon Martin (Technicien)',
        caption: 'Éprouvette témoin T conservée en chambre obscure conditionnée (20°C / 65% HR).'
      });
    }
  }
}

/**
 * Génère l'essai de validation de référence QUV-2026-VAL-01 (PROMPT 8 - Section 51)
 * Cas d'école complet avec T0 et 2016 h validés
 */
export function createValidationTrial(ruleSet: ScientificRuleSet): Trial {
  const trialId = 'trial-quv-2026-val-01';
  const metadata: TrialMetadata = {
    reference: 'QUV-2026-VAL-01',
    title: 'Évaluation de durabilité accélérée - Lasure Haute Durabilité Pro',
    projectOrClient: 'FINITIONS PRO SA',
    createdBy: 'SM',
    generalNotes:
      'Objectif : vieillissement accéléré selon NF EN 927-6 (Cycle A, 2016 h) pour qualification produit. ' +
      'Opérateur : Dr. S. Martin (Responsable Laboratoire). Laboratoire : QUV-Lab France — Métrologie & Matériaux. ' +
      'Référence normative : NF EN 927-6 (Cycle A - 2016 h). ' +
      'Période prévue : du 2026-03-01 au 2026-05-24.'
  };

  const commonCharacteristics: CommonCharacteristics = {
    dimensions: {
      lengthMm: 150,
      widthMm: 75,
      thicknessMm: 15,
      unit: 'mm'
    },
    materialType: 'Pin sylvestre (Pinus sylvestris L.)',
    woodGrainOrientation: 'Sur quartier (NF EN 927-6)',
    preparationNotes: 'Rabotage fin selon NF EN 927-6, dépoussiérage et conditionnement 20°C/65% HR',
    conditioningNotes: 'Stabilisation 7 jours selon NF EN 927-6 §5',
    generalProtocolNotes: 'Cycle A (NF EN 927-6 - UV-A 340 nm + Condensation + Pulvérisation) sur enceinte QUV/spray'
  };

  const protocolConfig: TrialProtocolConfig = {
    standardReference: 'NF EN 927-6',
    activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
    familyConfigs: {
      COLOR: { familyId: 'COLOR', enabled: true },
      GLOSS: { familyId: 'GLOSS', enabled: true },
      PERSOZ: { familyId: 'PERSOZ', enabled: true },
      OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true }
    }
  };

  const stages: ExposureStage[] = [];
  stages.push({
    id: `val-st-0`,
    trialId,
    cycleIndex: 0,
    stageType: 'INITIAL_PRE_EXPOSURE',
    name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
    scheduledExposureHours: 0,
    status: 'VALIDATED'
  });

  for (let c = 1; c <= 11; c++) {
    const hours = c * 168;
    stages.push({
      id: `val-st-${hours}`,
      trialId,
      cycleIndex: c,
      stageType: 'INTERMEDIATE_DURING_EXPOSURE',
      name: `${hours} h — MESURES EN COURS D'EXPOSITION`,
      scheduledExposureHours: hours,
      status: 'VALIDATED'
    });
  }

  stages.push({
    id: `val-st-2016`,
    trialId,
    cycleIndex: 12,
    stageType: 'FINAL_POST_EXPOSURE',
    name: '2016 h — MESURES FINALES APRÈS EXPOSITION',
    scheduledExposureHours: 2016,
    status: 'VALIDATED'
  });

  const batch: BatchDefinition = {
    id: 'val-batch-1',
    trialId,
    reference: 'LOT A - FINITIONS PRO',
    productReference: 'Lasure Haute Durabilité Pro',
    orderIndex: 1,
    coatingSystem: 'Lasure Haute Durabilité Pro (3 couches satin)',
    woodSpecies: 'Pin sylvestre',
    manufacturerOrSupplier: 'FINITIONS PRO SA',
    panels: [
      { id: 'val-p1', batchId: 'val-batch-1', index: 1, label: 'P01', status: 'ACTIVE' },
      { id: 'val-p2', batchId: 'val-batch-1', index: 2, label: 'P02', status: 'ACTIVE' },
      { id: 'val-p3', batchId: 'val-batch-1', index: 3, label: 'P03', status: 'ACTIVE' },
      { id: 'val-p4', batchId: 'val-batch-1', index: 4, label: 'P04', status: 'ACTIVE' }
    ]
  };

  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-05-24T18:00:00Z',
    metadata,
    commonCharacteristics,
    status: 'COMPLETED',
    configurationStatus: 'LOCKED',
    config: protocolConfig,
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [batch],
    acquisitions: {},
    auditTrail: [
      {
        id: 'val-audit-1',
        trialId,
        timestamp: '2026-03-01T08:00:00Z',
        operatorId: 'SM',
        action: 'CREATE_TRIAL',
        entityType: 'TRIAL',
        entityId: trialId
      },
      {
        id: 'val-audit-2',
        trialId,
        timestamp: '2026-05-24T18:00:00Z',
        operatorId: 'SM',
        action: 'VALIDATE_STAGE',
        entityType: 'STAGE',
        entityId: 'val-st-2016'
      }
    ],
    mediaReferences: []
  };

  // Remplissage T0 : Persoz = 178 s, Gloss = 44.1 GU, Color L=65.20, a=8.40, b=18.10
  const stage0 = stages[0];
  for (const panel of batch.panels) {
    const pIdx = panel.index;
    const colorRaw0: ColorRawData = {
      readings: [
        { pointIndex: 1, L: +(65.20 + 0.1 * pIdx).toFixed(2), a: +(8.40 + 0.05 * pIdx).toFixed(2), b: +(18.10 - 0.1 * pIdx).toFixed(2) },
        { pointIndex: 2, L: +(65.20 - 0.1 * pIdx).toFixed(2), a: +(8.40 - 0.05 * pIdx).toFixed(2), b: +(18.10 + 0.1 * pIdx).toFixed(2) },
        { pointIndex: 3, L: +(65.20 + 0.05).toFixed(2), a: +(8.40 + 0.02).toFixed(2), b: +(18.10).toFixed(2) },
        { pointIndex: 4, L: +(65.20 - 0.05).toFixed(2), a: +(8.40 - 0.02).toFixed(2), b: +(18.10).toFixed(2) }
      ]
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'COLOR', colorRaw0, ruleSet);

    const glossRaw0: GlossRawData = {
      series: [
        {
          seriesIndex: 1,
          orientation: 'Sens du fil',
          readings: [
            { pointIndex: 1, value: +(44.3 + 0.1 * pIdx).toFixed(1) },
            { pointIndex: 2, value: +(44.1 - 0.1 * pIdx).toFixed(1) }
          ]
        },
        {
          seriesIndex: 2,
          orientation: 'Perpendiculaire',
          readings: [
            { pointIndex: 1, value: +(43.9 + 0.1 * pIdx).toFixed(1) },
            { pointIndex: 2, value: +(44.1).toFixed(1) }
          ]
        }
      ],
      instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'GLOSS', glossRaw0, ruleSet);

    const persozRaw0: PersozRawData = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: +(178 + (pIdx % 2 === 0 ? 1 : -1)).toFixed(1) },
        { pointIndex: 2, dampingTimeSeconds: +(178 - (pIdx % 2 === 0 ? 1 : -1)).toFixed(1) },
        { pointIndex: 3, dampingTimeSeconds: 178.0 }
      ],
      unit: 'SECONDS'
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'PERSOZ', persozRaw0, ruleSet);

    const obsRaw0: VisualObservationsRawData = {
      observations: [
        { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'État initial intact' },
        { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Film homogène régulier' }
      ],
      assessedBy: 'SM'
    };
    recordAcquisitionDirect(trial, stage0.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw0, ruleSet);
  }

  // Remplissage étapes intermédiaires (168h à 1848h)
  for (let c = 1; c <= 11; c++) {
    const stage = stages[c];
    const fraction = c / 12;
    const currentL = 65.20 - 3.92 * fraction;
    const currentA = 8.40 + 0.75 * fraction;
    const currentB = 18.10 + 3.20 * fraction;
    const currentGloss = 44.1 - 16.2 * fraction;
    const currentPersoz = 178.0 - 27.0 * fraction;

    for (const panel of batch.panels) {
      const colorRaw: ColorRawData = {
        readings: [
          { pointIndex: 1, L: +(currentL + 0.05).toFixed(2), a: +(currentA + 0.02).toFixed(2), b: +(currentB + 0.03).toFixed(2) },
          { pointIndex: 2, L: +(currentL - 0.05).toFixed(2), a: +(currentA - 0.02).toFixed(2), b: +(currentB - 0.03).toFixed(2) },
          { pointIndex: 3, L: +(currentL).toFixed(2), a: +(currentA).toFixed(2), b: +(currentB).toFixed(2) },
          { pointIndex: 4, L: +(currentL).toFixed(2), a: +(currentA).toFixed(2), b: +(currentB).toFixed(2) }
        ]
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'COLOR', colorRaw, ruleSet);

      const glossRaw: GlossRawData = {
        series: [
          {
            seriesIndex: 1,
            orientation: 'Sens du fil',
            readings: [
              { pointIndex: 1, value: +(currentGloss + 0.2).toFixed(1) },
              { pointIndex: 2, value: +(currentGloss - 0.2).toFixed(1) }
            ]
          },
          {
            seriesIndex: 2,
            orientation: 'Perpendiculaire',
            readings: [
              { pointIndex: 1, value: +(currentGloss - 0.1).toFixed(1) },
              { pointIndex: 2, value: +(currentGloss + 0.1).toFixed(1) }
            ]
          }
        ],
        instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'GLOSS', glossRaw, ruleSet);

      const persozRaw: PersozRawData = {
        readings: [
          { pointIndex: 1, dampingTimeSeconds: +(currentPersoz + 0.5).toFixed(1) },
          { pointIndex: 2, dampingTimeSeconds: +(currentPersoz - 0.5).toFixed(1) },
          { pointIndex: 3, dampingTimeSeconds: +(currentPersoz).toFixed(1) }
        ],
        unit: 'SECONDS'
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'PERSOZ', persozRaw, ruleSet);

      const obsRaw: VisualObservationsRawData = {
        observations: [
          { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Néant' },
          { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Néant' }
        ],
        assessedBy: 'SM'
      };
      recordAcquisitionDirect(trial, stage.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw, ruleSet);
    }
  }

  // Remplissage étape finale 2016 h
  const stage2016 = stages[12];
  for (const panel of batch.panels) {
    const colorRaw2016: ColorRawData = {
      readings: [
        { pointIndex: 1, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 2, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 3, L: 61.28, a: 9.15, b: 21.30 },
        { pointIndex: 4, L: 61.28, a: 9.15, b: 21.30 }
      ]
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'COLOR', colorRaw2016, ruleSet);

    const glossRaw2016: GlossRawData = {
      series: [
        {
          seriesIndex: 1,
          orientation: 'Sens du fil',
          readings: [
            { pointIndex: 1, value: 27.9 },
            { pointIndex: 2, value: 27.9 }
          ]
        },
        {
          seriesIndex: 2,
          orientation: 'Perpendiculaire',
          readings: [
            { pointIndex: 1, value: 27.9 },
            { pointIndex: 2, value: 27.9 }
          ]
        }
      ],
      instrumentMetadata: { instrumentId: 'TRI-GLOSS-LAB01', geometry: '60' }
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'GLOSS', glossRaw2016, ruleSet);

    const persozRaw2016: PersozRawData = {
      readings: [
        { pointIndex: 1, dampingTimeSeconds: 151.0 },
        { pointIndex: 2, dampingTimeSeconds: 151.0 },
        { pointIndex: 3, dampingTimeSeconds: 151.0 }
      ],
      unit: 'SECONDS'
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'PERSOZ', persozRaw2016, ruleSet);

    const obsRaw2016: VisualObservationsRawData = {
      observations: [
        { category: 'BLISTERING', categoryLabel: 'Cloquage (ISO 4628-2)', rating: 0, status: 'CONFORME', comment: 'Aucun cloquage après 2016 h' },
        { category: 'FLAKING', categoryLabel: 'Écaillage (ISO 4628-5)', rating: 0, status: 'CONFORME', comment: 'Aucun écaillage après 2016 h' },
        { category: 'CRACKING', categoryLabel: 'Craquelage (ISO 4628-4)', rating: 0, status: 'CONFORME', comment: 'Aucun craquelage après 2016 h' },
        { category: 'CHALKING', categoryLabel: 'Farinage (ISO 4628-6)', rating: 0, status: 'CONFORME', comment: 'Aucun farinage après 2016 h' },
        { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: 0, status: 'CONFORME', comment: 'Perte de brillance satinée régulière, légère matification' }
      ],
      assessedBy: 'SM'
    };
    recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'OBSERVATIONS', obsRaw2016, ruleSet);

    // Adhérence au quadrillage C12 (2016 h - Éprouvettes exposées)
    if (panel.role !== 'WITNESS' && panel.index !== 1) {
      const spacing = (batch.dryFilmThicknessMicrons && batch.dryFilmThicknessMicrons > 120) ? 3 : 2;
      const adhClass = batch.reference === 'LOT XX1C' ? 1 : 0;
      const adhRaw2016: AdhesionRawData = {
        adhesionClass: adhClass,
        gridSpacingMm: spacing,
        coatingThicknessMicrons: batch.dryFilmThicknessMicrons,
        measurementDateTime: '2026-11-25T15:30:00Z',
        applicationDateTime: batch.applicationDate,
        requiredMinimumDelayHours: 168,
        normReference: 'NF EN ISO 2409:2020',
        observation: adhClass === 0
          ? 'Bords des incisions lisses après 2016 h d\'exposition, aucun détachement.'
          : 'Légers détachements en petits éclats au niveau des intersections des incisions (< 5 % de la surface).'
      };
      recordAcquisitionDirect(trial, stage2016.id, batch.id, panel.id, 'ADHESION', adhRaw2016, ruleSet);
    }
  }

  // Planche photographique chronologique d'exemple (T0, C3/504h, C6/1008h, C9/1512h, C12/2016h)
  const p1 = batch.panels[1]; // LOT A - 1 (E1)
  const st0 = stages[0]; // T0 - 0h
  const st3 = stages[3]; // C3 - 504h
  const st6 = stages[6]; // C6 - 1008h
  const st9 = stages[9]; // C9 - 1512h
  const st12 = stages[12]; // C12 - 2016h

  const makeValSvg = (hours: number, stageLabel: string, desc: string, gradStart: string) =>
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="valbg${hours}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${gradStart}"/><stop offset="100%" stop-color="%23451a03"/></linearGradient><pattern id="woodpat" width="50" height="12" patternUnits="userSpaceOnUse"><path d="M 0 6 Q 25 0 50 6" stroke="%23ffffff" stroke-width="0.6" stroke-opacity="0.18" fill="none"/></pattern></defs><rect width="600" height="400" fill="url(%23valbg${hours})"/><rect width="600" height="400" fill="url(%23woodpat)"/><rect x="20" y="20" width="560" height="360" rx="14" fill="none" stroke="%23ffffff" stroke-width="1.5" stroke-opacity="0.35"/><rect x="35" y="35" width="220" height="32" rx="8" fill="%230f172a" fill-opacity="0.85"/><text x="45" y="56" font-family="monospace" font-size="13" font-weight="bold" fill="%2338bdf8">LOT A - Échantillon 1</text><rect x="400" y="35" width="165" height="32" rx="8" fill="%231e293b" fill-opacity="0.85"/><text x="482" y="56" font-family="monospace" font-size="13" font-weight="bold" fill="%23fbbf24" text-anchor="middle">${stageLabel} — ${hours} h</text><rect x="35" y="295" width="530" height="70" rx="10" fill="%23020617" fill-opacity="0.8"/><text x="50" y="322" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23f8fafc">${desc}</text><text x="50" y="346" font-family="monospace" font-size="11" fill="%2394a3b8">NF EN 927-6 (Cycle A) • Pinus sylvestris • QUV-Lab Métrologie</text></svg>`;

  trial.mediaReferences.push(
    {
      id: 'photo-val-00',
      trialId: trial.id,
      panelId: p1.id,
      stageId: st0.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeValSvg(0, 'T0', 'État initial : film satiné translucide sans défaut', '%23d97706'),
      filename: 'PHOTO_LOTA_1_T0_0h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 248000,
      capturedAt: '2026-03-01T08:00:00Z',
      capturedBy: 'Dr. S. Martin (Responsable Labo)',
      caption: 'T0 (0 h) : Aspect initial sain et homogène. Aucun signe de farinage, cloquage ou craquelage.'
    },
    {
      id: 'photo-val-03',
      trialId: trial.id,
      panelId: p1.id,
      stageId: st3.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeValSvg(504, 'C3', 'Après 504 h : début de matification, teinte stable', '%23b45309'),
      filename: 'PHOTO_LOTA_1_C3_504h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 254000,
      capturedAt: '2026-03-22T09:30:00Z',
      capturedBy: 'Dr. S. Martin (Responsable Labo)',
      caption: 'C3 (504 h) : Perte de brillance modérée, très légère modification colorimétrique, excellente tenue.'
    },
    {
      id: 'photo-val-06',
      trialId: trial.id,
      panelId: p1.id,
      stageId: st6.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeValSvg(1008, 'C6', 'Après 1008 h : matification progressive, film continu', '%2392400e'),
      filename: 'PHOTO_LOTA_1_C6_1008h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 259000,
      capturedAt: '2026-04-12T11:00:00Z',
      capturedBy: 'Dr. S. Martin (Responsable Labo)',
      caption: 'C6 (1008 h) : Matification homogène constatée, structure du bois visible sans décollement.'
    },
    {
      id: 'photo-val-09',
      trialId: trial.id,
      panelId: p1.id,
      stageId: st9.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeValSvg(1512, 'C9', 'Après 1512 h : matification prononcée, intégrité préservée', '%2378350f'),
      filename: 'PHOTO_LOTA_1_C9_1512h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 263000,
      capturedAt: '2026-05-03T14:15:00Z',
      capturedBy: 'Dr. S. Martin (Responsable Labo)',
      caption: 'C9 (1512 h) : Aspect mat régulier, aucune fissuration ni dégradation locale.'
    },
    {
      id: 'photo-val-12',
      trialId: trial.id,
      panelId: p1.id,
      stageId: st12.id,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: makeValSvg(2016, 'C12', 'Après 2016 h : terme d\'exposition, aspect mat sans altération grave', '%23581c87'),
      filename: 'PHOTO_LOTA_1_C12_2016h.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 271000,
      capturedAt: '2026-05-24T16:00:00Z',
      capturedBy: 'Dr. S. Martin (Responsable Labo)',
      caption: 'C12 (2016 h) : Terme de l\'essai. Dégradation limitée à la perte de brillance normale sans rupture du film.'
    }
  );

  return trial;
}

function recordAcquisitionDirect(
  trial: Trial,
  stageId: UUID,
  batchId: UUID,
  panelId: UUID,
  familyId: MeasurementFamilyId,
  raw: unknown,
  ruleSet: ScientificRuleSet
): PanelAcquisitionRecord {
  // Garde-fou d'intégrité relationnelle (Gate 3.1 - Risque 1)
  validateAcquisitionTarget(trial, stageId, batchId, panelId);

  const key = `${stageId}__${panelId}__${familyId}`;
  const record: PanelAcquisitionRecord = {
    id: `acq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    trialId: trial.id,
    stageId,
    batchId,
    panelId,
    familyId,
    raw,
    computed: null,
    status: 'COMPLETE',
    alerts: [],
    trace: {
      createdBy: 'SM',
      createdAt: new Date().toISOString(),
      source: 'MANUAL_KEYPAD'
    },
    mediaIds: []
  };

  const { updatedRecord } = recalculateAcquisition(record, trial, ruleSet);
  trial.acquisitions[key] = updatedRecord;
  return updatedRecord;
}

/**
 * Service TrialStore complet
 */
export class TrialStoreService {
  private trials: Map<UUID, Trial> = new Map();
  private ruleSet: ScientificRuleSet;
  private isEphemeral: boolean;

  constructor(options?: { ephemeral?: boolean }) {
    this.ruleSet = getDefaultScientificRuleSet();
    this.isEphemeral = !!options?.ephemeral;
    if (!this.isEphemeral) {
      this.loadFromStorage();
    }
  }

  /**
   * Crée un store en mémoire isolé (éphémère) n'impactant ni le store global ni localStorage (Gate 55 - D-6).
   */
  public static createIsolatedStore(): TrialStoreService {
    return new TrialStoreService({ ephemeral: true });
  }

  /**
   * Migration non-destructive de la terminologie des étapes d'exposition (v6.1 -> v6.2)
   * Préserve intégralement les UUIDs, acquisitions, RAW, résultats calculés, horodatages, lots et auditTrail.
   */
  public migrateTrialTerminology(trial: Trial): Trial {
    if (!trial || !Array.isArray(trial.stages)) return trial;

    // Ensure orderNumber and reportNumber are present
    if (!trial.metadata.orderNumber) {
      trial.metadata.orderNumber = 'CO-VAN2026-001';
    }
    if (!trial.metadata.reportNumber) {
      trial.metadata.reportNumber = 'RA-VAN2026-001';
    }

    // Ensure project-level dimensions
    if (!trial.commonCharacteristics) {
      trial.commonCharacteristics = {
        dimensions: { lengthMm: 150, widthMm: 75, thicknessMm: 15, unit: 'mm' },
        substrateNature: 'Bois massif',
        materialType: 'Pin sylvestre (NF EN 927-6)'
      };
    } else if (!trial.commonCharacteristics.dimensions) {
      trial.commonCharacteristics.dimensions = { lengthMm: 150, widthMm: 75, thicknessMm: 15, unit: 'mm' };
    }

    // Normalize specimen roles & orientations
    if (Array.isArray(trial.batches)) {
      trial.batches.forEach((b) => {
        if (Array.isArray(b.panels)) {
          b.panels.forEach((p, pIdx) => {
            if (pIdx === 0 || p.label === 'P01' || p.label === 'T') {
              p.label = 'T';
              p.role = 'WITNESS';
              p.roleCode = 'T';
              if (!p.grainOrientation) p.grainOrientation = 'Quartier';
            } else {
              const expNum = pIdx;
              p.label = `${expNum}`;
              p.role = expNum === 1 ? 'EXPOSED_1' : expNum === 2 ? 'EXPOSED_2' : 'EXPOSED_3';
              p.roleCode = expNum === 1 ? 'E1' : expNum === 2 ? 'E2' : 'E3';
              if (!p.grainOrientation) p.grainOrientation = expNum === 3 ? 'Faux quartier' : 'Quartier';
              if (!p.exposureFace) p.exposureFace = 'Face externe';
            }
          });
        }
      });
    }

    trial.stages.forEach((stage, idx) => {
      const isFinal = stage.cycleIndex === 12 || (stage.cycleIndex > 0 && idx === trial.stages.length - 1);
      const isInitial = stage.cycleIndex === 0;

      if (isInitial) {
        stage.stageType = 'INITIAL_PRE_EXPOSURE';
        if (!stage.name || stage.name.includes('MESURES INITIALES') || stage.name.trim() === 'T0') {
          stage.name = 'T0 — MESURES INITIALES AVANT EXPOSITION';
        }
      } else if (isFinal) {
        stage.stageType = 'FINAL_POST_EXPOSURE';
        if (!stage.name || stage.name.includes('MESURES FINALES') || stage.name.includes('2016 h')) {
          stage.name = `${stage.scheduledExposureHours || 2016} h — MESURES FINALES APRÈS EXPOSITION`;
        }
      } else {
        // Cycles intermédiaires (168 h à 1848 h)
        stage.stageType = 'INTERMEDIATE_DURING_EXPOSURE';
        if (stage.name && stage.name.includes('MESURES APRÈS EXPOSITION')) {
          stage.name = stage.name.replace('MESURES APRÈS EXPOSITION', "MESURES EN COURS D'EXPOSITION");
        } else if (!stage.name || stage.name.trim() === `${stage.scheduledExposureHours} h`) {
          stage.name = `${stage.scheduledExposureHours} h — MESURES EN COURS D'EXPOSITION`;
        }
      }
    });

    return trial;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Trial[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((t) => {
            // Éliminer préventivement toute pollution issue d'anciens mocks de test (Gate 55 - D-6)
            if (t && t.id && !t.id.startsWith('MOCK_TEST_')) {
              const migrated = this.migrateTrialTerminology(t);
              this.trials.set(migrated.id, migrated);
            }
          });
          return;
        }
      }
    } catch {
      // ignore
    }

    // Initialisation avec démo et essai de validation si vide
    const demo = createDemoTrial(this.ruleSet);
    const valTrial = createValidationTrial(this.ruleSet);
    this.trials.set(demo.id, demo);
    this.trials.set(valTrial.id, valTrial);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (this.isEphemeral) return;
    try {
      const list = Array.from(this.trials.values()).filter((t) => !t.id.startsWith('MOCK_TEST_'));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  public getTrials(): Trial[] {
    return Array.from(this.trials.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getTrial(id: UUID): Trial | undefined {
    const trial = this.trials.get(id);
    if (trial) {
      if (!trial.auditTrail) trial.auditTrail = [];
      if (!trial.mediaReferences) trial.mediaReferences = [];
      if (!trial.acquisitions) trial.acquisitions = {};
      if (!trial.reports) trial.reports = [];
    }
    return trial;
  }

  public getAllTrials(): Trial[] {
    return this.getTrials();
  }

  public saveTrial(trial: Trial): void {
    trial.updatedAt = new Date().toISOString();
    if (!trial.auditTrail) trial.auditTrail = [];
    if (!trial.mediaReferences) trial.mediaReferences = [];
    if (!trial.acquisitions) trial.acquisitions = {};
    if (!trial.reports) trial.reports = [];
    this.trials.set(trial.id, trial);
    this.saveToStorage();
  }

  public resetToDemo(): Trial {
    this.trials.clear();
    const demo = createDemoTrial(this.ruleSet);
    this.trials.set(demo.id, demo);
    this.saveToStorage();
    return demo;
  }

  /**
   * Crée un nouvel essai depuis l'assistant (PROMPT 6 v6.1)
   */
  public createTrial(params: {
    metadata: TrialMetadata;
    commonCharacteristics?: CommonCharacteristics;
    batches: {
      reference: string;
      coatingSystem?: string;
      woodSpecies?: string;
      productReference?: string;
      manufacturerOrSupplier?: string;
      coatCount?: number;
      substratePreparation?: string;
      applicationMethod?: string;
      applicationConditions?: string;
      applicationDate?: string;
      dryingOrConditioningTime?: string;
      batchNotes?: string;
      panelCount: number;
    }[];
    activeFamilies: MeasurementFamilyId[];
    familyConfigs?: Partial<TrialProtocolConfig['familyConfigs']>;
    selectedMeasurementCycles?: number[];
  }): Trial {
    const createdBy = params.metadata?.createdBy?.trim();
    if (!createdBy) {
      throw new Error('Le créateur de l’essai est obligatoire.');
    }

    const trialId = generateUUID();
    const now = new Date().toISOString();

    const createdBatches: BatchDefinition[] = params.batches.map((b, bIdx) => {
      const batchId = generateUUID();
      const panels: PanelDefinition[] = [
        {
          id: generateUUID(),
          batchId,
          index: 1,
          label: 'T',
          role: 'WITNESS',
          roleCode: 'T',
          grainOrientation: 'Quartier',
          status: 'ACTIVE'
        },
        {
          id: generateUUID(),
          batchId,
          index: 2,
          label: '1',
          role: 'EXPOSED_1',
          roleCode: 'E1',
          grainOrientation: 'Quartier',
          exposureFace: 'Face externe',
          status: 'ACTIVE'
        },
        {
          id: generateUUID(),
          batchId,
          index: 3,
          label: '2',
          role: 'EXPOSED_2',
          roleCode: 'E2',
          grainOrientation: 'Quartier',
          exposureFace: 'Face externe',
          status: 'ACTIVE'
        },
        {
          id: generateUUID(),
          batchId,
          index: 4,
          label: '3',
          role: 'EXPOSED_3',
          roleCode: 'E3',
          grainOrientation: 'Faux quartier',
          exposureFace: 'Face externe',
          status: 'ACTIVE'
        }
      ];
      return {
        id: batchId,
        trialId,
        reference: b.reference.trim(),
        orderIndex: bIdx + 1,
        coatingSystem: b.coatingSystem,
        woodSpecies: b.woodSpecies,
        productReference: b.productReference,
        manufacturerOrSupplier: b.manufacturerOrSupplier,
        coatCount: b.coatCount,
        substratePreparation: b.substratePreparation,
        applicationMethod: b.applicationMethod,
        applicationConditions: b.applicationConditions,
        applicationDate: b.applicationDate,
        dryingOrConditioningTime: b.dryingOrConditioningTime,
        batchNotes: b.batchNotes,
        panels
      };
    });

    const protocolConfig: TrialProtocolConfig = {
      standardReference: 'NF EN 927-6',
      activeFamilies: params.activeFamilies,
      familyConfigs: {
        COLOR: params.familyConfigs?.COLOR || {
          familyId: 'COLOR',
          enabled: params.activeFamilies.includes('COLOR'),
          countConfig: createCountConfiguration('COLOR', 4, this.ruleSet)
        },
        GLOSS: params.familyConfigs?.GLOSS || {
          familyId: 'GLOSS',
          enabled: params.activeFamilies.includes('GLOSS'),
          seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, this.ruleSet)
        },
        PERSOZ: params.familyConfigs?.PERSOZ || {
          familyId: 'PERSOZ',
          enabled: params.activeFamilies.includes('PERSOZ'),
          countConfig: createCountConfiguration('PERSOZ', 3, this.ruleSet)
        },
        ADHESION: params.familyConfigs?.ADHESION || {
          familyId: 'ADHESION',
          enabled: params.activeFamilies.includes('ADHESION')
        },
        OBSERVATIONS: params.familyConfigs?.OBSERVATIONS || {
          familyId: 'OBSERVATIONS',
          enabled: params.activeFamilies.includes('OBSERVATIONS')
        }
      }
    };

    const stages = generateStandardExposureStages(trialId, params.selectedMeasurementCycles);

    const auditTrail: AuditEvent[] = [
      {
        id: generateUUID(),
        trialId,
        timestamp: now,
        operatorId: createdBy,
        action: 'CREATE_TRIAL',
        entityType: 'TRIAL',
        entityId: trialId,
        details: {
          reference: params.metadata.reference,
          title: params.metadata.title,
          batchCount: createdBatches.length,
          totalPanels: createdBatches.reduce((sum, b) => sum + b.panels.length, 0),
          measurementPlanCycles: params.selectedMeasurementCycles || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        }
      }
    ];

    const trial: Trial = {
      id: trialId,
      schemaVersion: '1.2.0',
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...params.metadata,
        createdBy
      },
      commonCharacteristics: params.commonCharacteristics,
      status: 'IN_PROGRESS',
      configurationStatus: 'EDITABLE',
      config: protocolConfig,
      scheduleConfig: {
        cycleDurationHours: 168,
        maxCycles: 12,
        initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
        intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
        finalCycle: { cycleIndex: 12, mandatory: true }
      },
      stages,
      batches: createdBatches,
      acquisitions: {},
      auditTrail,
      mediaReferences: []
    };

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Exclut un panneau de manière motivée (PROMPT 6 - Section 9)
   */
  public excludePanel(trialId: UUID, panelId: UUID, reason: string, operatorId: string): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (!reason || reason.trim().length === 0) {
      throw new Error('Le motif d\'exclusion du panneau est obligatoire.');
    }

    let foundPanel: PanelDefinition | null = null;
    let foundBatch: BatchDefinition | null = null;

    for (const b of trial.batches) {
      const p = b.panels.find((item) => item.id === panelId);
      if (p) {
        foundPanel = p;
        foundBatch = b;
        break;
      }
    }

    if (!foundPanel) throw new Error(`Panneau ${panelId} introuvable`);

    const now = new Date().toISOString();
    foundPanel.status = 'EXCLUDED';
    foundPanel.exclusionReason = reason.trim();
    foundPanel.excludedAt = now;
    foundPanel.excludedBy = operatorId || 'OPERATOR';

    trial.auditTrail.push({
      id: generateUUID(),
      trialId,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action: 'EXCLUDE_PANEL',
      entityType: 'PANEL',
      entityId: panelId,
      details: {
        batchReference: foundBatch?.reference,
        panelLabel: foundPanel.label,
        reason: reason.trim()
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Adapte le protocole de mesure avec justification (PROMPT 6 - Section 11 & 12)
   */
  public adaptProtocolConfig(
    trialId: UUID,
    familyId: MeasurementFamilyId,
    newCountOrSeries: number | { seriesCount: number; readingsPerSeries: number },
    justification: string,
    operatorId: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (trial.configurationStatus === 'LOCKED') {
      throw new Error('La configuration de l\'essai est VERROUILLÉE suite aux premières acquisitions scientifiques.');
    }

    const famConfig = trial.config.familyConfigs[familyId];
    const prevConfig = famConfig?.countConfig || famConfig?.seriesConfig;

    if (typeof newCountOrSeries === 'number') {
      const isStandard = newCountOrSeries === (this.ruleSet.measurementConfigurations[familyId]?.standardRecommendedCount ?? 4);
      if (!isStandard && (!justification || justification.trim().length === 0)) {
        throw new Error('Une justification obligatoire est requise pour toute adaptation du nombre de mesures.');
      }
      const updatedConfig = createCountConfiguration(familyId, newCountOrSeries, this.ruleSet, {
        justification,
        operatorId
      });
      trial.config.familyConfigs[familyId] = {
        ...famConfig,
        familyId,
        enabled: true,
        countConfig: updatedConfig
      };
      trial.auditTrail.push(
        createConfigChangeEvent(trialId, operatorId, familyId, prevConfig, updatedConfig, justification)
      );
    } else {
      const std = this.ruleSet.seriesConfigurations?.[familyId]?.standardConfiguration;
      const isStandard =
        std &&
        newCountOrSeries.seriesCount === std.seriesCount &&
        newCountOrSeries.readingsPerSeries === std.readingsPerSeries;
      if (!isStandard && (!justification || justification.trim().length === 0)) {
        throw new Error('Une justification obligatoire est requise pour toute adaptation de structure de séries.');
      }
      const updatedConfig = createSeriesConfiguration(
        familyId,
        newCountOrSeries.seriesCount,
        newCountOrSeries.readingsPerSeries,
        this.ruleSet,
        { justification, operatorId }
      );
      trial.config.familyConfigs[familyId] = {
        ...famConfig,
        familyId,
        enabled: true,
        seriesConfig: updatedConfig
      };
      trial.auditTrail.push(
        createConfigChangeEvent(trialId, operatorId, familyId, prevConfig, updatedConfig, justification)
      );
    }

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Enregistre ou met à jour une acquisition scientifique pour un panneau
   * Déclenche automatiquement le verrouillage de la configuration s'il s'agit de la première acquisition.
   */
  public recordAcquisition(params: {
    trialId: UUID;
    stageId: UUID;
    batchId: UUID;
    panelId: UUID;
    familyId: MeasurementFamilyId;
    raw: unknown;
    operatorId: string;
    source?: 'MANUAL_KEYPAD' | 'INSTRUMENT_IMPORT' | 'FILE_IMPORT';
    mediaIds?: UUID[];
  }): { trial: Trial; record: PanelAcquisitionRecord } {
    const trial = this.getTrial(params.trialId);
    if (!trial) throw new Error(`Essai ${params.trialId} introuvable`);

    // Garde-fou d'intégrité relationnelle (Gate 3.1 - Risque 1) avant tout effet de bord
    validateAcquisitionTarget(trial, params.stageId, params.batchId, params.panelId);

    // Règle métier canonique : ADHESION = T0 + C12 uniquement. Interdit à C1..C11.
    const targetStage = trial.stages?.find((s) => s.id === params.stageId);
    if (!targetStage) {
      throw new Error(`Jalon ${params.stageId} introuvable dans l'essai.`);
    }

    // Protection défensive D-1 (Gate 54) : Bloquer toute acquisition sur un jalon exclu du plan (INACTIVE)
    if (targetStage.status === 'INACTIVE') {
      throw new Error("Ce jalon a été exclu du plan de mesurage ; aucune acquisition n'est autorisée.");
    }

    if (params.familyId === 'ADHESION' && !isFamilyScheduledForStage('ADHESION', targetStage)) {
      throw new Error(
        `La mesure d'adhérence au quadrillage (NF EN ISO 2409) est strictement interdite aux étapes intermédiaires (C1 à C11). Elle est planifiée uniquement à T0 et C12.`
      );
    }

    const now = new Date().toISOString();

    // Verrouillage automatique si non encore verrouillé
    if (trial.configurationStatus !== 'LOCKED') {
      trial.configurationStatus = 'LOCKED';
      trial.auditTrail.push({
        id: generateUUID(),
        trialId: trial.id,
        timestamp: now,
        operatorId: 'SYSTEM',
        action: 'LOCK_TRIAL_CONFIGURATION',
        entityType: 'CONFIG',
        entityId: trial.id,
        details: { reason: 'Première acquisition scientifique enregistrée.' }
      });
    }

    const key = `${params.stageId}__${params.panelId}__${params.familyId}`;
    const prevRecord = trial.acquisitions[key];

    const newRecord: PanelAcquisitionRecord = {
      id: prevRecord ? prevRecord.id : generateUUID(),
      trialId: trial.id,
      stageId: params.stageId,
      batchId: params.batchId,
      panelId: params.panelId,
      familyId: params.familyId,
      raw: params.raw,
      computed: null,
      status: 'COMPLETE',
      alerts: [],
      trace: {
        createdBy: prevRecord ? prevRecord.trace.createdBy : params.operatorId || 'OPERATOR',
        createdAt: prevRecord ? prevRecord.trace.createdAt : now,
        lastModifiedBy: params.operatorId || 'OPERATOR',
        lastModifiedAt: now,
        source: params.source || 'MANUAL_KEYPAD'
      },
      mediaIds: params.mediaIds || prevRecord?.mediaIds || []
    };

    // Calcul immédiat via PROMPT 5 sans toucher à raw
    const { updatedRecord, rawUnchanged } = recalculateAcquisition(newRecord, trial, this.ruleSet);
    if (!rawUnchanged) {
      // Garde-fou scientifique : le moteur de calcul a modifié le RAW, ce qui ne doit
      // structurellement jamais arriver. On le rend visible plutôt que de le laisser silencieux.
      updatedRecord.alerts.push({
        id: generateUUID(),
        severity: 'BLOCKING',
        code: 'RAW_INTEGRITY_VIOLATION',
        message: 'Anomalie critique : la donnée brute (RAW) a été modifiée lors du recalcul. Intégrité scientifique compromise.',
        familyId: params.familyId,
        stageId: params.stageId,
        panelId: params.panelId
      });
    }
    trial.acquisitions[key] = updatedRecord;

    // Audit de l'acquisition
    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: now,
      operatorId: params.operatorId || 'OPERATOR',
      action: prevRecord ? 'UPDATE_ACQUISITION' : 'RECORD_ACQUISITION',
      entityType: 'ACQUISITION',
      entityId: updatedRecord.id,
      details: {
        stageId: params.stageId,
        panelId: params.panelId,
        familyId: params.familyId,
        source: newRecord.trace.source,
        quality: (updatedRecord.computed as any)?.qualityAssessment?.status || 'N/A',
        rawUnchanged
      }
    });

    this.saveTrial(trial);
    return { trial, record: updatedRecord };
  }

  /**
   * Valide une étape d'exposition
   */
  public validateStage(trialId: UUID, stageId: UUID, operatorId: string, notes?: string): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const stage = trial.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Étape ${stageId} introuvable`);

    const now = new Date().toISOString();
    stage.status = 'VALIDATED';
    stage.validatedBy = operatorId || 'OPERATOR';
    stage.validatedAt = now;
    if (notes) stage.notes = notes;

    // Passer automatiquement l'étape suivante en IN_PROGRESS si elle était NOT_STARTED
    const currentIdx = trial.stages.findIndex((s) => s.id === stageId);
    if (currentIdx >= 0 && currentIdx + 1 < trial.stages.length) {
      const nextStage = trial.stages[currentIdx + 1];
      if (nextStage.status === 'NOT_STARTED') {
        nextStage.status = 'IN_PROGRESS';
      }
    }

    trial.auditTrail.push({
      id: generateUUID(),
      trialId,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action: 'VALIDATE_STAGE',
      entityType: 'STAGE',
      entityId: stageId,
      details: { stageName: stage.name, cycleIndex: stage.cycleIndex }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Active ou désactive une étape intermédiaire d'exposition (C1 à C11)
   * T0, C12 et AFTER_EXPOSURE sont obligatoires et protégées contre toute désactivation.
   * La désactivation est NON-DESTRUCTIVE : conserve les relevés, photos, métadonnées et audit trail.
   */
  public toggleStageStatus(
    trialId: UUID,
    stageId: UUID,
    arg3?: boolean | string,
    arg4?: string,
    arg5?: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const stage = trial.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Étape ${stageId} introuvable`);

    // Protection absolue des étapes obligatoires T0, C12 (2016 h) et étapes finales
    if (
      stage.cycleIndex === 0 ||
      stage.cycleIndex === 12 ||
      stage.stageType === 'INITIAL_PRE_EXPOSURE' ||
      stage.stageType === 'FINAL_POST_EXPOSURE'
    ) {
      throw new Error(
        "L'étape initiale T0, l'étape finale C12 (2016 h) et l'étape après exposition sont obligatoires selon NF EN 927-6 et ne peuvent pas être désactivées."
      );
    }

    // 3. Protection absolue du plan verrouillé (Gate 54 - D-2) :
    // Dès la première acquisition ou lorsque la configuration est verrouillée, aucun changement de statut n'est permis.
    if (trial.configurationStatus === 'LOCKED') {
      throw new Error(
        "Le plan de mesurage est verrouillé. Aucune modification du statut des jalons n'est autorisée après le démarrage ou le verrouillage de la campagne."
      );
    }

    let active: boolean;
    let operatorId: string;
    let reason: string | undefined;

    if (typeof arg3 === 'boolean') {
      active = arg3;
      operatorId = arg4 || 'OPERATOR';
      reason = arg5;
    } else {
      active = stage.status === 'INACTIVE';
      operatorId = (arg3 as string) || 'OPERATOR';
      reason = arg4;
    }

    const now = new Date().toISOString();
    if (!trial.auditTrail) trial.auditTrail = [];

    if (!active) {
      // Protection stricte : Un jalon contenant déjà des acquisitions scientifiques ne peut pas être désactivé rétroactivement
      const hasAcquisitions = Object.values(trial.acquisitions || {}).some(
        (acq) => acq && acq.stageId === stageId && (acq.raw !== undefined || acq.status === 'COMPLETE' || acq.status === 'VALID' as any)
      );
      if (hasAcquisitions) {
        throw new Error(
          `Impossible de désactiver le jalon "${stage.name}" car des acquisitions scientifiques y sont déjà consignées.`
        );
      }

      stage.status = 'INACTIVE';
      trial.auditTrail.push({
        id: generateUUID(),
        trialId,
        timestamp: now,
        operatorId: operatorId || 'OPERATOR',
        action: 'DEACTIVATE_STAGE',
        entityType: 'STAGE',
        entityId: stageId,
        details: {
          stageName: stage.name,
          cycleIndex: stage.cycleIndex,
          scheduledExposureHours: stage.scheduledExposureHours,
          reason: reason || 'Désactivation intermédiaire du jalon'
        }
      });
    } else {
      stage.status = 'NOT_STARTED';
      trial.auditTrail.push({
        id: generateUUID(),
        trialId,
        timestamp: now,
        operatorId: operatorId || 'OPERATOR',
        action: 'REACTIVATE_STAGE',
        entityType: 'STAGE',
        entityId: stageId,
        details: {
          stageName: stage.name,
          cycleIndex: stage.cycleIndex,
          scheduledExposureHours: stage.scheduledExposureHours
        }
      });
    }

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Met à jour le plan de mesurage d'un essai avant la première acquisition (Gate 52).
   * Après la première acquisition scientifique ou si la configuration est verrouillée :
   * PLAN VERROUILLÉ, toute modification est interdite pour garantir l'intégrité de l'historique.
   */
  public updateMeasurementPlan(
    trialId: UUID,
    activeCycleIndices: number[],
    operatorId: string,
    reason?: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (trial.configurationStatus === 'LOCKED') {
      throw new Error(
        "Le plan de mesurage est verrouillé. Aucune modification n'est autorisée après le démarrage ou le verrouillage de la campagne."
      );
    }

    const hasAcquisitions = Object.keys(trial.acquisitions).length > 0;
    if (hasAcquisitions) {
      throw new Error(
        "Impossible de modifier le plan de mesurage : des acquisitions scientifiques ont déjà été enregistrées."
      );
    }

    // T0 (0) et C12 (12) sont obligatoires
    if (!activeCycleIndices.includes(0)) {
      throw new Error('Le jalon initial T0 (0 h) est obligatoire et ne peut pas être exclu du plan de mesurage.');
    }
    if (!activeCycleIndices.includes(12)) {
      throw new Error('Le jalon final C12 (2016 h) est obligatoire et ne peut pas être exclu du plan de mesurage.');
    }

    const normalizedPlan = Array.from(new Set(activeCycleIndices));

    trial.stages.forEach((stage) => {
      if (stage.cycleIndex === 0 || stage.cycleIndex === 12) {
        if (stage.status === 'INACTIVE') stage.status = 'NOT_STARTED';
        return;
      }

      const shouldBeActive = normalizedPlan.includes(stage.cycleIndex);
      if (shouldBeActive && stage.status === 'INACTIVE') {
        stage.status = 'NOT_STARTED';
      } else if (!shouldBeActive && stage.status !== 'INACTIVE') {
        stage.status = 'INACTIVE';
      }
    });

    const now = new Date().toISOString();
    if (!trial.auditTrail) trial.auditTrail = [];

    trial.auditTrail.push({
      id: generateUUID(),
      trialId,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action: 'UPDATE_MEASUREMENT_PLAN' as any,
      entityType: 'TRIAL',
      entityId: trialId,
      details: {
        activeCycles: normalizedPlan.sort((a, b) => a - b),
        reason: reason || 'Mise à jour du plan de mesurage pré-acquisition'
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Associe une photographie en garantissant l'unicité stricte du cliché actif par (panelId + stageId).
   * Si une photo existe déjà, elle est automatiquement archivée de façon non-destructive.
   */
  public attachPhoto(params: {
    trialId: UUID;
    panelId: UUID;
    stageId: UUID;
    filename: string;
    caption?: string;
    operatorId: string;
    storageKey?: string;
    replaceExisting?: boolean;
  }): Trial {
    const trial = this.getTrial(params.trialId);
    if (!trial) throw new Error(`Essai ${params.trialId} introuvable`);

    // Garde-fou d'intégrité relationnelle (Gate 3.1 - Risque 2)
    validatePhotoTarget(trial, params.stageId, params.panelId);

    const now = new Date().toISOString();
    let replacedMediaId: string | undefined;

    // Vérifier si une photo active existe déjà pour ce couple (panelId, stageId)
    const existingActivePhoto = trial.mediaReferences.find(
      (m) =>
        m.type === 'PHOTO' &&
        m.status !== 'ARCHIVED' &&
        m.panelId === params.panelId &&
        m.stageId === params.stageId
    );

    if (existingActivePhoto) {
      // Archivage automatique et non destructif de l'ancienne photo dans l'historique
      existingActivePhoto.status = 'ARCHIVED';
      existingActivePhoto.replacedAt = now;
      existingActivePhoto.replacedBy = params.operatorId || 'OPERATOR';
      replacedMediaId = existingActivePhoto.id;

      trial.auditTrail.push({
        id: generateUUID(),
        trialId: params.trialId,
        timestamp: now,
        operatorId: params.operatorId || 'OPERATOR',
        action: 'REPLACE_PHOTO',
        entityType: 'PANEL',
        entityId: params.panelId,
        details: {
          oldMediaId: existingActivePhoto.id,
          stageId: params.stageId,
          reason: 'Remplacement de photographie active par un nouveau cliché'
        }
      });
    }

    const media: PhotoReference = {
      id: generateUUID(),
      trialId: params.trialId,
      panelId: params.panelId,
      stageId: params.stageId,
      type: 'PHOTO',
      status: 'ACTIVE',
      storageKey: params.storageKey || `photos/${params.filename}`,
      filename: params.filename,
      mimeType: 'image/jpeg',
      sizeBytes: 1024 * 250,
      capturedAt: now,
      capturedBy: params.operatorId || 'OPERATOR',
      caption: params.caption,
      replacementMediaId: replacedMediaId
    };

    if (replacedMediaId) {
      const oldPhoto = trial.mediaReferences.find((m) => m.id === replacedMediaId);
      if (oldPhoto) {
        oldPhoto.replacementMediaId = media.id;
      }
    }

    trial.mediaReferences.push(media);

    // Trouver l'acquisition observation s'il y a lieu
    const obsKey = `${params.stageId}__${params.panelId}__OBSERVATIONS`;
    const obsRec = trial.acquisitions[obsKey];
    if (obsRec) {
      if (replacedMediaId) {
        obsRec.mediaIds = obsRec.mediaIds.filter((id) => id !== replacedMediaId);
      }
      if (!obsRec.mediaIds.includes(media.id)) {
        obsRec.mediaIds = [...obsRec.mediaIds, media.id];
      }
    }

    // Assurer également le remplacement cohérent sans doublon pour toute acquisition référençant l'ancienne photo
    if (replacedMediaId) {
      Object.values(trial.acquisitions).forEach((acq) => {
        if (acq.stageId === params.stageId && acq.panelId === params.panelId && Array.isArray(acq.mediaIds)) {
          if (acq.mediaIds.includes(replacedMediaId)) {
            acq.mediaIds = acq.mediaIds.filter((id) => id !== replacedMediaId);
            if (!acq.mediaIds.includes(media.id)) {
              acq.mediaIds.push(media.id);
            }
          }
        }
      });
    }

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: params.trialId,
      timestamp: now,
      operatorId: params.operatorId || 'OPERATOR',
      action: 'ATTACH_PHOTO',
      entityType: 'PANEL',
      entityId: params.panelId,
      details: {
        mediaId: media.id,
        stageId: params.stageId,
        filename: params.filename,
        replacedMediaId
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Supprime une référence de photographie
   * 
   * NOTE D'ARCHITECTURE SUR LA TRAÇABILITÉ :
   * L'opérateur passé en argument (operatorId) trace l'auteur de l'action dans l'audit trail.
   * L'application ne disposant pas encore d'un système de session utilisateur / utilisateur connecté,
   * trial.metadata.createdBy ou un identifiant fourni est actuellement utilisé comme fallback.
   * 
   * INTÉGRITÉ SCIENTIFIQUE & MÉDIAS (MESURE ≠ PHOTO) :
   * La suppression d'une photographie ne supprime JAMAIS l'acquisition correspondante.
   * Elle préserve strictement les données scientifiques de l'acquisition :
   * - acq.status reste inchangé (ex: COMPLETE)
   * - acq.raw reste inchangé
   * - acq.computed reste inchangé
   * Seule la référence dans acq.mediaIds est nettoyée pour garantir l'intégrité référentielle.
   */
  public deletePhoto(trialId: UUID, mediaId: UUID, operatorId: string): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const mediaIdx = trial.mediaReferences.findIndex(m => m.id === mediaId);
    if (mediaIdx === -1) return trial;

    const removed = trial.mediaReferences.splice(mediaIdx, 1)[0];

    // Nettoyer les références dans les acquisitions
    Object.values(trial.acquisitions).forEach(acq => {
      if (acq.mediaIds && acq.mediaIds.includes(mediaId)) {
        acq.mediaIds = acq.mediaIds.filter(id => id !== mediaId);
      }
    });

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: 'DELETE_PHOTO',
      entityType: 'PANEL',
      entityId: removed.panelId || trial.id,
      details: { mediaId, filename: removed.filename, caption: removed.caption }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Enregistre un événement d'audit de consultation des résultats (PROMPT 7 - Section 35)
   */
  public logViewResults(trialId: UUID, operatorId: string): void {
    const trial = this.getTrial(trialId);
    if (!trial) return;

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: 'VIEW_RESULTS',
      entityType: 'TRIAL',
      entityId: trial.id,
      details: { view: 'RESULTS_DASHBOARD' }
    });

    this.saveTrial(trial);
  }

  /**
   * Génère ou régénère un rapport scientifique versionné (PROMPT 7 - Section 21 & 35)
   */
  public generateScientificReportForTrial(
    trialId: UUID,
    operatorId: string,
    ruleSet: ScientificRuleSet
  ): ScientificReport {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    if (!trial.reports) {
      trial.reports = [];
    }

    const isRegeneration = trial.reports.length > 0;
    const nextVersionNumber = `v${trial.reports.length + 1}.0`;

    const report = buildScientificReport(trial, ruleSet, {
      operatorId,
      versionNumber: nextVersionNumber
    });

    trial.reports.unshift(report); // Plus récent en premier

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action: isRegeneration ? 'REGENERATE_REPORT' : 'GENERATE_REPORT',
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        reportVersion: report.metadata.reportVersion,
        isComplete: report.isComplete,
        calculationVersion: report.metadata.calculationVersion,
        scientificRuleSetId: report.metadata.scientificRuleSetId
      }
    });

    this.saveTrial(trial);
    return report;
  }

  /**
   * Met à jour le statut du rapport scientifique (Revue / Approbation)
   */
  public updateReportStatus(
    trialId: UUID,
    reportId: string,
    newStatus: ScientificReportStatus,
    operatorId: string
  ): Trial {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const report = trial.reports?.find((r) => r.id === reportId);
    if (!report) throw new Error(`Rapport ${reportId} introuvable`);

    const now = new Date().toISOString();
    report.status = newStatus;

    let action = 'REVIEW_REPORT';
    if (newStatus === 'REVIEWED') {
      report.reviewedBy = operatorId || 'REVIEWER';
      report.reviewedAt = now;
      action = 'REVIEW_REPORT';
    } else if (newStatus === 'APPROVED') {
      report.approvedBy = operatorId || 'APPROVER';
      report.approvedAt = now;
      action = 'APPROVE_REPORT';
    }

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: now,
      operatorId: operatorId || 'OPERATOR',
      action,
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        reportVersion: report.metadata.reportVersion,
        newStatus
      }
    });

    this.saveTrial(trial);
    return trial;
  }

  /**
   * Ajoute un commentaire de revue scientifique (PROMPT 7 - Section 34 & 35)
   */
  public addReportReviewComment(
    trialId: UUID,
    reportId: string,
    comment: {
      author: string;
      text: string;
      category: ScientificReportReviewComment['category'];
    }
  ): ScientificReportReviewComment {
    const trial = this.getTrial(trialId);
    if (!trial) throw new Error(`Essai ${trialId} introuvable`);

    const report = trial.reports?.find((r) => r.id === reportId);
    if (!report) throw new Error(`Rapport ${reportId} introuvable`);

    const newComment: ScientificReportReviewComment = {
      id: generateUUID(),
      reportId,
      author: comment.author || 'REVIEWER',
      createdAt: new Date().toISOString(),
      text: comment.text,
      category: comment.category
    };

    if (!report.reviewComments) {
      report.reviewComments = [];
    }
    report.reviewComments.push(newComment);

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: newComment.createdAt,
      operatorId: newComment.author,
      action: 'ADD_REPORT_COMMENT',
      entityType: 'TRIAL',
      entityId: report.id,
      details: {
        commentId: newComment.id,
        category: newComment.category,
        preview: newComment.text.slice(0, 50)
      }
    });

    this.saveTrial(trial);
    return newComment;
  }

  /**
   * Trace un export dans l'audit trail (PROMPT 7 - Section 26 & 35)
   */
  public logReportExport(
    trialId: UUID,
    reportId: string,
    exportType: 'REPORT_PDF' | 'REPORT_CSV' | 'RAW_DATA_CSV' | 'COMPUTED_DATA_CSV',
    operatorId: string
  ): void {
    const trial = this.getTrial(trialId);
    if (!trial) return;

    let action = 'EXPORT_REPORT';
    if (exportType === 'RAW_DATA_CSV') action = 'EXPORT_RAW_DATA';
    else if (exportType === 'COMPUTED_DATA_CSV') action = 'EXPORT_COMPUTED_DATA';

    trial.auditTrail.push({
      id: generateUUID(),
      trialId: trial.id,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || 'OPERATOR',
      action,
      entityType: 'TRIAL',
      entityId: reportId,
      details: { exportType }
    });

    this.saveTrial(trial);
  }
}

export const globalTrialStore = new TrialStoreService();
