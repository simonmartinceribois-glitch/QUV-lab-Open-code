/**
 * QUV-Lab — Couche CRITÈRE (S3) : évaluation du conditionnement avant examens initiaux
 * (condition de protocole commune aux familles, NF EN 927-6:2018 §6.3.3).
 *
 * Couche pure, déterministe, NON persistée et sans mutation. Elle délègue la
 * totalité de la logique scientifique à `calculatePreExposureDelayCompliance`
 * (adhesionEngine) : AUCUNE seconde règle. Le verdict CONFORME / NON_CONFORME /
 * NON_EVALUE est la seule projection en jargon CRITÈRE du statut scientifique,
 * consommée par le rapport et l'interface utilisateur (source de vérité unique).
 *
 * Séparation des couches RAW / COMPUTED / CRITÈRE / ANALYSE (règles QUV-Lab S0).
 */

import { calculatePreExposureDelayCompliance } from '../protocolEngine';

export type PreExposureConditioningVerdict = 'CONFORME' | 'NON_CONFORME' | 'NON_EVALUE';

export interface PreExposureConditioningCriterionEvaluation {
  /** Verdict CRITÈRE : CONFORME / NON_CONFORME lorsque datable, NON_EVALUE sinon. */
  verdict: PreExposureConditioningVerdict;
  elapsedTimeHours: number | null;
  /** Statut scientifique brut de calculatePreExposureDelayCompliance (transparence totale).
   *  DELAY_CHECK_SKIPPED : aucun délai minimal configuré, vérification contournée. */
  status: ReturnType<typeof calculatePreExposureDelayCompliance>['status'] | 'DELAY_CHECK_SKIPPED';
  formattedElapsedTime: string;
  message: string;
  origin: 'PROTOCOL_CONDITION';
  normativeReference: 'NF EN 927-6:2018';
  /** Délai minimal requis (heure) ou null si non configuré (vérification contournée). */
  requiredMinimumDelayHours: number | null;
}

export function evaluatePreExposureConditioningCriterion(input: {
  applicationDateTime?: string;
  measurementDateTime?: string;
  requiredMinimumDelayHours?: number;
}): PreExposureConditioningCriterionEvaluation {
  // Fix contre-audit c1edb84 (point 1) : une valeur NÉGATIVE n'est pas un délai
  // valide au sens du contrat métier (un délai minimal ne peut pas être
  // négatif) — traitée comme non configurée, au même titre qu'une valeur
  // absente/NaN, plutôt que silencieusement acceptée par calculatePreExposureDelayCompliance
  // (qui la traiterait comme "toujours conforme", contournant la vérification).
  const requiredMinimumDelayHours =
    input.requiredMinimumDelayHours === undefined ||
    input.requiredMinimumDelayHours === null ||
    !Number.isFinite(input.requiredMinimumDelayHours) ||
    input.requiredMinimumDelayHours < 0
      ? null
      : input.requiredMinimumDelayHours;

  // Paramètre protocolaire OPTIONNEL : sans configuration explicite, la
  // vérification de délai est contournée (aucun verdict, aucun repli 168 h en dur).
  if (requiredMinimumDelayHours === null) {
    return {
      verdict: 'NON_EVALUE',
      elapsedTimeHours: null,
      status: 'DELAY_CHECK_SKIPPED',
      formattedElapsedTime: 'Non évalué',
      message:
        "Délai d'application non évalué : aucun délai minimal requis n'est configuré (paramètre protocolaire optionnel).",
      origin: 'PROTOCOL_CONDITION',
      normativeReference: 'NF EN 927-6:2018',
      requiredMinimumDelayHours: null
    };
  }

  const result = calculatePreExposureDelayCompliance(
    input.applicationDateTime,
    input.measurementDateTime,
    requiredMinimumDelayHours
  );

  const verdict: PreExposureConditioningVerdict =
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

/** Compatibilité API historique : ne pas utiliser pour de nouveaux appels. */
export type AdhesionDelayVerdict = PreExposureConditioningVerdict;
export type AdhesionDelayCriterionEvaluation = PreExposureConditioningCriterionEvaluation;
export const evaluateAdhesionDelayCriterion = evaluatePreExposureConditioningCriterion;
