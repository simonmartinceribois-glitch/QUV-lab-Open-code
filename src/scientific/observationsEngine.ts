/**
 * QUV-Lab — Moteur d'Évaluation des Observations Visuelles (ISO 4628 / NF EN 927-6)
 * Évalue les cotations visuelles, détecte les anomalies d'aspect et préserve l'intégrité du RAW.
 * Une cotation absente ou invalide n'est JAMAIS interprétée comme une cotation 0.
 */

import {
  VisualObservationsRawData,
  VisualObservationsComputedData,
  MeasurementAlert,
  QualityAssessment,
  QualityStatus,
  ProtocolComplianceStatus,
  ScientificRuleSet,
  UUID
} from '../types/scientific';

export const OBSERVATIONS_CALCULATION_VERSION = '1.2.0';

export const OBSERVATION_RATING_MIN = 0;
export const OBSERVATION_RATING_MAX = 5;

export type ObservationRatingValidity = 'VALID' | 'MISSING' | 'INVALID';

export interface ObservationRatingParseResult {
  validity: ObservationRatingValidity;
  /** Cotation numérale (0..5) pour une donnée VALID, null sinon. */
  value: number | null;
}

/**
 * Valide une cotation visuelle individuelle (source de vérité unique, partagée par
 * le moteur et le comparateur multi-systèmes). Domaine numérique 0..5 (0 = Intact,
 * 5 = Altération Sévère) ; une chaîne numérique du domaine est acceptée ; une valeur
 * absente est MISSING ; une valeur non numérique, non finie ou hors domaine est INVALID.
 */
export function parseObservationRating(
  rating: string | number | null | undefined
): ObservationRatingParseResult {
  if (rating === undefined || rating === null || rating === '') {
    return { validity: 'MISSING', value: null };
  }
  if (typeof rating === 'number') {
    if (
      Number.isFinite(rating) &&
      rating >= OBSERVATION_RATING_MIN &&
      rating <= OBSERVATION_RATING_MAX
    ) {
      return { validity: 'VALID', value: rating };
    }
    return { validity: 'INVALID', value: null };
  }
  const trimmed = rating.trim();
  if (trimmed === '') {
    return { validity: 'MISSING', value: null };
  }
  const num = Number(trimmed);
  if (
    Number.isFinite(num) &&
    num >= OBSERVATION_RATING_MIN &&
    num <= OBSERVATION_RATING_MAX
  ) {
    return { validity: 'VALID', value: num };
  }
  return { validity: 'INVALID', value: null };
}

export interface ObservationsCalculationResult {
  computed: VisualObservationsComputedData;
  alerts: MeasurementAlert[];
}

export function calculateObservations(
  rawData: VisualObservationsRawData | null | undefined,
  ruleSet: ScientificRuleSet,
  options?: {
    panelId?: UUID;
    stageId?: UUID;
    calculationVersion?: string;
  }
): ObservationsCalculationResult {
  const alerts: MeasurementAlert[] = [];
  const calculationVersion = options?.calculationVersion || OBSERVATIONS_CALCULATION_VERSION;
  const calculatedAt = new Date().toISOString();

  if (!rawData || !Array.isArray(rawData.observations) || rawData.observations.length === 0) {
    alerts.push({
      id: `alert-obs-empty-${Date.now()}`,
      severity: 'WARNING',
      code: 'MEASUREMENT_MISSING',
      message: 'Aucune observation visuelle enregistrée pour ce panneau.',
      familyId: 'OBSERVATIONS',
      panelId: options?.panelId,
      stageId: options?.stageId
    });

    const qualityAssessment: QualityAssessment = {
      status: 'INVALID',
      validCount: 0,
      expectedCount: 0,
      actualCount: 0,
      suspectCount: 0,
      invalidCount: 0,
      missingCount: 0,
      completenessPercent: 0,
      warnings: ['Données d\'observation manquantes']
    };

    const protocolStatus: ProtocolComplianceStatus = 'INCOMPLETE';

    return {
      computed: {
        totalEvaluated: 0,
        defectsCount: 0,
        maxRating: null,
        summary: 'Non évalué',
        qualityAssessment,
        protocolStatus,
        computation: {
          calculationVersion,
          calculatedAt
        }
      },
      alerts
    };
  }

  const totalEvaluated = rawData.observations.length;
  let validCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let defectsCount = 0;
  let maxRatingNum: number | null = null;
  const defectDescriptions: string[] = [];

  for (const obs of rawData.observations) {
    const { validity, value } = parseObservationRating(obs.rating);

    if (validity === 'VALID' && value !== null) {
      validCount++;
      if (maxRatingNum === null || value > maxRatingNum) maxRatingNum = value;

      if (value > 0 || obs.status === 'NON_CONFORME' || obs.status === 'OBSERVE') {
        defectsCount++;
        defectDescriptions.push(`${obs.categoryLabel || obs.category} (Note: ${String(obs.rating)})`);

        if (value >= 3) {
          alerts.push({
            id: `alert-obs-severe-${obs.category}-${Date.now()}`,
            severity: 'WARNING',
            code: 'STATISTICAL_WARNING',
            message: `Défaut visuel marqué détecté : ${obs.categoryLabel || obs.category} (cotation ${String(obs.rating)}).`,
            familyId: 'OBSERVATIONS',
            panelId: options?.panelId,
            stageId: options?.stageId
          });
        }
      }
    } else if (validity === 'MISSING') {
      missingCount++;
    } else {
      invalidCount++;
      alerts.push({
        id: `alert-obs-invalid-${obs.category}-${Date.now()}`,
        severity: 'WARNING',
        code: 'MEASUREMENT_INVALID',
        message: `Cotation invalide pour ${obs.categoryLabel || obs.category} (« ${String(obs.rating)} »). Valeurs acceptées : 0 à 5.`,
        familyId: 'OBSERVATIONS',
        panelId: options?.panelId,
        stageId: options?.stageId
      });
    }
  }

  const completenessPercent = validCount === 0
    ? 0
    : Math.round((validCount / totalEvaluated) * 100);

  const warnings: string[] = [];
  if (missingCount > 0) warnings.push(`${missingCount} observation(s) manquante(s)`);
  if (invalidCount > 0) warnings.push(`${invalidCount} cotation(s) invalide(s)`);
  if (defectsCount > 0) warnings.push(`${defectsCount} anomalie(s) visuelle(s) relevée(s)`);

  const qualityStatus: QualityStatus =
    invalidCount > 0
      ? 'INVALID'
      : defectsCount > 0
        ? (maxRatingNum !== null && maxRatingNum >= 3 ? 'WARNING' : 'ACCEPTABLE')
        : missingCount > 0
          ? 'WARNING'
          : 'GOOD';

  const qualityAssessment: QualityAssessment = {
    status: qualityStatus,
    validCount,
    expectedCount: totalEvaluated,
    actualCount: validCount + invalidCount,
    suspectCount: 0,
    invalidCount,
    missingCount,
    completenessPercent,
    warnings
  };

  const protocolStatus: ProtocolComplianceStatus =
    missingCount > 0 || invalidCount > 0 ? 'INCOMPLETE' : 'STANDARD';

  const summary =
    defectsCount > 0
      ? `Défauts : ${defectDescriptions.slice(0, 3).join(', ')}${defectDescriptions.length > 3 ? '...' : ''}`
      : validCount === 0
        ? 'Non évalué'
        : 'Aspect intact (Aucun défaut)';

  return {
    computed: {
      totalEvaluated,
      defectsCount,
      maxRating: maxRatingNum,
      summary,
      qualityAssessment,
      protocolStatus,
      computation: {
        calculationVersion,
        calculatedAt
      }
    },
    alerts
  };
}