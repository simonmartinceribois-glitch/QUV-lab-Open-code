/**
 * QUV-Lab — Suite de Tests CONSOMMATION COMPUTED des OBSERVATIONS par la Synthèse Technique.
 *
 * P0 : generateTechnicalSynthesis consomme EXCLUSIVEMENT le COMPUTED validé du
 * moteur observationsEngine. Aucune cotation n'est recalculée depuis le RAW.
 *  - maxRating === null           → non évalué (≠ 0)
 *  - maxRating === 0              → cotation réelle zéro (donnée enregistrée)
 *  - RAW contradictoire vs COMPUTED → COMPUTED prioritaire, jamais le RAW
 *  - témoin T exclu de la population exposée
 */

import { generateTechnicalSynthesis } from '../analysis/TechnicalSynthesisGenerator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';
import type { VisualObservationsComputedData } from '../../types/scientific';

export interface SynthesisObsTestResult {
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

interface PanelSpec {
  id: string;
  label: string;
  role: 'WITNESS' | 'EXPOSED_1';
  roleCode: 'T' | 'E1';
}

function buildTrial(
  trialId: string,
  panels: PanelSpec[],
  observations: Array<{ panelId: string; computed?: VisualObservationsComputedData | null; raw?: unknown }>
): Trial {
  const stageT0Id = `${trialId}-st-t0`;
  const stageC12Id = `${trialId}-st-c12`;
  const batchId = `${trialId}-batch-1`;
  const batch = {
    id: batchId,
    trialId,
    reference: `LOT ${trialId}`,
    orderIndex: 1,
    panels: panels.map((p) => ({ id: p.id, batchId, index: 1, label: p.label, role: p.role, roleCode: p.roleCode, status: 'ACTIVE' as const }))
  };
  const acquisitions: Trial['acquisitions'] = {};
  for (const o of observations) {
    if (o.computed === undefined) continue;
    acquisitions[`${stageC12Id}__${o.panelId}__OBSERVATIONS`] = {
      id: `${trialId}-obs-${o.panelId}`, trialId, stageId: stageC12Id, batchId, panelId: o.panelId,
      familyId: 'OBSERVATIONS',
      raw: o.raw !== undefined ? o.raw : {},
      computed: o.computed,
      status: 'COMPLETE', alerts: [], trace: { createdBy: 'TEST_OP', createdAt: '2026-09-09T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
  }

  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-TS-OBS-${trialId}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['OBSERVATIONS'], familyConfigs: {} },
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

function runSynthesis(trial: Trial) {
  const ruleSet = getDefaultScientificRuleSet();
  return generateTechnicalSynthesis(trial, ruleSet, { targetStageId: `${trial.id}-st-c12` });
}

export function runSynthesisObsTests(): {
  results: SynthesisObsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: SynthesisObsTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const e1: PanelSpec = { id: 'p1', label: '1', role: 'EXPOSED_1', roleCode: 'E1' };

  {
    const trial = buildTrial('t01', [e1], []);
    const syn = runSynthesis(trial);
    record('TS-OBS-01',
      'Aucune donnée (computed absent) → aucune phrase « aucun défaut », limitation présente',
      !syn.synthesisText.toLowerCase().includes('défaut') &&
      syn.limitations.some((l) => l.includes('Aucune observation visuelle valide')),
      'limitation « Aucune observation visuelle valide », aucune conclusion défaut',
      `limitations=${JSON.stringify(syn.limitations)}, text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t02', [e1], [{ panelId: 'p1', computed: obsComputed(null) }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-02',
      'maxRating = null → non évalué (≠ 0), limitation présente, jamais « 0 »',
      !syn.synthesisText.includes('aucun défaut') &&
      syn.limitations.some((l) => l.includes('Aucune observation visuelle valide')),
      'non évalué, aucune cotation 0 fabriquée',
      `limitations=${JSON.stringify(syn.limitations)}, text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t03', [e1], [{ panelId: 'p1', computed: obsComputed(0) }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-03',
      'maxRating = 0 → donnée réelle enregistrée, 0 conservé, pas de limitation « aucune donnée »',
      syn.synthesisText.includes('aucun défaut coté pour les catégories évaluées') &&
      !syn.synthesisText.includes('selon ISO 4628') &&
      !syn.limitations.some((l) => l.includes('Aucune observation visuelle valide')),
      'phrase « aucun défaut coté pour les catégories évaluées », 0 conservé',
      `limitations=${JSON.stringify(syn.limitations)}, text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t04', [e1], [{ panelId: 'p1', computed: obsComputed(2, 1) }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-04',
      'maxRating = 2 → synthèse descriptive indiquant la cotation 2',
      syn.synthesisText.includes('cotation maximale de 2'),
      'phrase « cotation maximale de 2 pour les observations disponibles »',
      `text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t05', [
      { id: 'p1', label: '1', role: 'EXPOSED_1', roleCode: 'E1' },
      { id: 'p2', label: '2', role: 'EXPOSED_1', roleCode: 'E1' },
      { id: 'p3', label: '3', role: 'EXPOSED_1', roleCode: 'E1' }
    ], [
      { panelId: 'p1', computed: obsComputed(null) },
      { panelId: 'p2', computed: obsComputed(0) },
      { panelId: 'p3', computed: obsComputed(2, 1) }
    ]);
    const syn = runSynthesis(trial);
    record('TS-OBS-05',
      'null + 0 + 2 → suivant la réalité null ≠ 0 ≠ 2, partiel signalé, max=2 (null exclu)',
      syn.synthesisText.includes('cotation maximale de 2') &&
      syn.limitations.some((l) => l.includes('partiellement disponibles')),
      'phrase max=2 + limitation partielle, aucun panneau manquant contribué au max',
      `limitations=${JSON.stringify(syn.limitations)}, text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t06', [e1], [{
      panelId: 'p1',
      computed: obsComputed(2, 1),
      raw: { observations: [{ category: 'BLISTERING', categoryLabel: 'Cloquage', rating: 5, status: 'NON_CONFORME' }] }
    }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-06',
      'RAW contradictoire (rating 5) vs COMPUTED (maxRating 2) → COMPUTED prioritaire, jamais 5',
      syn.synthesisText.includes('cotation maximale de 2') &&
      !syn.synthesisText.includes('5') &&
      !syn.synthesisText.includes('Cloquage'),
      'la phrase provient du COMPUTED (2), jamais du RAW (5)',
      `text=${syn.synthesisText}`);
  }

  {
    const trial = buildTrial('t07', [e1], [{ panelId: 'p1', computed: obsComputed(0), raw: undefined }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-07',
      'RAW absent / COMPUTED présent → synthèse fonctionne depuis le COMPUTED seul',
      syn.synthesisText.includes('aucun défaut coté pour les catégories évaluées') &&
      syn.sentenceCount >= 2,
      'synthèse dérivée du COMPUTED sans tentative de lecture RAW',
      `sentences=${syn.sentenceCount}, text=${syn.synthesisText}`);
  }

  {
    const witness: PanelSpec = { id: 'p-T', label: 'T', role: 'WITNESS', roleCode: 'T' };
    const trial = buildTrial('t08', [e1, witness], [{ panelId: 'p-T', computed: obsComputed(5, 1) }]);
    const syn = runSynthesis(trial);
    record('TS-OBS-08',
      'Observation uniquement sur le témoin T → aucune contribution à la synthèse exposée',
      syn.limitations.some((l) => l.includes('Aucune observation visuelle valide')) &&
      !syn.synthesisText.includes('cotation maximale de 5'),
      'p-T exclu par getActiveExposedPanels, limitation d\'absence de donnée exposée',
      `limitations=${JSON.stringify(syn.limitations)}, text=${syn.synthesisText}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}