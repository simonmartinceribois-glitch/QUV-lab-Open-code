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
  INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS,
  INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS,
  INFIPERF_ASPECT_ALERT_RATING,
  getInfiperfGlossRetentionThreshold
} from './infiperfRequirements';
import {
  prepareInfiperfRetentionData,
  prepareInfiperfPersozData,
  prepareInfiperfColorData,
  prepareInfiperfAspectData
} from './infiperfPreparation';
import {
  meanRetentionRate,
  meanDampingTime,
  meanColorComponent,
  meanAspectRating
} from './infiperfCalculations';

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
 * Le seuil est lu UNIQUEMENT depuis le ScientificRuleSet : aucune valeur passée
 * par l'appelant ne peut le remplacer.
 */
export function evaluateInfiperfGlossRetention(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: InfiperfEvaluateOptions
): InfiperfCriteriaEvaluation {
  const stageId = options?.stageId ?? null;

  const threshold = getInfiperfGlossRetentionThreshold(ruleSet);

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

// ============================================================================
// PERSOZ — INDICATEUR DE VIGILANCE (JAMAIS un PASS/FAIL normatif)
// ============================================================================

/**
 * Indicateur de vigilance INFIPERF sur la dureté Persoz.
 *  - initial (T0, cycle 0) : dureté > 70 s → VIGILANCE (prédisposition au risque de fissuration) ;
 *  - vieillissement (cycles ≥ 1) : dureté ≥ 100 s → VIGILANCE (risque accru de fissuration).
 * Ces seuils sont des INDICATEURS documentés INFIPERF, jamais des exigences NF EN 927-2.
 */
export function compareInfiperfPersoz(
  meanDamping: number,
  rule: 'INITIAL_HARDNESS' | 'AGEING_HARDNESS'
): 'VIGILANCE' | 'NO_SIGNAL' {
  const threshold =
    rule === 'INITIAL_HARDNESS'
      ? INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS
      : INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS;
  const trigger = rule === 'INITIAL_HARDNESS' ? meanDamping > threshold : meanDamping >= threshold;
  return trigger ? 'VIGILANCE' : 'NO_SIGNAL';
}

export interface InfiperfPersozResult {
  criterionId: 'PERSOZ';
  label: string;
  /** Indicateur complet ; jamais NON_EVALUE. */
  status: 'VIGILANCE' | 'NO_SIGNAL' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  /** Dureté moyenne Persoz (s) au jalon, ou `null`. */
  value: number | null;
  /** Seuil d'indicateur documenté ou `null`. */
  threshold: number | null;
  /** Règle appliquée : dureté initiale (T0) ou vieillissement. */
  rule: 'INITIAL_HARDNESS' | 'AGEING_HARDNESS' | null;
  stageId: string | null;
  provenance: {
    reference: string;
    edition: string | null;
    document: string | null;
    evaluationMode: 'COMPLEMENTARY';
    stage: string | null;
    cycleIndex: number | null;
    exposureHours: number | null;
  };
  message: string;
}

export function evaluateInfiperfPersoz(
  trial: Trial,
  options?: InfiperfEvaluateOptions
): InfiperfPersozResult {
  const stageId = options?.stageId ?? null;
  const stage = stageId ? trial.stages.find((s) => s.id === stageId) : null;

  const base = {
    reference: INFIPERF_REFERENCE,
    edition: INFIPERF_EDITION,
    document: INFIPERF_DOCUMENT,
    evaluationMode: 'COMPLEMENTARY' as const,
    stage: stageId,
    cycleIndex: stage?.cycleIndex ?? null,
    exposureHours: stage?.scheduledExposureHours ?? null
  };

  if (!stageId || !stage) {
    return {
      criterionId: 'PERSOZ',
      label: 'Dureté Persoz (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      threshold: null,
      rule: null,
      stageId,
      provenance: base,
      message: 'Aucun jalon d’évaluation identifiable pour l’indicateur Persoz : données insuffisantes.'
    };
  }

  const prepared = prepareInfiperfPersozData(trial, stageId);
  if (!prepared.available) {
    return {
      criterionId: 'PERSOZ',
      label: 'Dureté Persoz (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      threshold: null,
      rule: null,
      stageId,
      provenance: base,
      message: 'Données insuffisantes au jalon demandé : aucune mesure Persoz exploitable sur E1/E2/E3.'
    };
  }

  const mean = meanDampingTime(prepared.specimens.map((s) => s.meanDampingTime));
  if (mean === null) {
    return {
      criterionId: 'PERSOZ',
      label: 'Dureté Persoz (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      threshold: null,
      rule: null,
      stageId,
      provenance: base,
      message: 'Mesures Persoz invalides sur toutes les éprouvettes : données insuffisantes.'
    };
  }

  const rule = stage.cycleIndex === 0 ? 'INITIAL_HARDNESS' : 'AGEING_HARDNESS';
  const threshold =
    rule === 'INITIAL_HARDNESS'
      ? INFIPERF_PERSOZ_INITIAL_HARDNESS_INDICATOR_SECONDS
      : INFIPERF_PERSOZ_AGEING_HARDNESS_INDICATOR_SECONDS;
  const status = compareInfiperfPersoz(mean, rule);
  const message =
    rule === 'INITIAL_HARDNESS'
      ? `Indicateur INFIPERF (dureté initiale) : ${mean} s ${status === 'VIGILANCE' ? '>' : '≤'} ${threshold} s → ${status}. Une dureté initiale > ${threshold} s est un indicateur de prédisposition au risque de fissuration des finitions — indicateur complémentaire, aucune exigence NF EN 927-2.`
      : `Indicateur INFIPERF (dureté en vieillissement) : ${mean} s ${status === 'VIGILANCE' ? '≥' : '<'} ${threshold} s → ${status}. Une dureté ≥ ${threshold} s est un indicateur de risque accru de fissuration — indicateur complémentaire, aucune exigence NF EN 927-2.`;

  return {
    criterionId: 'PERSOZ',
    label: 'Dureté Persoz (INFIPERF / FCBA)',
    status,
    value: mean,
    threshold,
    rule,
    stageId,
    provenance: base,
    message
  };
}

// ============================================================================
// COULEUR — ANALYSE (JAMAIS un verdict normatif)
// ============================================================================

export interface InfiperfColorCycleValue {
  stageId: string;
  display: string;
  deltaL: number | null;
  deltaA: number | null;
  deltaB: number | null;
  deltaE: number | null;
}

export interface InfiperfColorResult {
  criterionId: 'COLOR';
  label: string;
  status: 'ANALYSIS' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  /** Cycles réellement mesurés (aucune interpolation, aucun cycle inventé). */
  cycles: InfiperfColorCycleValue[];
  provenance: {
    reference: string;
    edition: string | null;
    document: string | null;
    evaluationMode: 'COMPLEMENTARY';
  };
  message: string;
}

/**
 * Analyse colorimétrique INFIPERF : rapporte les évolutions moyennes
 * ΔL*, Δa*, Δb*, ΔE* des éprouvettes exposées E1/E2/E3 sur les cycles
 * réellement mesurés. Aucun seuil, aucun verdict, aucune interpolation.
 */
export function evaluateInfiperfColor(trial: Trial): InfiperfColorResult {
  const cycles: InfiperfColorCycleValue[] = [];

  for (const stage of trial.stages) {
    const prepared = prepareInfiperfColorData(trial, stage.id);
    if (!prepared.available) continue;
    const deltaL = meanColorComponent(
      prepared.specimens.map((s) => s.deltaL).filter((v): v is number => v !== null)
    );
    const deltaA = meanColorComponent(
      prepared.specimens.map((s) => s.deltaA).filter((v): v is number => v !== null)
    );
    const deltaB = meanColorComponent(
      prepared.specimens.map((s) => s.deltaB).filter((v): v is number => v !== null)
    );
    const deltaE = meanColorComponent(
      prepared.specimens.map((s) => s.deltaE).filter((v): v is number => v !== null)
    );
    cycles.push({
      stageId: stage.id,
      display: `C${stage.cycleIndex ?? '?'} (${stage.scheduledExposureHours ?? '?'} h)`,
      deltaL,
      deltaA,
      deltaB,
      deltaE
    });
  }

  const base = {
    reference: INFIPERF_REFERENCE,
    edition: INFIPERF_EDITION,
    document: INFIPERF_DOCUMENT,
    evaluationMode: 'COMPLEMENTARY' as const
  };

  if (cycles.length === 0) {
    return {
      criterionId: 'COLOR',
      label: 'Couleur (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      cycles,
      provenance: base,
      message: 'Aucune donnée colorimétrique exploitable (ΔL*/Δa*/Δb*/ΔE*) sur les cycles réellement mesurés.'
    };
  }

  const detailed = cycles
    .map(
      (c) =>
        `${c.display}: ΔL*=${c.deltaL ?? '—'}, Δa*=${c.deltaA ?? '—'}, Δb*=${c.deltaB ?? '—'}, ΔE*=${c.deltaE ?? '—'}`
    )
    .join(' ; ');
  return {
    criterionId: 'COLOR',
    label: 'Couleur (INFIPERF / FCBA)',
    status: 'ANALYSIS',
    cycles,
    provenance: base,
    message: `Analyse colorimétrique INFIPERF (cycles réellement mesurés, aucune interpolation) : ${detailed}. Pas de seuil normatif, aucune exigence NF EN 927-2.`
  };
}

// ============================================================================
// ASPECT GÉNÉRAL — ALERTE (JAMAIS un verdict de conformité)
// ============================================================================

export function compareInfiperfAspect(meanRating: number): 'VIGILANCE' | 'NO_SIGNAL' {
  return meanRating >= INFIPERF_ASPECT_ALERT_RATING ? 'VIGILANCE' : 'NO_SIGNAL';
}

export interface InfiperfAspectResult {
  criterionId: 'GENERAL_APPEARANCE';
  label: string;
  status: 'VIGILANCE' | 'NO_SIGNAL' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  /** Moyenne des cotations d'aspect général (0..5), ou `null`. */
  value: number | null;
  /** Niveau d'alerte INFIPERF (≥ 2.5) ou `null`. */
  alertThreshold: number | null;
  stageId: string | null;
  provenance: {
    reference: string;
    edition: string | null;
    document: string | null;
    evaluationMode: 'COMPLEMENTARY';
    stage: string | null;
    cycleIndex: number | null;
    exposureHours: number | null;
  };
  message: string;
}

export function evaluateInfiperfGeneralAppearance(
  trial: Trial,
  options?: InfiperfEvaluateOptions
): InfiperfAspectResult {
  const stageId = options?.stageId ?? null;
  const stage = stageId ? trial.stages.find((s) => s.id === stageId) : null;

  const base = {
    reference: INFIPERF_REFERENCE,
    edition: INFIPERF_EDITION,
    document: INFIPERF_DOCUMENT,
    evaluationMode: 'COMPLEMENTARY' as const,
    stage: stageId,
    cycleIndex: stage?.cycleIndex ?? null,
    exposureHours: stage?.scheduledExposureHours ?? null
  };

  if (!stageId || !stage) {
    return {
      criterionId: 'GENERAL_APPEARANCE',
      label: 'Aspect général (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      alertThreshold: INFIPERF_ASPECT_ALERT_RATING,
      stageId,
      provenance: base,
      message: 'Aucun jalon d’évaluation identifiable pour l’indicateur d’aspect général : données insuffisantes.'
    };
  }

  const prepared = prepareInfiperfAspectData(trial, stageId);
  if (!prepared.available) {
    return {
      criterionId: 'GENERAL_APPEARANCE',
      label: 'Aspect général (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      alertThreshold: INFIPERF_ASPECT_ALERT_RATING,
      stageId,
      provenance: base,
      message: 'Données insuffisantes au jalon demandé : aucune cotation d’aspect général exploitable sur E1/E2/E3.'
    };
  }

  const mean = meanAspectRating(prepared.specimens.map((s) => s.generalAppearanceRating));
  if (mean === null) {
    return {
      criterionId: 'GENERAL_APPEARANCE',
      label: 'Aspect général (INFIPERF / FCBA)',
      status: 'INSUFFICIENT_DATA',
      value: null,
      alertThreshold: INFIPERF_ASPECT_ALERT_RATING,
      stageId,
      provenance: base,
      message: 'Cotations d’aspect général invalides sur toutes les éprouvettes : données insuffisantes.'
    };
  }

  const status = compareInfiperfAspect(mean);
  return {
    criterionId: 'GENERAL_APPEARANCE',
    label: 'Aspect général (INFIPERF / FCBA)',
    status,
    value: mean,
    alertThreshold: INFIPERF_ASPECT_ALERT_RATING,
    stageId,
    provenance: base,
    message: `Aspect général (échelle 0..5) : ${mean} ${status === 'VIGILANCE' ? '≥' : '<'} ${INFIPERF_ASPECT_ALERT_RATING} → ${status} (${status === 'VIGILANCE' ? 'alerte sur la perte de performance/aspect' : 'aucune alerte'}). Alerte INFIPERF complémentaire, jamais un critère de conformité NF EN 927-2.`
  };
}

// ============================================================================
// ORCHESTRATION MULTI-CRITÈRES INFIPERF (INDÉPENDANTS, AUCUN SCORE GLOBAL)
// ============================================================================

export interface InfiperfCriteriaEvaluationMulti {
  reference: string;
  edition: string | null;
  evaluationMode: 'COMPLEMENTARY';
  complementaryNotice: string;
  /** Résultats INDÉPENDANTS par indicateur INFIPERF ; aucun résultat global/combiné. */
  results: {
    GLOSS_RETENTION: InfiperfGlossRetentionResult;
    PERSOZ: InfiperfPersozResult;
    COLOR: InfiperfColorResult;
    GENERAL_APPEARANCE: InfiperfAspectResult;
  };
  /** Explicitement `false` : aucun verdict combiné ni score global. */
  hasGlobalVerdict: false;
}

/**
 * Orchestration INFIPERF : évalue les indicateurs disponibles.
 * Chaque indicateur reste INDÉPENDANT (brillance, Persoz, couleur, aspect).
 * Aucun score global n'est calculé ; une alerte INFIPERF n'est jamais une
 * non-conformité NF EN 927-2.
 */
export function evaluateInfiperfCriteria(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: InfiperfEvaluateOptions
): InfiperfCriteriaEvaluationMulti {
  return {
    reference: INFIPERF_REFERENCE,
    edition: INFIPERF_EDITION,
    evaluationMode: 'COMPLEMENTARY',
    complementaryNotice: INFIPERF_COMPLEMENTARY_NOTICE,
    results: {
      GLOSS_RETENTION: evaluateInfiperfGlossRetention(trial, ruleSet, options).result!,
      PERSOZ: evaluateInfiperfPersoz(trial, options),
      COLOR: evaluateInfiperfColor(trial),
      GENERAL_APPEARANCE: evaluateInfiperfGeneralAppearance(trial, options)
    },
    hasGlobalVerdict: false
  };
}