/**
 * QUV-Lab — Couche CRITÈRE (S3) : évaluation du délai d'application avant essai
 * d'adhérence (condition de protocole, NF EN ISO 2409:2020).
 *
 * Couche pure, déterministe, NON persistée et sans mutation. Elle délègue la
 * totalité de la logique scientifique à `calculateDelayCompliance`
 * (adhesionEngine) : AUCUNE seconde règle. Le verdict CONFORME / NON_CONFORME /
 * NON_EVALUE est la seule projection en jargon CRITÈRE du statut scientifique,
 * consommée par le rapport et l'interface utilisateur (source de vérité unique).
 *
 * Séparation des couches RAW / COMPUTED / CRITÈRE / ANALYSE (règles QUV-Lab S0).
 */

import { calculateDelayCompliance, ADHESION_DEFAULT_REQUIRED_DELAY_HOURS } from '../adhesionEngine';

export type AdhesionDelayVerdict = 'CONFORME' | 'NON_CONFORME' | 'NON_EVALUE';

export interface AdhesionDelayCriterionEvaluation {
  /** Verdict CRITÈRE : CONFORME / NON_CONFORME lorsque datable, NON_EVALUE sinon. */
  verdict: AdhesionDelayVerdict;
  elapsedTimeHours: number | null;
  /** Statut scientifique brut de calculateDelayCompliance (transparence totale). */
  status: ReturnType<typeof calculateDelayCompliance>['status'];
  formattedElapsedTime: string;
  message: string;
  origin: 'PROTOCOL_CONDITION';
  normativeReference: 'NF EN ISO 2409:2020';
  requiredMinimumDelayHours: number;
}

export function evaluateAdhesionDelayCriterion(input: {
  applicationDateTime?: string;
  measurementDateTime?: string;
  requiredMinimumDelayHours?: number;
}): AdhesionDelayCriterionEvaluation {
  const requiredMinimumDelayHours =
    input.requiredMinimumDelayHours ?? ADHESION_DEFAULT_REQUIRED_DELAY_HOURS;

  const result = calculateDelayCompliance(
    input.applicationDateTime,
    input.measurementDateTime,
    requiredMinimumDelayHours
  );

  const verdict: AdhesionDelayVerdict =
    result.status === 'CONFORME'
      ? 'CONFORME'
      : result.status === 'INSUFFICIENT_DELAY'
        ? 'NON_CONFORME'
        : 'NON_EVALUE';

  return {
    verdict,
    elapsedTimeHours: result.elapsedTimeHours,
    status: result.status,
    formattedElapsedTime: result.formattedElapsedTime,
    message: result.message,
    origin: 'PROTOCOL_CONDITION',
    normativeReference: 'NF EN ISO 2409:2020',
    requiredMinimumDelayHours
  };
}