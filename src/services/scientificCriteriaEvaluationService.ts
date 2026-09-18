/**
 * QUV-Lab — COUCHE D'ÉVALUATION APPLICATIVE DES CRITÈRES COMPLÉMENTAIRES
 * NF EN 927-2:2014 (HISTORICAL_TRANSITIONAL) & INFIPERF / FCBA (P5)
 *
 * Ce service ORCHESTRE UNIQUEMENT les évaluateurs scientifiques EXISTANTS :
 *   - evaluateNf9272Criteria   (src/scientific/criteria/en927/en9272Evaluator.ts)
 *   - evaluateInfiperfCriteria (src/scientific/criteria/infiperf/infiperfEvaluator.ts)
 *
 * Il ne fait PAS :
 *   - recalculer les mesures (aucun appel à recalculer / calculate* ici) ;
 *   - modifier RAW ou COMPUTED (fonctions pures, aucun effet de bord) ;
 *   - reproduire les seuils, sum12, maxDifference ou les règles de classification ;
 *   - recalculer un indicateur INFIPERF (le seuil de rétention reste lu par le
 *     moteur depuis le ScientificRuleSet) ;
 *   - persister le résultat (aucune clé localStorage, aucun schéma Trial étendu).
 *
 * Le résultat ScientificCriteriaEvaluation est un RÉSULTAT DÉRIVÉ, recalculable
 * à tout instant depuis : Trial + ScientificRuleSet + batchId.
 *
 * Règle multi-lots (§25.5) : l'évaluation s'applique PAR SYSTÈME. Plusieurs lots
 * sans batchId → refus du moteur (INSUFFICIENT_DATA + scopeBlockedReason) —
 * aucune agrégation inter-systèmes. batchId inconnu → refus. Les moteurs sont les
 * seuls interprètes de cette règle, ce service ne la réimplémente jamais.
 */

import type { Trial } from '../types/trial';
import type { ScientificRuleSet } from '../types/scientific';
import { evaluateNf9272Criteria, type Nf9272CriteriaEvaluation } from '../scientific/criteria/en927/en9272Evaluator';
import {
  evaluateInfiperfCriteria,
  type InfiperfCriteriaEvaluationMulti
} from '../scientific/criteria/infiperf/infiperfEvaluator';
import { findNf9272Jalon } from '../scientific/criteria/en927/en9272Preparation';

/**
 * Conteneur de résultat dérivé : aucune persistance, recalculable depuis
 * Trial + ScientificRuleSet + batchId. Réutilise EXCLUSIVEMENT les types de
 * résultats du module scientifique (aucun doublon de type).
 */
export interface ScientificCriteriaEvaluation {
  /** Évaluation NF EN 927-2:2014 (HISTORICAL_TRANSITIONAL) par le moteur existant. */
  nf9272: Nf9272CriteriaEvaluation;
  /** Évaluation INFIPERF indépendante par le moteur existant (aucun verdict combiné). */
  infiperf: InfiperfCriteriaEvaluationMulti;
  /** Date ISO d'exécution de l'évaluation applicative (dérivé, jamais persisté). */
  evaluatedAt: string;
  /** Version du ScientificRuleSet utilisé (INFIPERF lit le seuil depuis le RuleSet). */
  ruleSetVersion: string;
  /** Identifiant de l'essai source. */
  sourceTrialId: string;
  /**
   * Lot effectivement évalué, résolu par le moteur :
   *  - batchId fourni → ce lot ;
   *  - essai mono-lot sans sélection → le lot unique ;
   *  - multi-lots sans sélection → null (évaluation refusée, scopeBlockedReason).
   */
  batchId: string | null;
}

/**
 * Contrat d'entrée : options de sélection du périmètre système (lot).
 * `batchId` est requis lorsque l'essai contient plusieurs lots.
 */
export interface ScientificCriteriaEvaluationOptions {
  batchId?: string;
}

/**
 * Résultat par lot (jamais inter-lots) : utilisé par le rapport et les exports
 * pour restituer chaque système de finition séparément.
 */
export interface ScientificCriteriaEvaluationPerBatch {
  batchId: string;
  /** Libellé système résolu par le moteur (réf. — système), ou repli référence. */
  batchLabel: string | null;
  evaluation: ScientificCriteriaEvaluation;
}

/**
 * Orchestration applicative NF EN 927-2:2014 + INFIPERF.
 *
 * Le jalon C12 est résolu par `findNf9272Jalon` du module (cycle 12, 2016 h,
 * étape active) — la règle du verrou C12 n'est JAMAIS réimplémentée ici, elle est
 * réutilisée telle quelle. Le même jalon alimente INFIPERF via `stageId`.
 *
 * Fonction pure : Lecture seule du Trial (RAW/COMPUTED inchangés), aucun cache.
 */
export function evaluateScientificCriteria(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  options?: ScientificCriteriaEvaluationOptions
): ScientificCriteriaEvaluation {
  const batchId = options?.batchId;
  const jalonStageId = findNf9272Jalon(trial)?.id;

  const nf9272 = evaluateNf9272Criteria(trial, batchId ? { batchId } : undefined);
  const infiperf = evaluateInfiperfCriteria(trial, ruleSet, {
    stageId: jalonStageId,
    ...(batchId ? { batchId } : {})
  });

  return {
    nf9272,
    infiperf,
    evaluatedAt: new Date().toISOString(),
    ruleSetVersion: ruleSet.version || 'unknown',
    sourceTrialId: trial.id,
    batchId: nf9272.batchScoped.batchId
  };
}

/**
 * Évalue chaque lot de l'essai INDIVIDUELLEMENT (jamais inter-lots) : une
 * classification par systeme de finition, chaque systeme passant par le moteur.
 * Utilisé par le rapport scientifique et les exports JSON/CSV pour restituer
 * l'ensemble des systèmes sans aucune agrégation.
 */
export function evaluateScientificCriteriaPerBatch(
  trial: Trial,
  ruleSet: ScientificRuleSet
): ScientificCriteriaEvaluationPerBatch[] {
  return trial.batches.map((batch) => {
    const evaluation = evaluateScientificCriteria(trial, ruleSet, { batchId: batch.id });
    return {
      batchId: batch.id,
      batchLabel: evaluation.nf9272.batchScoped.batchLabel ?? batch.reference ?? null,
      evaluation
    };
  });
}