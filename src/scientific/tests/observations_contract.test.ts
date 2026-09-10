/**
 * QUV-Lab — Suite de Tests CONTRAT COMPUTED OBSERVATIONS (OBS-CONTRACT-10/11/12).
 *
 * Le contrat VisualObservationsComputedData ne doit JAMAIS fabriquer de
 * conclusion normative :
 *  - aucun « CONFORME » / « NON_CONFORME » / « FAVORABLE » / « DÉFAVORABLE » ;
 *  - aucun verdict NF EN 927-6 de conformité ;
 *  - aucun critère INFIPERF.
 * Invariants réaffirmés : missing → null (jamais 0) ; invalid → jamais 0 ;
 * zéro réel conservé ; valeur positive conservée ; RAW intact ; traçabilité
 * (calculationVersion) présente. Aucune donnée absente n'est transformée en
 * résultat positif.
 */

import {
  VisualObservationCategory,
  VisualObservationItem,
} from '../../types/scientific';
import { calculateObservations } from '../observationsEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';

export interface ObservationsContractTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const mk = (
  category: VisualObservationCategory,
  rating: string | number | null | undefined,
  status: VisualObservationItem['status'],
  categoryLabel: string
): VisualObservationItem => ({
  category,
  categoryLabel,
  rating: rating as string | number,
  status
});

interface Dataset {
  id: string;
  name: string;
  observations: VisualObservationItem[];
  expMax: number | null;
  expDefects: number;
  expStatus: string;
  expSummaryKind: 'NEUTRE' | 'DEFECTS' | 'INTACT';
}

const datasets: Dataset[] = [
  {
    id: 'VALID', name: 'données valides',
    expMax: 2, expDefects: 2, expStatus: 'ACCEPTABLE', expSummaryKind: 'DEFECTS',
    observations: [mk('BLISTERING', 1, 'OBSERVE', 'Cloquage'), mk('FLAKING', 2, 'OBSERVE', 'Écaillage')]
  },
  {
    id: 'MISSING', name: 'données manquantes',
    expMax: null, expDefects: 0, expStatus: 'WARNING', expSummaryKind: 'NEUTRE',
    observations: [
      mk('BLISTERING', undefined, 'AUCUN', 'Cloquage'),
      mk('FLAKING', null, 'AUCUN', 'Écaillage'),
      mk('CRACKING', '', 'AUCUN', 'Craquelage')
    ]
  },
  {
    id: 'INVALID', name: 'données invalides',
    expMax: null, expDefects: 0, expStatus: 'INVALID', expSummaryKind: 'NEUTRE',
    observations: [
      mk('BLISTERING', 'abc', 'AUCUN', 'Cloquage'),
      mk('FLAKING', NaN, 'AUCUN', 'Écaillage'),
      mk('CRACKING', 7, 'AUCUN', 'Craquelage'),
      mk('CHALKING', -1, 'AUCUN', 'Farinage')
    ]
  },
  {
    id: 'ZERO', name: 'zéro réel',
    expMax: 0, expDefects: 0, expStatus: 'GOOD', expSummaryKind: 'INTACT',
    observations: [mk('BLISTERING', 0, 'AUCUN', 'Cloquage'), mk('FLAKING', '0', 'AUCUN', 'Écaillage')]
  },
  {
    id: 'MIXED', name: 'données mixtes (0 + défaut + manquant + invalide + label RAW CONFORME)',
    expMax: 2, expDefects: 2, expStatus: 'INVALID', expSummaryKind: 'DEFECTS',
    observations: [
      mk('BLISTERING', 0, 'AUCUN', 'Cloquage'),
      mk('FLAKING', 1, 'OBSERVE', 'Écaillage'),
      mk('CRACKING', undefined, 'AUCUN', 'Craquelage'),
      mk('CHALKING', 'abc', 'AUCUN', 'Farinage'),
      mk('OTHER_DEFECT', 2, 'CONFORME', 'Défaut autre')
    ]
  },
  {
    id: 'POSITIVE', name: 'valeur positive forte (3 et 5)',
    expMax: 5, expDefects: 2, expStatus: 'WARNING', expSummaryKind: 'DEFECTS',
    observations: [mk('BLISTERING', 3, 'OBSERVE', 'Cloquage'), mk('FLAKING', 5, 'OBSERVE', 'Écaillage')]
  }
];

const FORBIDDEN_TOKENS: readonly string[] = [
  'CONFORME',
  'CONFORMITÉ',
  'FAVORABLE',
  'DÉFAVORABLE',
  'DEFAVORABLE',
  'NON_CONFORME',
  'NON-CONFORME'
];

const ALLOWED_STATUS: readonly string[] = ['GOOD', 'ACCEPTABLE', 'WARNING', 'INVALID'];
const ALLOWED_PROTOCOL: readonly string[] = ['STANDARD', 'INCOMPLETE'];

export function runObservationsContractTests(): {
  results: ObservationsContractTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ObservationsContractTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const ruleSet = getDefaultScientificRuleSet();

  const computedOf = (ds: Dataset) => {
    const raw = { observations: ds.observations, overallNotes: 'contrat', assessedBy: 'OBS-CONTRACT' };
    const before = JSON.stringify(raw);
    const result = calculateObservations(raw, ruleSet);
    const serialized = JSON.stringify(result.computed).toUpperCase();
    return { computed: result.computed, serialized, before: JSON.stringify(raw) === before };
  };

  // --- OBS-CONTRACT-10 : aucune conclusion favorable/défavorable fabriquée ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { serialized } = computedOf(ds);
      const hit = FORBIDDEN_TOKENS.filter((t) => serialized.includes(t));
      if (hit.length > 0) bad.push(`${ds.id}:[${hit.join(',')}]`);
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-10', 'COMPUTED sans CONFORME/NON_CONFORME/FAVORABLE/DÉFAVORABLE (6 jeux)',
      ok, 'aucun jeton', bad.length === 0 ? 'aucun' : bad.join(' '));
  }

  // --- OBS-CONTRACT-11 : aucun verdict normatif NF EN 927-6 dans COMPUTED ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { serialized } = computedOf(ds);
      if (serialized.includes('NF EN 927') || serialized.includes('CONFORMITÉ') || serialized.includes('CONFORME')) {
        bad.push(ds.id);
      }
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-11', 'Aucun verdict de conformité NF EN 927-6 dans COMPUTED (6 jeux)',
      ok, 'aucun', bad.length === 0 ? 'aucun' : bad.join(' '));
  }

  // --- OBS-CONTRACT-12 : aucun critère INFIPERF dans COMPUTED ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { serialized } = computedOf(ds);
      if (serialized.includes('INFIPERF')) bad.push(ds.id);
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-12', 'Aucun critère/conclusion INFIPERF dans COMPUTED (6 jeux)',
      ok, 'aucun', bad.length === 0 ? 'aucun' : bad.join(' '));
  }

  // --- OBS-CONTRACT-MAX : maxRating conforme aux invariants (null ≠ 0 ≠ positif) ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { computed } = computedOf(ds);
      if (computed.maxRating !== ds.expMax) bad.push(`${ds.id}:got=${String(computed.maxRating)}`);
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-MAX', 'maxRating : null (manquant/invalide), 0 réel conservé, positif conservé',
      ok, 'null/0/positif selon jeu', bad.length === 0 ? 'OK' : bad.join(' '));
  }

  // --- OBS-CONTRACT-DEFECTS : defectsCount & statut qualité exacts ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { computed } = computedOf(ds);
      if (computed.defectsCount !== ds.expDefects || computed.qualityAssessment.status !== ds.expStatus) {
        bad.push(`${ds.id}:defects=${String(computed.defectsCount)},status=${computed.qualityAssessment.status}`);
      }
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-DEFECTS', 'defectsCount & qualityAssessment.status exacts (6 jeux)',
      ok, 'count/status attendus', bad.length === 0 ? 'OK' : bad.join(' '));
  }

  // --- OBS-CONTRACT-ENUM : enums restreints, aucun statut ajouté ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { computed } = computedOf(ds);
      if (!ALLOWED_STATUS.includes(computed.qualityAssessment.status)) bad.push(`${ds.id}:status`);
      if (!ALLOWED_PROTOCOL.includes(computed.protocolStatus)) bad.push(`${ds.id}:proto`);
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-ENUM', 'status ∈ {GOOD,ACCEPTABLE,WARNING,INVALID}, protocol ∈ {STANDARD,INCOMPLETE}',
      ok, 'enums restreints', bad.length === 0 ? 'OK' : bad.join(' '));
  }

  // --- OBS-CONTRACT-RAW : RAW intact et traçabilité de calcul présente ---
  {
    const rawIntact = datasets.every((ds) => computedOf(ds).before);
    const traceOk = datasets.every((ds) => {
      const { computed } = computedOf(ds);
      return typeof computed.computation.calculationVersion === 'string' && computed.computation.calculationVersion.length > 0;
    });
    const ok = rawIntact && traceOk;
    record('OBS-CONTRACT-RAW', 'RAW intact après calcul + calculationVersion présent (traçabilité)',
      ok, 'RAW inchangé, version présente', String(ok));
  }

  // --- OBS-CONTRACT-SUMMARY : résumés neutres et descriptifs, jamais favorables ---
  {
    const bad: string[] = [];
    for (const ds of datasets) {
      const { computed } = computedOf(ds);
      const s = computed.summary.toUpperCase();
      if (ds.expSummaryKind === 'NEUTRE' && s !== 'NON ÉVALUÉ') bad.push(`${ds.id}:summary=${computed.summary}`);
      if (ds.expSummaryKind === 'INTACT' && s !== 'ASPECT INTACT (AUCUN DÉFAUT)') bad.push(`${ds.id}:summary=${computed.summary}`);
      if (ds.expSummaryKind === 'DEFECTS' && !s.startsWith('DÉFAUTS :')) bad.push(`${ds.id}:summary=${computed.summary}`);
    }
    const ok = bad.length === 0;
    record('OBS-CONTRACT-SUMMARY', 'Résumés : Non évalué / Aspect intact / Défauts : (jamais conforme)',
      ok, 'résumés neutres exacts', bad.length === 0 ? 'OK' : bad.join(' '));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}