/**
 * QUV-Lab — Service de Recalcul & Pipeline Scientifique en 10 Étapes
 * Lit uniquement RAW, applique le référentiel scientifique, produit COMPUTED et garantit l'immuabilité de RAW.
 */

import {
  Trial,
  PanelAcquisitionRecord
} from '../types/trial';
import {
  ScientificRuleSet,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  AcquisitionStatus,
  MeasurementAlert,
  ReferenceTrace,
  ReferenceRule
} from '../types/scientific';
import { calculateColor } from './colorEngine';
import { calculateGloss } from './glossEngine';
import { calculatePersoz } from './persozEngine';
import { calculateAdhesion, resolveAdhesionCountConfig } from './adhesionEngine';
import { calculateObservations } from './observationsEngine';
import { getWitnessPanel } from './panelUtils';
import { VisualObservationsRawData, AdhesionRawData } from '../types/scientific';

export interface RecalculationResult {
  updatedRecord: PanelAcquisitionRecord;
  rawUnchanged: boolean;
}

/**
 * Recalcule une acquisition spécifique sans altérer le RAW
 */
export function recalculateAcquisition(
  record: PanelAcquisitionRecord,
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: {
    customCalculationVersion?: string;
  }
): RecalculationResult {
  // Copie de sécurité pour vérifier l'immuabilité absolue
  const rawSnapshotBefore = JSON.stringify(record.raw);

  // Recherche de l'étape de référence (T0 par défaut)
  const initialStage = trial.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE' || s.cycleIndex === 0);
  const isCurrentInitial = record.stageId === initialStage?.id;

  let referenceRaw: unknown = null;
  // Identité de l'acquisition source (traçabilité explicite, jamais inventée).
  let referenceStageId: string | null = null;
  let referencePanelId: string | null = null;
  let referenceAcquisitionId: string | null = null;
  if (!isCurrentInitial && initialStage) {
    // Règle ADHESION : la référence T0 est celle du panneau TÉMOIN du lot
    // (T non exposé), jamais celle du panneau exposé lui-même.
    // Les autres familles conservent la référence T0 du même panneau.
    let resolvedReferencePanelId = record.panelId;
    if (record.familyId === 'ADHESION') {
      const batch = trial.batches?.find((b) => b.id === record.batchId);
      const witness = batch ? getWitnessPanel(batch.panels || []) : undefined;
      if (witness) {
        resolvedReferencePanelId = witness.id;
      }
    }
    const refKey = `${initialStage.id}__${resolvedReferencePanelId}__${record.familyId}`;
    const refRecord = trial.acquisitions[refKey];
    if (refRecord) {
      referenceRaw = refRecord.raw;
      referenceStageId = initialStage.id;
      referencePanelId = resolvedReferencePanelId;
      referenceAcquisitionId = refRecord.id;
    }
  }

  let computed: unknown = null;
  let alerts: MeasurementAlert[] = [];

  const famConfig = trial.config.familyConfigs[record.familyId];

  if (record.familyId === 'COLOR') {
    const countConfig = famConfig?.countConfig || ruleSet.measurementConfigurations.COLOR;
    const res = calculateColor(
      record.raw as ColorRawData,
      countConfig,
      ruleSet,
      {
        referenceRaw: referenceRaw as ColorRawData | null,
        referenceStageId: initialStage?.id,
        panelId: record.panelId,
        stageId: record.stageId,
        calculationVersion: options?.customCalculationVersion
      }
    );
    computed = res.computed;
    alerts = res.alerts;
  } else if (record.familyId === 'GLOSS') {
    const seriesConfig = famConfig?.seriesConfig || ruleSet.seriesConfigurations?.GLOSS;
    if (seriesConfig) {
      const res = calculateGloss(
        record.raw as GlossRawData,
        seriesConfig,
        ruleSet,
        {
          referenceRaw: referenceRaw as GlossRawData | null,
          referenceStageId: initialStage?.id,
          panelId: record.panelId,
          stageId: record.stageId,
          calculationVersion: options?.customCalculationVersion
        }
      );
      computed = res.computed;
      alerts = res.alerts;
    }
  } else if (record.familyId === 'PERSOZ') {
    const countConfig = famConfig?.countConfig || ruleSet.measurementConfigurations.PERSOZ;
    const res = calculatePersoz(
      record.raw as PersozRawData,
      countConfig,
      ruleSet,
      {
        referenceRaw: referenceRaw as PersozRawData | null,
        referenceStageId: initialStage?.id,
        panelId: record.panelId,
        stageId: record.stageId,
        calculationVersion: options?.customCalculationVersion
      }
    );
    computed = res.computed;
    alerts = res.alerts;
  } else if (record.familyId === 'ADHESION') {
    // Gate 57 / D4 : une configuration ADHESION sans `countConfig` enregistré
    // (essais pré-Gate 57) est interprétée comme le protocole historique 1/1,
    // SANS modifier la configuration stockée. Le référentiel live ne rétrograde
    // jamais un essai historique en 1/2 WARNING.
    const countConfig = resolveAdhesionCountConfig(famConfig?.countConfig);
    const res = calculateAdhesion(
      record.raw as AdhesionRawData,
      countConfig,
      ruleSet,
      {
        referenceRaw: referenceRaw as AdhesionRawData | null,
        referenceStageId: initialStage?.id,
        panelId: record.panelId,
        stageId: record.stageId,
        calculationVersion: options?.customCalculationVersion
      }
    );
    computed = res.computed;
    alerts = res.alerts;
  } else if (record.familyId === 'OBSERVATIONS') {
    const res = calculateObservations(
      record.raw as VisualObservationsRawData,
      ruleSet,
      {
        panelId: record.panelId,
        stageId: record.stageId,
        calculationVersion: options?.customCalculationVersion
      }
    );
    computed = res.computed;
    alerts = res.alerts;
  }

  // Détermination du statut de l'acquisition
  let status: AcquisitionStatus = 'COMPLETE';
  if (alerts.some((a) => a.severity === 'BLOCKING')) {
    status = 'ERROR';
  } else if (alerts.some((a) => a.severity === 'WARNING')) {
    status = 'WARNING';
  } else if (!computed) {
    status = 'EMPTY';
  }

  // Traçabilité explicite : la règle décrit la sélection réellement appliquée
  // ci-dessus ; les identifiants sont ceux de l'acquisition source trouvée,
  // null quand aucune référence n'est utilisée (jamais inventés).
  // OBSERVATIONS ne consomme aucune référence (moteur sans referenceRaw).
  const consumesReference =
    record.familyId === 'COLOR' ||
    record.familyId === 'GLOSS' ||
    record.familyId === 'PERSOZ' ||
    record.familyId === 'ADHESION';
  let referenceRule: ReferenceRule = 'NONE';
  if (consumesReference && referenceAcquisitionId !== null) {
    referenceRule = record.familyId === 'ADHESION' ? 'T0_WITNESS_REFERENCE' : 'SAME_PANEL_T0';
  }
  const referenceTrace: ReferenceTrace = {
    referenceStageId: consumesReference ? referenceStageId : null,
    referencePanelId: consumesReference ? referencePanelId : null,
    referenceAcquisitionId: consumesReference ? referenceAcquisitionId : null,
    referenceRule
  };
  if (computed !== null && typeof computed === 'object') {
    computed = { ...(computed as Record<string, unknown>), referenceTrace };
  }

  // Vérification de l'immuabilité
  const rawSnapshotAfter = JSON.stringify(record.raw);
  const rawUnchanged = rawSnapshotBefore === rawSnapshotAfter;

  const updatedRecord: PanelAcquisitionRecord = {
    ...record,
    computed,
    alerts,
    status,
    trace: {
      ...record.trace,
      lastModifiedAt: new Date().toISOString()
    }
  };

  return {
    updatedRecord,
    rawUnchanged
  };
}

/**
 * Recalcule toutes les acquisitions d'un essai
 */
export function recalculateAllTrialAcquisitions(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: {
    customCalculationVersion?: string;
  }
): { updatedAcquisitions: Record<string, PanelAcquisitionRecord>; allRawUnchanged: boolean } {
  const updatedAcquisitions: Record<string, PanelAcquisitionRecord> = {};
  let allRawUnchanged = true;

  for (const [key, record] of Object.entries(trial.acquisitions)) {
    const { updatedRecord, rawUnchanged } = recalculateAcquisition(
      record,
      trial,
      ruleSet,
      options
    );
    updatedAcquisitions[key] = updatedRecord;
    if (!rawUnchanged) allRawUnchanged = false;
  }

  return { updatedAcquisitions, allRawUnchanged };
}
