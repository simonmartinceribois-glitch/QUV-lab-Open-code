/**
 * QUV-Lab — Suite de Tests ALIGNEMENT OBSERVATIONS SUR LE COMPUTED.
 *
 * P1 TrendAnalyzer : la disponibilité d'une observation ne se déduit plus de la
 * seule présence d'un RAW. Elle est fondée EXCLUSIVEMENT sur le COMPUTED
 * (RAW → observationsEngine → COMPUTED). maxRating null = non évalué ;
 * maxRating 0 = observation réelle (aspect intact) ; maxRating ≥ 1 = observation
 * réelle avec défaut. Le témoin T reste exclu (getActiveExposedPanels).
 *
 * P2 AnalysisAnomalyDetector : l'usage RAW est conservé UNIQUEMENT pour le
 * contrôle de cohérence (cotation vs commentaire textuel), mais la validation de
 * la cotation utilise la source de vérité commune parseObservationRating.
 * Une cotation MISSING ou INVALID n'est jamais transformée en 0.
 */

import { extractTemporalKinetics } from '../analysis/TrendAnalyzer';
import { detectTrialAnomalies } from '../analysis/AnalysisAnomalyDetector';
import { calculateObservations, parseObservationRating } from '../observationsEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';
import type { VisualObservationsComputedData, VisualObservationItem } from '../../types/scientific';

export interface ObservationsAnalysisIntegrityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function obsComputed(maxRating: number | null, defectsCount = 0): VisualObservationsComputedData {
  return {
    totalEvaluated: maxRating === null ? 0 : 1,
    defectsCount,
    maxRating,
    summary: maxRating === null ? 'Non évalué' : defectsCount > 0 ? `Défauts : (Note: ${maxRating})` : 'Aspect intact (Aucun défaut)',
    qualityAssessment: {
      status: maxRating === null ? 'INVALID' : defectsCount > 0 ? 'ACCEPTABLE' : 'GOOD',
      validCount: maxRating === null ? 0 : 1,
      expectedCount: 1,
      actualCount: maxRating === null ? 0 : 1,
      suspectCount: 0,
      invalidCount: 0,
      missingCount: maxRating === null ? 1 : 0,
      completenessPercent: maxRating === null ? 0 : 100,
      warnings: []
    },
    protocolStatus: maxRating === null ? 'INCOMPLETE' : 'STANDARD',
    computation: { calculationVersion: '1.2.0', calculatedAt: '2026-09-09T00:00:00Z' }
  };
}

const PANELS: Array<{ id: string; label: string; role: 'WITNESS' | 'EXPOSED_1' | 'EXPOSED_2' | 'EXPOSED_3'; roleCode: 'T' | 'E1' | 'E2' | 'E3'; status: 'ACTIVE' }> = [
  { id: 'pT', label: 'T', role: 'WITNESS', roleCode: 'T', status: 'ACTIVE' },
  { id: 'pE1', label: '1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' },
  { id: 'pE2', label: '2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' },
  { id: 'pE3', label: '3', role: 'EXPOSED_3', roleCode: 'E3', status: 'ACTIVE' }
];

interface ObsSpec {
  panelId: string;
  raw?: unknown;
  computed?: VisualObservationsComputedData | null;
  colorForE1?: boolean;
}

function buildTrial(trialId: string, specs: ObsSpec[]): Trial {
  const stageT0Id = `${trialId}-st-t0`;
  const stageC12Id = `${trialId}-st-c12`;
  const batchId = `${trialId}-batch-1`;
  const batch = {
    id: batchId,
    trialId,
    reference: `LOT ${trialId}`,
    orderIndex: 1,
    panels: PANELS.map((p) => ({ ...p, batchId, index: PANELS.indexOf(p) + 1 }))
  };
  const acquisitions: Trial['acquisitions'] = {};

  for (const s of specs) {
    if (s.raw !== undefined || s.computed !== undefined) {
      acquisitions[`${stageC12Id}__${s.panelId}__OBSERVATIONS`] = {
        id: `${trialId}-obs-${s.panelId}`, trialId, stageId: stageC12Id, batchId, panelId: s.panelId,
        familyId: 'OBSERVATIONS',
        raw: s.raw !== undefined ? s.raw : {},
        computed: s.computed as never,
        status: 'COMPLETE', alerts: [], trace: { createdBy: 'TEST_OP', createdAt: '2026-09-09T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
      } as unknown as Trial['acquisitions'][string];
    }
    if (s.colorForE1) {
      acquisitions[`${stageC12Id}__${s.panelId}__COLOR`] = {
        id: `${trialId}-col-${s.panelId}`, trialId, stageId: stageC12Id, batchId, panelId: s.panelId,
        familyId: 'COLOR',
        raw: {},
        computed: { deltaE: 1, deltaL: 1, deltaA: 1, deltaB: 1 },
        status: 'COMPLETE', alerts: [], trace: { createdBy: 'TEST_OP', createdAt: '2026-09-09T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
      } as unknown as Trial['acquisitions'][string];
    }
  }

  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-OA-${trialId}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR', 'OBSERVATIONS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [
      { id: stageT0Id, trialId, cycleIndex: 0, stageType: 'INITIAL', name: 'T0', scheduledExposureHours: 0, status: 'VALIDATED' },
      { id: stageC12Id, trialId, cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: 'C12', scheduledExposureHours: 2016, status: 'VALIDATED' }
    ],
    batches: [batch],
    acquisitions, auditTrail: [], mediaReferences: []
  } as Trial;
}

export function runObservationsAnalysisIntegrityTests(): {
  results: ObservationsAnalysisIntegrityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const ruleSet = getDefaultScientificRuleSet();
  const results: ObservationsAnalysisIntegrityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const hasObsAtC12 = (trial: Trial): boolean => {
    const series = extractTemporalKinetics(trial, `${trial.id}-batch-1`);
    return (series.find((s) => s.cycleIndex === 12)?.hasObservations ?? false);
  };
  const countContradictions = (trial: Trial): number => {
    const anomalies = detectTrialAnomalies(trial, ruleSet, {
      stageId: `${trial.id}-st-c12`,
      batchIds: [`${trial.id}-batch-1`],
      families: ['OBSERVATIONS']
    });
    return anomalies.filter((a) => a.code === 'ANALYSIS_TEXT_CONTRADICTION').length;
  };

  {
    const trial = buildTrial('TR1', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: 5, status: 'CONFORME' }] }, colorForE1: true }
    ]);
    const passed = hasObsAtC12(trial) === false;
    record('TR-OBS-01', 'RAW présent, COMPUTED absent → observation non évaluée', passed, 'hasObservations = false (non évaluée)', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR2', [{ panelId: 'pE1', computed: obsComputed(null), colorForE1: true }]);
    const passed = hasObsAtC12(trial) === false;
    record('TR-OBS-02', 'COMPUTED maxRating null → non évaluée', passed, 'hasObservations = false (non évaluée)', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR3', [{ panelId: 'pE1', computed: obsComputed(0), colorForE1: true }]);
    const passed = hasObsAtC12(trial) === true;
    record('TR-OBS-03', 'COMPUTED maxRating 0 → observation réelle, aspect intact', passed, 'hasObservations = true', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR4', [{ panelId: 'pE1', computed: obsComputed(2), colorForE1: true }]);
    const passed = hasObsAtC12(trial) === true;
    record('TR-OBS-04', 'COMPUTED maxRating 2 → observation réelle avec défaut', passed, 'hasObservations = true', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR5', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: 5, status: 'CONFORME' }] }, computed: obsComputed(2), colorForE1: true }
    ]);
    const passed = hasObsAtC12(trial) === true;
    record('TR-OBS-05', 'RAW (5) contradictoire vs COMPUTED (2) → COMPUTED utilisé (résultat = 2)', passed, 'hasObservations = true (disponibilité issue du COMPUTED)', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR6', [
      { panelId: 'pE1', computed: obsComputed(2), colorForE1: true }
    ]);
    const passed = hasObsAtC12(trial) === true;
    record('TR-OBS-06', 'RAW absent / COMPUTED valide → observation disponible', passed, 'hasObservations = true (le RAW n\'est pas exigé)', String(hasObsAtC12(trial)));
  }

  {
    const trial = buildTrial('TR7', [
      { panelId: 'pT', raw: { observations: [{ category: 'BLISTERING', rating: 5, status: 'CONFORME' }] }, computed: obsComputed(5) }
    ]);
    const series = extractTemporalKinetics(trial, `${trial.id}-batch-1`);
    const passed = series.length === 0;
    record('TR-OBS-07', 'Observation uniquement sur le témoin T → exclue de l\'analyse exposée', passed, 'aucune série (témoin T exclu)', `séries = ${series.length}`);
  }

  {
    const trial = buildTrial('TR8', [
      { panelId: 'pE1', computed: obsComputed(0) },
      { panelId: 'pE2', computed: obsComputed(0) },
      { panelId: 'pE3', computed: obsComputed(0) }
    ]);
    const passed = hasObsAtC12(trial) === true;
    record('TR-OBS-08', 'E1/E2/E3 avec observations → inclus dans l\'analyse exposée', passed, 'hasObservations = true (E1/E2/E3 inclus)', String(hasObsAtC12(trial)));
  }

  {
    const p0 = parseObservationRating(0);
    const passed = p0.validity === 'VALID' && p0.value === 0;
    record('AN-OBS-01', 'parseObservationRating(0) → VALID / 0', passed, 'VALID, value 0', `${p0.validity}, value ${p0.value}`);
  }

  {
    const p0 = parseObservationRating('0');
    const p2 = parseObservationRating(2);
    const passed = p0.validity === 'VALID' && p0.value === 0 && p2.validity === 'VALID' && p2.value === 2;
    record('AN-OBS-02', 'parseObservationRating("0") et 2 → VALID / 0 et 2', passed, '"0" → VALID/0, 2 → VALID/2', `"0" → ${p0.validity}/${p0.value}, 2 → ${p2.validity}/${p2.value}`);
  }

  {
    const pNull = parseObservationRating(null);
    const pUndef = parseObservationRating(undefined);
    const pEmpty = parseObservationRating('');
    const passed = [pNull, pUndef, pEmpty].every((p) => p.validity === 'MISSING' && p.value === null);
    record('AN-OBS-03', 'parseObservationRating(null/undefined/"") → MISSING, jamais 0', passed, 'MISSING / null (3x)', `${pNull.validity}/${pNull.value}, ${pUndef.validity}/${pUndef.value}, ${pEmpty.validity}/${pEmpty.value}`);
  }

  {
    const cases: Array<string | number> = ['abc', NaN, Infinity];
    const parsed = cases.map(parseObservationRating);
    const passed = parsed.every((p) => p.validity === 'INVALID' && p.value === null);
    record('AN-OBS-04', 'parseObservationRating(abc/NaN/Infinity) → INVALID, jamais 0', passed, 'INVALID / null (3x)', parsed.map((p) => `${p.validity}/${p.value}`).join(', '));
  }

  {
    const cases: Array<string | number> = [-1, 6];
    const parsed = cases.map(parseObservationRating);
    const passed = parsed.every((p) => p.validity === 'INVALID' && p.value === null);
    record('AN-OBS-05', 'parseObservationRating(-1/6) hors domaine → INVALID, jamais 0', passed, 'INVALID / null (2x)', parsed.map((p) => `${p.validity}/${p.value}`).join(', '));
  }

  // --- AN-OBS-09 : dataset complet de l'audit P3 (parseObservationRating) ---
  {
    const valid: Array<string | number> = [0, '0', 5];
    const missing: Array<string | number | null | undefined> = [null, undefined, '', '   '];
    const invalid: Array<string | number> = ['abc', NaN, Infinity, -Infinity, -1, 6];
    const pValid = valid.map(parseObservationRating);
    const pMissing = missing.map(parseObservationRating);
    const pInvalid = invalid.map(parseObservationRating);
    const okValid = pValid.every((p) => p.validity === 'VALID' && p.value !== null) &&
      pValid[0].value === 0 && pValid[1].value === 0 && pValid[2].value === 5;
    const okMissing = pMissing.every((p) => p.validity === 'MISSING' && p.value === null);
    const okInvalid = pInvalid.every((p) => p.validity === 'INVALID' && p.value === null);
    // Aucune valeur absente/invalide ne doit être transformée en 0 (S0 §8, §18).
    const passed = okValid && okMissing && okInvalid && pValid.length === 3 && pMissing.length === 4 && pInvalid.length === 6;
    record('AN-OBS-09', 'Dataset audit P3 (13 valeurs) : VALID=3 (0,"0",5), MISSING=4 (null,undefined,"","   "), INVALID=6 (abc,NaN,∞,-∞,-1,6), aucune fabrication de 0',
      passed, '3 VALID / 4 MISSING / 6 INVALID, value null partout ailleurs',
      `V=${pValid.map((p) => `${p.validity}/${p.value}`).join(',')} ; M=${pMissing.map((p) => `${p.validity}/${p.value}`).join(',')} ; I=${pInvalid.map((p) => `${p.validity}/${p.value}`).join(',')}`);
  }

  // --- AN-OBS-10 : agrégat calculateObservations sur le dataset complet P3 ---
  {
    const rawObs = [
      { category: 'BLISTERING', categoryLabel: 'Cloquage', rating: 0, status: 'AUCUN' },
      { category: 'FLAKING', categoryLabel: 'Écaillage', rating: '0', status: 'AUCUN' },
      { category: 'CRACKING', categoryLabel: 'Craquelage', rating: 5, status: 'OBSERVE' },
      { category: 'CHALKING', categoryLabel: 'Farinage', rating: null, status: 'AUCUN' },
      { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: undefined, status: 'AUCUN' },
      { category: 'OTHER_DEFECT', categoryLabel: 'Défaut autre', rating: '', status: 'AUCUN' },
      { category: 'CROSS_CUT_ADHESION', categoryLabel: 'Adhérence quadrillage', rating: '   ', status: 'AUCUN' },
      { category: 'BLISTERING', categoryLabel: 'Cloquage', rating: 'abc', status: 'AUCUN' },
      { category: 'FLAKING', categoryLabel: 'Écaillage', rating: NaN, status: 'AUCUN' },
      { category: 'CRACKING', categoryLabel: 'Craquelage', rating: Infinity, status: 'AUCUN' },
      { category: 'CHALKING', categoryLabel: 'Farinage', rating: -Infinity, status: 'AUCUN' },
      { category: 'GENERAL_APPEARANCE', categoryLabel: 'Aspect général', rating: -1, status: 'AUCUN' },
      { category: 'OTHER_DEFECT', categoryLabel: 'Défaut autre', rating: 6, status: 'AUCUN' }
    ] as unknown as VisualObservationItem[];
    const { computed } = calculateObservations({ observations: rawObs }, ruleSet);
    const qa = computed.qualityAssessment;
    const passed =
      qa.validCount === 3 &&
      qa.missingCount === 4 &&
      qa.invalidCount === 6 &&
      computed.maxRating === 5 &&
      computed.defectsCount === 1 &&
      computed.totalEvaluated === 13;
    record('AN-OBS-10', 'Dataset audit P3 (agrégat) : valid=3, missing=4, invalid=6, maxRating=5, defects=1 (0 réel conservé, aucun 0 fabriqué)',
      passed,
      'valid=3, missing=4, invalid=6, maxRating=5, defects=1',
      `valid=${qa.validCount}, missing=${qa.missingCount}, invalid=${qa.invalidCount}, maxRating=${String(computed.maxRating)}, defects=${computed.defectsCount}, total=${computed.totalEvaluated}`);
  }

  {
    const trialNum = buildTrial('AN6a', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: 0, comment: 'décollement important' }] } }
    ]);
    const trialStr = buildTrial('AN6b', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: '0', comment: 'décollement important' }] } }
    ]);
    const countNum = countContradictions(trialNum);
    const countStr = countContradictions(trialStr);
    const passed = countNum === 1 && countStr === 1;
    record('AN-OBS-06', 'Cotation valide 0 ou "0" + commentaire dégradation → contradiction détectée', passed, '1 contradiction (0), 1 contradiction ("0")', `0 → ${countNum}, "0" → ${countStr}`);
  }

  {
    const trial = buildTrial('AN7', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: null, comment: 'décollement important' }] } }
    ]);
    const count = countContradictions(trial);
    const passed = count === 0;
    record('AN-OBS-07', 'Cotation manquante (null) + commentaire → aucune cotation 0 inventée', passed, '0 contradiction', `contradictions = ${count}`);
  }

  {
    const trialInvalid = buildTrial('AN8a', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: 'abc', comment: 'décollement important' }] } }
    ]);
    const trialDomain = buildTrial('AN8b', [
      { panelId: 'pE1', raw: { observations: [{ category: 'BLISTERING', rating: 6, comment: 'décollement important' }] } }
    ]);
    const countInvalid = countContradictions(trialInvalid);
    const countDomain = countContradictions(trialDomain);
    const passed = countInvalid === 0 && countDomain === 0;
    record('AN-OBS-08', 'Cotation invalide/hors domaine + commentaire → aucune cotation 0 inventée', passed, '0 contradiction (invalid), 0 contradiction (hors domaine)', `invalid → ${countInvalid}, hors domaine → ${countDomain}`);
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length
  };
  return { results, summary };
}