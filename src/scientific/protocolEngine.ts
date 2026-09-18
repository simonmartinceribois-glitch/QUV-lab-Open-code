/**
 * QUV-Lab — Moteur de Conformité Protocolaire & Détection des Adaptations
 * Évalue si le plan de mesure configuré respecte la référence standard ou constitue une adaptation justifiée/injustifiée.
 */

import {
  MeasurementFamilyId,
  MeasurementCountConfiguration,
  MeasurementSeriesConfiguration,
  MeasurementProtocolDefinition,
  ProtocolComplianceStatus,
  MeasurementAlert,
  ScientificRuleSet
} from '../types/scientific';
import { isAdaptationJustificationValid } from './ruleSet';

export interface ProtocolEvaluationResult {
  status: ProtocolComplianceStatus;
  isAdapted: boolean;
  isCompliantWithStandard: boolean;
  alerts: MeasurementAlert[];
  deviationMessage?: string;
  protocolDefinition?: MeasurementProtocolDefinition;
}

/**
 * Construit un objet normalisé MeasurementProtocolDefinition à partir d'une configuration
 */
export function buildProtocolDefinition(
  config: MeasurementCountConfiguration | MeasurementSeriesConfiguration,
  ruleSet: ScientificRuleSet
): MeasurementProtocolDefinition {
  const isSeries = 'standardConfiguration' in config;
  const standardCount = isSeries
    ? config.standardConfiguration.totalReadings
    : config.standardRecommendedCount;
  const configuredCount = isSeries
    ? config.configuredConfiguration.totalReadings
    : config.configuredCount;

  return {
    familyId: config.familyId,
    origin: config.origin || (config.deviationFromStandard ? 'PROTOCOL_ADAPTATION' : 'NORMATIVE_REQUIREMENT'),
    standardReference: config.standardReference || ruleSet.standardReference,
    clause: config.clause,
    rationale: config.rationale,
    standardRecommendedCount: standardCount,
    configuredCount,
    isAdapted: config.deviationFromStandard,
    justification: config.justification,
    deviationReason: config.deviationReason,
    configuredBy: config.configuredBy,
    configuredAt: config.configuredAt
  };
}

/**
 * Évalue la conformité protocolaire d'une configuration scalaire (ex: Couleur, Persoz)
 */
export function evaluateCountProtocolCompliance(
  config: MeasurementCountConfiguration | undefined,
  ruleSet: ScientificRuleSet
): ProtocolEvaluationResult {
  if (!config) {
    return {
      status: 'INCOMPLETE',
      isAdapted: false,
      isCompliantWithStandard: false,
      alerts: [
        {
          id: 'alert-proto-missing',
          severity: 'BLOCKING',
          code: 'PROTOCOL_ADAPTATION_UNJUSTIFIED',
          message: 'Configuration du plan de mesure manquante.',
          familyId: 'UNKNOWN'
        }
      ]
    };
  }

  // Compatibilité historique (Gate 57 / D-10 GO) : le standard de référence est celui
  // enregistré dans la configuration au moment de sa création, pas le standard live du
  // référentiel. Ainsi les configs 1/1/STANDARD antérieures au Gate 57 restent STANDARD
  // au lieu de basculer artificiellement en adaptation. Les nouvelles configs portent le
  // standard courant via createCountConfiguration(), donc le comportement est identique
  // pour tout ce qui est construit après le changement de standard.
  const standardRef = ruleSet.measurementConfigurations[config.familyId];
  const standardRecommended = standardRef?.standardRecommendedCount;
  if (standardRecommended === undefined) {
    return {
      status: 'INCOMPLETE',
      isAdapted: false,
      isCompliantWithStandard: false,
      alerts: [{
        id: `alert-proto-reference-missing-${config.familyId}`,
        severity: 'BLOCKING',
        code: 'CALCULATION_UNAVAILABLE',
        message: `Configuration scientifique standard manquante pour la famille ${config.familyId}.`,
        familyId: config.familyId
      }]
    };
  }
  if (!Number.isInteger(config.configuredCount) || config.configuredCount < 1) return { status: 'INVALID', isAdapted: false, isCompliantWithStandard: false, alerts: [{ id: `alert-proto-invalid-count-${config.familyId}`, severity: 'BLOCKING', code: 'MEASUREMENT_INVALID', message: 'Nombre de mesures invalide : entier >= 1 requis.', familyId: config.familyId }] };
  if (config.familyId === 'ADHESION' && config.configuredCount > 3) return { status: 'INVALID', isAdapted: false, isCompliantWithStandard: false, alerts: [{ id: 'alert-proto-adhesion-count-range', severity: 'BLOCKING', code: 'MEASUREMENT_INVALID', message: 'Le nombre de mesures d’adhérence doit être compris entre 1 et 3.', familyId: 'ADHESION' }] };
  const isAdapted = config.configuredCount !== standardRecommended || config.mode === 'CUSTOM_JUSTIFIED';

  const alerts: MeasurementAlert[] = [];

  if (!isAdapted) {
    return {
      status: 'STANDARD',
      isAdapted: false,
      isCompliantWithStandard: true,
      alerts,
      protocolDefinition: buildProtocolDefinition(config, ruleSet)
    };
  }

  // Si adapté, vérifier la justification : absence, vide ou < 8 caractères (après
  // trim) ⇒ adaptation NON JUSTIFIÉE (détection conservée pour historique/import).
  const hasJustification = isAdaptationJustificationValid(config.justification);

  if (hasJustification) {
    alerts.push({
      id: `alert-proto-adapted-${config.familyId}`,
      severity: 'INFO',
      code: 'PROTOCOL_ADAPTED',
      message: `Protocole adapté et justifié : ${config.configuredCount} relevé(s) au lieu des ${standardRecommended} de référence. Justification : "${config.justification}"`,
      familyId: config.familyId
    });

    return {
      status: 'ADAPTED_JUSTIFIED',
      isAdapted: true,
      isCompliantWithStandard: false,
      alerts,
      deviationMessage: `Protocole adapté (${config.configuredCount}/${standardRecommended} pts) — Justifié : ${config.justification}`,
      protocolDefinition: buildProtocolDefinition(config, ruleSet)
    };
  }

  // Adaptation SANS justification : bloquant !
  alerts.push({
    id: `alert-proto-unjustified-${config.familyId}`,
    severity: 'BLOCKING',
    code: 'PROTOCOL_ADAPTATION_UNJUSTIFIED',
    message: `Protocole adapté non justifié : ${config.configuredCount} relevé(s) configuré(s) au lieu des ${standardRecommended} recommandés par ${ruleSet.standardReference}. Une justification obligatoire est requise.`,
    familyId: config.familyId
  });

  return {
    status: 'ADAPTED_UNJUSTIFIED',
    isAdapted: true,
    isCompliantWithStandard: false,
    alerts,
    deviationMessage: `Protocole adapté non justifié (${config.configuredCount}/${standardRecommended} pts) — Bloquant pour validation`,
    protocolDefinition: buildProtocolDefinition(config, ruleSet)
  };
}

/**
 * Évalue la conformité protocolaire d'une configuration multi-séries (ex: Brillance 2x2 vs 2x1)
 */
export function evaluateSeriesProtocolCompliance(
  config: MeasurementSeriesConfiguration | undefined,
  ruleSet: ScientificRuleSet
): ProtocolEvaluationResult {
  if (!config) {
    return {
      status: 'INCOMPLETE',
      isAdapted: false,
      isCompliantWithStandard: false,
      alerts: [
        {
          id: 'alert-proto-series-missing',
          severity: 'BLOCKING',
          code: 'PROTOCOL_ADAPTATION_UNJUSTIFIED',
          message: 'Configuration de séries de mesure manquante.',
          familyId: 'GLOSS'
        }
      ]
    };
  }

  const standardRef = ruleSet.seriesConfigurations?.[config.familyId];
  if (!standardRef) {
    return { status: 'INCOMPLETE', isAdapted: false, isCompliantWithStandard: false, alerts: [{ id: `alert-proto-series-reference-missing-${config.familyId}`, severity: 'BLOCKING', code: 'CALCULATION_UNAVAILABLE', message: `Configuration scientifique standard manquante pour la famille de séries ${config.familyId}.`, familyId: config.familyId }] };
  }
  const stdSeries = standardRef.standardConfiguration.seriesCount;
  const stdReadings = standardRef.standardConfiguration.readingsPerSeries;

  const isAdapted =
    config.configuredConfiguration.seriesCount !== stdSeries ||
    config.configuredConfiguration.readingsPerSeries !== stdReadings ||
    config.mode === 'CUSTOM_JUSTIFIED';

  const alerts: MeasurementAlert[] = [];

  if (!isAdapted) {
    return {
      status: 'STANDARD',
      isAdapted: false,
      isCompliantWithStandard: true,
      alerts,
      protocolDefinition: buildProtocolDefinition(config, ruleSet)
    };
  }

  const hasJustification = isAdaptationJustificationValid(config.justification);

  if (hasJustification) {
    alerts.push({
      id: `alert-proto-series-adapted-${config.familyId}`,
      severity: 'INFO',
      code: 'PROTOCOL_ADAPTED',
      message: `Structure de brillance adaptée et justifiée : ${config.configuredConfiguration.seriesCount} × ${config.configuredConfiguration.readingsPerSeries} (${config.configuredConfiguration.totalReadings} pts) au lieu de ${stdSeries} × ${stdReadings} (${stdSeries * stdReadings} pts). Justification : "${config.justification}"`,
      familyId: config.familyId
    });

    return {
      status: 'ADAPTED_JUSTIFIED',
      isAdapted: true,
      isCompliantWithStandard: false,
      alerts,
      deviationMessage: `Structure adaptée (${config.configuredConfiguration.seriesCount}×${config.configuredConfiguration.readingsPerSeries}) — Justifié`,
      protocolDefinition: buildProtocolDefinition(config, ruleSet)
    };
  }

  alerts.push({
    id: `alert-proto-series-unjustified-${config.familyId}`,
    severity: 'BLOCKING',
    code: 'PROTOCOL_ADAPTATION_UNJUSTIFIED',
    message: `Structure de mesure adaptée sans justification : ${config.configuredConfiguration.seriesCount} × ${config.configuredConfiguration.readingsPerSeries} au lieu de ${stdSeries} × ${stdReadings}. Une justification obligatoire est requise.`,
    familyId: config.familyId
  });

  return {
    status: 'ADAPTED_UNJUSTIFIED',
    isAdapted: true,
    isCompliantWithStandard: false,
    alerts,
    deviationMessage: `Structure adaptée sans justification (${config.configuredConfiguration.seriesCount}×${config.configuredConfiguration.readingsPerSeries}) — Bloquant`,
    protocolDefinition: buildProtocolDefinition(config, ruleSet)
  };
}


/** Generic date/delay computation for protocol pre-exposure conditioning. */
export function calculatePreExposureDelayCompliance(
  applicationDateStr?: string,
  measurementDateStr?: string,
  requiredMinimumHours?: number
): {
  elapsedTimeHours: number | null;
  formattedElapsedTime: string;
  status: 'CONFORME' | 'INSUFFICIENT_DELAY' | 'INVALID_DATE' | 'MISSING_APPLICATION_DATE' | 'MISSING_REQUIRED_DELAY';
  message: string;
} {
  if (requiredMinimumHours === undefined || !Number.isFinite(requiredMinimumHours) || requiredMinimumHours < 0) return { elapsedTimeHours: null, formattedElapsedTime: 'Délai requis non renseigné', status: 'MISSING_REQUIRED_DELAY', message: 'Délai minimal requis absent ou invalide dans la configuration du protocole.' };
  if (!applicationDateStr?.trim()) return { elapsedTimeHours: null, formattedElapsedTime: 'Non déterminée', status: 'MISSING_APPLICATION_DATE', message: 'Date d’application absente.' };
  const app = Date.parse(applicationDateStr), measure = Date.parse(measurementDateStr || '');
  if (!Number.isFinite(app) || !Number.isFinite(measure) || measure < app) return { elapsedTimeHours: null, formattedElapsedTime: 'Date invalide', status: 'INVALID_DATE', message: 'Dates invalides pour le contrôle du conditionnement.' };
  const elapsed = (measure - app) / 3600000;
  const formatted = elapsed >= 24 ? `${Math.floor(elapsed / 24)} j ${Math.floor(elapsed % 24)} h` : `${Math.floor(elapsed)} h`;
  return elapsed < requiredMinimumHours
    ? { elapsedTimeHours: Math.round(elapsed * 10) / 10, formattedElapsedTime: formatted, status: 'INSUFFICIENT_DELAY', message: `Conditionnement insuffisant : ${formatted} écoulées pour ${requiredMinimumHours} h requises.` }
    : { elapsedTimeHours: Math.round(elapsed * 10) / 10, formattedElapsedTime: formatted, status: 'CONFORME', message: `Conditionnement respecté : ${formatted} écoulées pour ${requiredMinimumHours} h requises.` };
}

export interface PreExposureConditioningResult {
  status: 'CONFORME' | 'INSUFFICIENT_DELAY' | 'INVALID_DATE' | 'MISSING_APPLICATION_DATE' | 'MISSING_RULE';
  elapsedHours: number | null;
  requiredHours: number | null;
  alert?: MeasurementAlert;
}

/** Contrôle général du conditionnement avant les examens initiaux T0.
 * Cette règle est commune aux familles mesurées avant exposition ; elle n'appartient
 * pas au moteur ADHESION. Le RAW conserve les dates réelles ; le RuleSet porte le délai requis.
 */
export function evaluatePreExposureConditioning(
  applicationDate?: string,
  measurementDate?: string,
  ruleSet?: ScientificRuleSet,
  familyId?: MeasurementFamilyId,
  stageId?: string,
  panelId?: string
): PreExposureConditioningResult {
  const requiredHours = ruleSet?.preExposureConditioning?.requiredHours;
  const normalizedRequiredHours = Number.isFinite(requiredHours) && (requiredHours as number) >= 0 ? (requiredHours as number) : null;
  if (normalizedRequiredHours === null) {
    return { status: 'MISSING_RULE', elapsedHours: null, requiredHours: normalizedRequiredHours ?? 0, alert: {
      id: `alert-conditioning-rule-missing-${familyId || 'UNKNOWN'}`, severity: 'BLOCKING', code: 'CALCULATION_UNAVAILABLE',
      message: 'Règle de conditionnement avant T0 absente du RuleSet.', familyId: familyId || 'UNKNOWN', stageId, panelId
    }};
  }
  if (!applicationDate) return { status: 'MISSING_APPLICATION_DATE', elapsedHours: null, requiredHours: normalizedRequiredHours, alert: {
    id: `alert-conditioning-application-date-${familyId || 'UNKNOWN'}`, severity: 'BLOCKING', code: 'MEASUREMENT_INVALID',
    message: 'Date d’application de la finition absente : le délai avant T0 ne peut pas être contrôlé.', familyId: familyId || 'UNKNOWN', stageId, panelId
  }};
  const app = Date.parse(applicationDate);
  const measured = measurementDate ? Date.parse(measurementDate) : NaN;
  if (!Number.isFinite(app) || !Number.isFinite(measured) || measured < app) return { status: 'INVALID_DATE', elapsedHours: null, requiredHours: normalizedRequiredHours, alert: {
    id: `alert-conditioning-date-${familyId || 'UNKNOWN'}`, severity: 'BLOCKING', code: 'MEASUREMENT_INVALID',
    message: 'Dates invalides pour le contrôle du conditionnement avant T0.', familyId: familyId || 'UNKNOWN', stageId, panelId
  }};
  const elapsedHours = (measured - app) / 3600000;
  if (elapsedHours < normalizedRequiredHours) return { status: 'INSUFFICIENT_DELAY', elapsedHours, requiredHours: normalizedRequiredHours, alert: {
    id: `alert-conditioning-delay-${familyId || 'UNKNOWN'}`, severity: 'BLOCKING', code: 'PROTOCOL_ADAPTED',
    message: `Conditionnement avant T0 insuffisant : ${elapsedHours.toFixed(1)} h écoulées pour ${requiredHours} h requises selon ${ruleSet?.preExposureConditioning?.standardReference} ${ruleSet?.preExposureConditioning?.clause}.`, familyId: familyId || 'UNKNOWN', stageId, panelId
  }};
  return { status: 'CONFORME', elapsedHours, requiredHours };
}
