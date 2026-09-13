/**
 * QUV-Lab — Test de non-régression : absence d'alerte de sévérité visuelle.
 *
 * Contexte (audit 11-12/09/2026, anomalie P3-a) : le commit 18f7108
 * (refactor/strict-arch, PR #108, 11/09) a retiré l'émission d'une alerte
 * WARNING/STATISTICAL_WARNING pour toute observation visuelle cotée >= 3
 * (échelle ISO 4628 0..5), au motif que ce seuil ne doit jamais constituer un
 * critère de conformité normative (cf. commentaire dans observationsEngine.ts).
 * Ce changement était scientifiquement justifié, mais n'était accompagné
 * d'aucun test vérifiant explicitement l'absence de cette alerte après coup —
 * une réintroduction accidentelle serait passée inaperçue.
 *
 * Ce fichier vérifie :
 * 1. qu'une cotation sévère (>= 3) ne génère JAMAIS d'alerte de code
 *    STATISTICAL_WARNING ni de message évoquant un « défaut visuel marqué » ;
 * 2. que la sévérité observée reste néanmoins reflétée dans le statut de
 *    qualité des données (qualityAssessment.status = WARNING), qui est la
 *    SEULE utilisation légitime de ce seuil (jamais une alerte, jamais un
 *    verdict normatif).
 */

import { calculateObservations } from '../observationsEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { VisualObservationsRawData } from '../../types/scientific';

export interface ObservationsNoSeverityAlertTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function buildRawWithRating(rating: number): VisualObservationsRawData {
  return {
    observations: [
      {
        category: 'BLISTERING',
        categoryLabel: 'Cloquage',
        rating,
        status: 'NON_CONFORME'
      }
    ]
  };
}

export function runObservationsNoSeverityAlertTests(): {
  results: ObservationsNoSeverityAlertTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ObservationsNoSeverityAlertTestResult[] = [];
  const ruleSet = getDefaultScientificRuleSet();

  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --------------------------------------------------------------------------
  // P3-A-01 : cotation sévère (rating = 3, seuil exact) → aucune alerte de
  // code STATISTICAL_WARNING, aucun message évoquant un défaut "marqué".
  // --------------------------------------------------------------------------
  const { alerts: alertsAt3 } = calculateObservations(buildRawWithRating(3), ruleSet);
  const noStatisticalWarningAt3 = !alertsAt3.some((a) => a.code === 'STATISTICAL_WARNING');
  const noSevereMessageAt3 = !alertsAt3.some((a) => /défaut visuel marqué/i.test(a.message));
  record(
    'P3-A-01',
    'Cotation = 3 : aucune alerte STATISTICAL_WARNING ni message "défaut visuel marqué"',
    noStatisticalWarningAt3 && noSevereMessageAt3,
    'Aucune alerte de sévérité générée',
    `alertes=${JSON.stringify(alertsAt3.map((a) => a.code))}`
  );

  // --------------------------------------------------------------------------
  // P3-A-02 : cotation maximale (rating = 5) → même garantie, au cas où un
  // seuil aurait été réintroduit uniquement pour les valeurs extrêmes.
  // --------------------------------------------------------------------------
  const { alerts: alertsAt5 } = calculateObservations(buildRawWithRating(5), ruleSet);
  const noStatisticalWarningAt5 = !alertsAt5.some((a) => a.code === 'STATISTICAL_WARNING');
  record(
    'P3-A-02',
    'Cotation = 5 (maximale) : aucune alerte STATISTICAL_WARNING',
    noStatisticalWarningAt5,
    'Aucune alerte de sévérité générée',
    `alertes=${JSON.stringify(alertsAt5.map((a) => a.code))}`
  );

  // --------------------------------------------------------------------------
  // P3-A-03 : la sévérité reste néanmoins reflétée dans le statut de qualité
  // (WARNING), seule utilisation légitime restante de ce seuil — pour
  // s'assurer que le retrait de l'alerte n'a pas fait disparaître le signal
  // de sévérité entièrement du système.
  // --------------------------------------------------------------------------
  const { computed } = calculateObservations(buildRawWithRating(3), ruleSet);
  const qualityReflectsSeverity = computed.qualityAssessment.status === 'WARNING';
  record(
    'P3-A-03',
    "La sévérité (cotation >= 3) reste reflétée dans qualityAssessment.status (WARNING), sans devenir une alerte",
    qualityReflectsSeverity,
    'qualityAssessment.status = WARNING',
    `qualityAssessment.status=${computed.qualityAssessment.status}`
  );

  // --------------------------------------------------------------------------
  // P3-A-04 : une cotation légère (rating = 1, < 3) ne déclenche ni alerte de
  // sévérité, ni statut WARNING pour ce seul motif (ACCEPTABLE attendu).
  // --------------------------------------------------------------------------
  const { computed: computedLight, alerts: alertsLight } = calculateObservations(buildRawWithRating(1), ruleSet);
  const lightIsAcceptable = computedLight.qualityAssessment.status === 'ACCEPTABLE';
  const lightHasNoStatisticalWarning = !alertsLight.some((a) => a.code === 'STATISTICAL_WARNING');
  record(
    'P3-A-04',
    'Cotation = 1 (< seuil de sévérité) : statut ACCEPTABLE, aucune alerte de sévérité',
    lightIsAcceptable && lightHasNoStatisticalWarning,
    'qualityAssessment.status = ACCEPTABLE, aucune alerte STATISTICAL_WARNING',
    `status=${computedLight.qualityAssessment.status}, alertes=${JSON.stringify(alertsLight.map((a) => a.code))}`
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };
}
