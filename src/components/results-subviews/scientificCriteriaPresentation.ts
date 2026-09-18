/**
 * QUV-Lab — COUCHE DE PRÉSENTATION (PURE) DES CRITÈRES COMPLÉMENTAIRES
 * NF EN 927-2:2014 (HISTORICAL_TRANSITIONAL) & INFIPERF / FCBA
 *
 * Helpers SANS JSX ni DOM, importables par les tests headless :
 *   - mise en forme factuelle des résultats du moteur (jamais une déclaration de
 *     conformité) ;
 *   - distinction stricte INSUFFICIENT_DATA / NO_CATEGORY_MET / INVALID_TEST ;
 *   - garde-fous de vocabulaire interdit (aucune déclaration de conformité 2022,
 *     aucun verdict global, NON_STABLE jamais présenté comme un échec).
 *
 * Aucune règle de calcul ici : la présentation ne fait que formater les résultats
 * structurés produits par le service d'évaluation applicative.
 */

import type { ScientificCriteriaEvaluation } from '../../services/scientificCriteriaEvaluationService';
import type { Nf9272CriteriaEvaluation } from '../../scientific/criteria/en927/en9272Evaluator';

const fmt = (v: number | null | undefined, decimals = 3): string =>
  v === null || v === undefined ? '—' : v.toFixed(decimals);

export interface Nf9272CriteriaPresentation {
  reference: string;
  edition: string;
  status: string;
  evaluationMode: string;
  complementaryNotice: string;
  jalonDisplay: string;
  batchDisplay: string | null;
  scopeBlockedReason: string | null;
  /** Distinction stricte (§23) : jamais fusionnée avec la classification. */
  dataStatusKind: 'VALID' | 'INVALID_TEST' | 'INSUFFICIENT_DATA';
  /** STABLE | SEMI_STABLE | NON_STABLE | NO_CATEGORY_MET, ou null si non classable. */
  classification: string | null;
  sum12: string;
  maxDifference: string;
  hasGlobalVerdict: false;
  /** Honnêteté de provenance (§25.8) : emplacements non vérifiés = « À DÉFINIR ». */
  provenanceEmplacementsConnus: boolean;
  criteria: {
    criterionId: string;
    label: string;
    status: string;
    value: string;
    threshold: string;
    pass: boolean | null;
    message: string;
  }[];
}

export interface InfiperfIndicatorPresentation {
  indicator: string;
  label: string;
  status: string;
  value: string;
  threshold: string;
  message: string;
}

export interface InfiperfCriteriaPresentation {
  reference: string;
  edition: string | null;
  evaluationMode: string;
  complementaryNotice: string;
  hasGlobalVerdict: false;
  indicators: InfiperfIndicatorPresentation[];
}

export interface ScientificCriteriaPresentation {
  nf9272: Nf9272CriteriaPresentation;
  infiperf: InfiperfCriteriaPresentation;
  ruleSetVersion: string;
  sourceTrialId: string;
  batchId: string | null;
}

/**
 * Formate l'évaluation NF EN 927-2:2014 pour l'UI / le rapport.
 * Factuel : ne produit jamais de verdict global ni de déclaration de conformité.
 */
export function buildNf9272Presentation(evalData: ScientificCriteriaEvaluation): Nf9272CriteriaPresentation {
  const nf = evalData.nf9272;
  const provenanceEmplacementsConnus =
    nf.results.BLISTERING.provenance.section !== null ||
    nf.results.BLISTERING.provenance.paragraph !== null ||
    nf.results.BLISTERING.provenance.table !== null ||
    nf.results.BLISTERING.provenance.page !== null;

  return {
    reference: nf.reference,
    edition: nf.edition,
    status: nf.status,
    evaluationMode: nf.evaluationMode,
    complementaryNotice: nf.complementaryNotice,
    jalonDisplay: nf.jalon.display,
    batchDisplay: nf.batchScoped.batchLabel ?? nf.batchScoped.batchId,
    scopeBlockedReason: nf.batchScoped.scopeBlockedReason,
    dataStatusKind: nf.testValidity,
    classification: nf.classification,
    sum12: fmt(nf.sum12),
    maxDifference: fmt(nf.maxDifference),
    hasGlobalVerdict: nf.hasGlobalVerdict,
    provenanceEmplacementsConnus,
    criteria: ['BLISTERING', 'CRACKING', 'FLAKING', 'ADHESION'].map((id) => {
      const c = nf.results[id as keyof Nf9272CriteriaEvaluation['results']];
      return {
        criterionId: id,
        label: c.label,
        status: c.status,
        value: fmt(c.value),
        threshold: c.threshold === null ? '—' : String(c.threshold),
        pass: c.pass,
        message: c.message
      };
    })
  };
}

/**
 * Formate l'évaluation INFIPERF : chaque indicateur reste INDÉPENDANT, jamais un
 * score global, jamais une non-conformité NF EN 927-6.
 */
export function buildInfiperfPresentation(evalData: ScientificCriteriaEvaluation): InfiperfCriteriaPresentation {
  const inf = evalData.infiperf;
  const toIndicator = (key: string, r: { label: string; status: string; value?: unknown; threshold?: unknown; message: string }): InfiperfIndicatorPresentation => ({
    indicator: key,
    label: r.label,
    status: r.status,
    value: typeof r.value === 'number' ? fmt(r.value) : '—',
    threshold: typeof r.threshold === 'number' ? fmt(r.threshold) : '—',
    message: r.message
  });

  return {
    reference: inf.reference,
    edition: inf.edition,
    evaluationMode: inf.evaluationMode,
    complementaryNotice: inf.complementaryNotice,
    hasGlobalVerdict: inf.hasGlobalVerdict,
    indicators: [
      toIndicator('GLOSS_RETENTION', inf.results.GLOSS_RETENTION),
      toIndicator('PERSOZ', inf.results.PERSOZ),
      toIndicator('COLOR', inf.results.COLOR as unknown as { label: string; status: string; message: string }),
      toIndicator('GENERAL_APPEARANCE', inf.results.GENERAL_APPEARANCE)
    ]
  };
}

export function buildScientificCriteriaPresentation(evalData: ScientificCriteriaEvaluation): ScientificCriteriaPresentation {
  return {
    nf9272: buildNf9272Presentation(evalData),
    infiperf: buildInfiperfPresentation(evalData),
    ruleSetVersion: evalData.ruleSetVersion,
    sourceTrialId: evalData.sourceTrialId,
    batchId: evalData.batchId
  };
}

export interface ForbiddenVocabularyReport {
  /** Phrases interdites jamais présentes dans la présentation factuelle. */
  absentConformite2022: boolean;
  absentProduitConforme: boolean;
  absentCeConforme: boolean;
  /** NON_STABLE n'est jamais transformé en ÉCHEC. */
  nonStablePresenteFactuellement: boolean;
}

/**
 * Vérifie l'absence de tout vocabulaire de conformité interdit (§22).
 * Utilisé par l'UI et verrouillé par les tests.
 */
export function checkForbiddenVocabulary(
  presentation: ScientificCriteriaPresentation
): ForbiddenVocabularyReport {
  const text = JSON.stringify(presentation).toLowerCase();
  return {
    absentConformite2022: !text.includes('conforme nf en 927-2:2022') && !text.includes('conforme à la nf en 927-2'),
    absentProduitConforme: !text.includes('produit conforme'),
    absentCeConforme: !text.includes('ce conforme'),
    nonStablePresenteFactuellement:
      presentation.nf9272.classification === 'NON_STABLE' || !text.includes('non_stable')
  };
}