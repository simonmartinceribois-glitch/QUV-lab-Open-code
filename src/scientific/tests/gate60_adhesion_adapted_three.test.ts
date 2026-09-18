/**
 * QUV-Lab — GATE 60 : ADHESION = 3 mesures/panneau
 *
 * Contrat logiciel retenu :
 * - 2 mesures/panneau = configuration de référence ;
 * - 1 ou 3 mesures/panneau = adaptation justifiée ;
 * - >3 mesures/panneau = hors périmètre du présent contrat.
 *
 * Ce test ne couvre volontairement pas les valeurs >3.
 */

import { calculateAdhesion } from '../adhesionEngine';
import { createCountConfiguration, getDefaultScientificRuleSet } from '../ruleSet';
import type { AdhesionRawData } from '../../types/scientific';

export interface Gate60TestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runGate60AdhesionAdaptedThreeTests(): {
  results: Gate60TestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Gate60TestResult[] = [];
  const record = (
    id: string,
    name: string,
    passed: boolean,
    expected: string,
    actual: string
  ) => results.push({ id, name, passed, expected, actual });

  const ruleSet = getDefaultScientificRuleSet();
  const justification = 'Adaptation labo 3 mesures';

  const config = createCountConfiguration('ADHESION', 3, ruleSet, {
    justification,
    operatorId: 'Gate60'
  });

  const raw: AdhesionRawData = {
    adhesionClass: null,
    measurements: [
      { measurementIndex: 1, adhesionClass: 1, observation: 'Mesure 1' },
      { measurementIndex: 2, adhesionClass: 2, observation: 'Mesure 2' },
      { measurementIndex: 3, adhesionClass: 3, observation: 'Mesure 3' }
    ],
    gridSpacingMm: 2,
    coatingThicknessMicrons: 80,
    measurementDateTime: '2026-09-18T10:00:00Z',
    applicationDateTime: '2026-09-18T10:00:00Z',
    requiredMinimumDelayHours: 0,
    normReference: 'NF EN ISO 2409:2020'
  };

  const result = calculateAdhesion(raw, config, ruleSet);

  record(
    'G60-ADH-01',
    'configuration 3 = adaptation justifiée',
    config.configuredCount === 3 &&
      config.standardRecommendedCount === 2 &&
      config.deviationFromStandard === true &&
      config.mode === 'CUSTOM_JUSTIFIED' &&
      config.justification === justification,
    'configuredCount=3, standard=2, deviation=true, CUSTOM_JUSTIFIED, justification persistée',
    `configuredCount=${config.configuredCount}, standard=${config.standardRecommendedCount}, deviation=${config.deviationFromStandard}, mode=${config.mode}, justification=${config.justification}`
  );

  record(
    'G60-ADH-02',
    'trois mesures RAW conservées et calculées',
    (result.computed.individualResults ?? []).length === 3 &&
      (result.computed.individualResults ?? []).every((m) => m.adhesionClass !== null) &&
      result.computed.panelMean === 2 &&
      result.computed.qualityAssessment.expectedCount === 3 &&
      result.computed.qualityAssessment.completenessPercent === 100,
    '3 résultats individuels, panelMean=2.0, expectedCount=3, complétude=100 %',
    `individualResults=${(result.computed.individualResults ?? []).length}, panelMean=${result.computed.panelMean}, expectedCount=${result.computed.qualityAssessment.expectedCount}, completeness=${result.computed.qualityAssessment.completenessPercent}`
  );

  record(
    'G60-ADH-03',
    'aucune limitation artificielle à deux mesures',
    (result.computed.individualResults ?? []).length === 3 &&
      !result.alerts.some((a) => a.code === 'MEASUREMENT_COUNT_MISMATCH'),
    '3 mesures acceptées sans troncature ni alerte de dépassement',
    `individualResults=${(result.computed.individualResults ?? []).length}, countMismatch=${result.alerts.some((a) => a.code === 'MEASUREMENT_COUNT_MISMATCH')}`
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    results,
    summary: { total: results.length, passed, failed }
  };
}
