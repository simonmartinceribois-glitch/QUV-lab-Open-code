/**
 * Évaluateur INFIPERF / FCBA — couche EVALUATOR (module indépendant de l'évaluateur
 * NF EN 927-2 : aucune import croisée).
 *
 * Le seuil est lu UNIQUEMENT depuis le ScientificRuleSet
 * (statisticalRules.retentionThresholdPercent). Statut :
 *  - seuil absent/invalide au RuleSet           → NOT_APPLICABLE ;
 *  - données insuffisantes (aucune rétention)   → INSUFFICIENT_DATA ;
 *  - rétention moyen < seuil                    → DEFAVORABLE ;
 *  - rétention moyen ≥ seuil                    → FAVORABLE (égalité incluse).
 *
 * DEFAVORABLE = critère COMPLÉMENTAIRE, jamais une non-conformité NF EN 927-6.
 * Lecture seule : ne modifie ni Trial, ni RAW/COMPUTED.
 */

import type { Trial } from '../../../types/trial';
import type { ScientificRuleSet } from '../../../types/scientific';
import {
  INFIPERF_REFERENCE,
  INFIPERF_EDITION,
  INFIPERF_DOCUMENT,
  INFIPERF_COMPLEMENTARY_NOTICE,
  getInfiperfGlossRetentionThreshold
} from './infiperfRequirements';
import { prepareInfiperfRetentionData } from './infiperfPreparation';
import { meanRetentionRate } from './infiperfCalculations';

export interface InfiperfGlossRetentionResult {
  criterionId: 'GLOSS_RETENTION';
  label: string;
  /** Statut complet ; jamais NON_EVALUE. */
  status: 'FAVORABLE' | 'DEFAVORABLE' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  /** Valeur moyenne de rétention (%) ou `null`. */
  value: number | null;
  /** Seuil lu depuis le RuleSet ou `null` si absent. */
  threshold: number | null;
  stageId: string | null;
  provenance: {
    reference: string;
    edition: string | null;
    document: string | null;
    evaluationMode: 'COMPLEMENTARY';
  };
  message: string;
}

export interface InfiperfEvaluateOptions {
  stageId?: string;
  /** Seuil de test (normalement lu depuis le RuleSet ; fourni directement hors RuleSet). */
  thresholdPercent?: number;
}

export interface InfiperfCriteriaEvaluation {
  reference: string;
  edition: string | null;
  evaluationMode: 'COMPLEMENTARY';
  complementaryNotice: string;
  result: InfiperfGlossRetentionResult | null;
  /** Explicitement `false` : aucune non-conformité NF EN 927-6 déduite. */
  isComplementaryStudyCriterion: true;
  hasGlobalVerdict: false;
}

/**
 * Compare une rétention moyenne au seuil d'étude. Fonction pure exposée :
 * FAVORABLE si moyenne ≥ seuil (égalité incluse), sinon DEFAVORABLE.
 */
export function compareInfiperfRetention(mean: number, threshold: number): 'FAVORABLE' | 'DEFAVORABLE' {
  return mean >= threshold ? 'FAVORABLE' : 'DEFAVORABLE';
}

/**
 * Évalue le critère de rétention de brillance de l'essai à un jalon (défaut C12).
 * Le seuil est lu depuis le RuleSet ; `options.thresholdPercent` reste disponible
 * pour un usage hors RuleSet (tests/cas isolés), sans jamais modifier le RuleSet.
 */
export function evaluateInfiperfGlossRetention(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: InfiperfEvaluateOptions
): InfiperfCriteriaEvaluation {
  const stageId = options?.stageId ?? null;

  const ruleSetThreshold = getInfiperfGlossRetentionThreshold(ruleSet);
  const threshold =
    typeof options?.thresholdPercent === 'number' && Number.isFinite(options.thresholdPercent)
      ? options.thresholdPercent
      : ruleSetThreshold;

  const base = {
    reference: INFIPERF_REFERENCE,
    edition: INFIPERF_EDITION,
    document: INFIPERF_DOCUMENT,
    evaluationMode: 'COMPLEMENTARY' as const
  };

  if (threshold === null) {
    return {
      ...base,
      complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
      result: {
        criterionId: 'GLOSS_RETENTION',
        label: 'Rétention de brillance (INFIPERF / FCBA)',
        status: 'NOT_APPLICABLE',
        value: null,
        threshold: null,
        stageId,
        provenance: base,
        message:
          'Critère INFIPERF non applicable : le seuil de rétention de brillance (statisticalRules.retentionThresholdPercent) est absent ou invalide dans le ScientificRuleSet.'
      },
      isComplementaryStudyCriterion: true,
      hasGlobalVerdict: false
    };
  }

  if (!stageId) {
    return {
      ...base,
      complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
      result: {
        criterionId: 'GLOSS_RETENTION',
        label: 'Rétention de brillance (INFIPERF / FCBA)',
        status: 'INSUFFICIENT_DATA',
        value: null,
        threshold,
        stageId,
        provenance: base,
        message: 'Aucun jalon d’évaluation fourni pour le critère INFIPERF : données insuffisantes.'
      },
      isComplementaryStudyCriterion: true,
      hasGlobalVerdict: false
    };
  }

  const prepared = prepareInfiperfRetentionData(trial, stageId);
  if (!prepared.available) {
    return {
      ...base,
      complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
      result: {
        criterionId: 'GLOSS_RETENTION',
        label: 'Rétention de brillance (INFIPERF / FCBA)',
        status: 'INSUFFICIENT_DATA',
        value: null,
        threshold,
        stageId,
        provenance: base,
        message:
          'Données insuffisantes au jalon demandé : aucune rétention de brillance exploitable sur les éprouvettes exposées E1/E2/E3.'
      },
      isComplementaryStudyCriterion: true,
      hasGlobalVerdict: false
    };
  }

  const mean = meanRetentionRate(prepared.specimens.map((s) => s.retentionRatePercent as number));
  if (mean === null) {
    return {
      ...base,
      complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
      result: {
        criterionId: 'GLOSS_RETENTION',
        label: 'Rétention de brillance (INFIPERF / FCBA)',
        status: 'INSUFFICIENT_DATA',
        value: null,
        threshold,
        stageId,
        provenance: base,
        message: 'Rétentions invalides sur toutes les éprouvettes : données insuffisantes.'
      },
      isComplementaryStudyCriterion: true,
      hasGlobalVerdict: false
    };
  }

  const status = compareInfiperfRetention(mean, threshold);
  return {
    ...base,
    complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
    result: {
      criterionId: 'GLOSS_RETENTION',
      label: 'Rétention de brillance (INFIPERF / FCBA)',
      status,
      value: mean,
      threshold,
      stageId,
      provenance: base,
      message: `Rétention moyenne au jalon : ${mean} %, seuil d’étude INFIPERF : ${threshold} % → ${status}. Critère complémentaire, aucune non-conformité NF EN 927-6.`
    },
    isComplementaryStudyCriterion: true,
    hasGlobalVerdict: false
  };
}