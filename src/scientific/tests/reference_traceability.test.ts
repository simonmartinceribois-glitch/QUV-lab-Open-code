/**
 * QUV-Lab — Suite de Tests TRAÇABILITÉ EXPLICITE DES RÉFÉRENCES (REF-01..15).
 *
 * Chaque calcul porte referenceTrace (stage/panneau/acquisition source + règle)
 * alimentée par le recalculateur : COLOR/GLOSS/PERSOZ = SAME_PANEL_T0,
 * ADHÉSION C12 = T0_WITNESS_REFERENCE, sinon NONE (jamais inventée).
 * Restitution : colonnes CSV + panneau bench. Enrichissement seul, aucun
 * résultat numérique modifié.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import { isPersozEligiblePanel, isAdhesionEligiblePanel, getActiveE1E2E3Panels } from '../panelUtils';
import { exportReportToCsv, exportRawDataToCsv } from '../../services/reportGenerator';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type {
  ColorComputedData,
  AdhesionComputedData,
  PersozComputedData,
  ScientificReport,
  ReferenceTrace
} from '../../types/scientific';

export interface ReferenceTraceabilityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-ref-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-REF-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR', 'PERSOZ', 'ADHESION'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT REF-${trialSeq}`, orderIndex: 1,
      dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
      panels: [
        { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  } as Trial;
}

function colorRaw(L: number, a: number, b: number) {
  return { readings: [1, 2, 3, 4].map((i) => ({ pointIndex: i, L, a, b })) };
}

function persozRaw() {
  return {
    readings: [85.2, 84.8, 85.5].map((v, i) => ({ pointIndex: i + 1, dampingTimeSeconds: v })),
    unit: 'SECONDS'
  };
}

function adhRaw(cls: number) {
  return {
    adhesionClass: cls,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020'
  };
}

function seedComputed(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string, raw: unknown): PanelAcquisitionRecord {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const rec: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw, computed: null, status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  const { updatedRecord } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = updatedRecord;
  return updatedRecord;
}

function traceOf(rec: PanelAcquisitionRecord): ReferenceTrace | undefined {
  const computed = rec.computed as { referenceTrace?: ReferenceTrace } | null;
  return computed?.referenceTrace;
}

function minimalReport(trialId: string): ScientificReport {
  return {
    id: 'rep-ref', metadata: {
      reportId: 'rep-ref', trialId, generatedAt: '2026-09-05T00:00:00Z', generatedBy: 'TEST_OP',
      reportVersion: '1.0', schemaVersion: '1.2.0', calculationVersion: 't', scientificRuleSetId: 'rs'
    },
    status: 'GENERATED', title: 'T', executiveSummary: 'S', normativeReference: 'NF EN 927-6',
    protocolStatus: 'STANDARD', isComplete: true, missingCriticalElements: [],
    sections: {
      identification: 'a', studyPurpose: 'a', normativeReferences: 'a', materialsAndBatches: 'a',
      panelsDefinition: 'a', experimentalConditions: 'a', exposureSchedule: 'a', measurementPlan: 'a',
      colorResults: 'a', glossResults: 'a', persozResults: 'a', visualObservations: 'a',
      kineticsAnalysis: 'a', qualityControl: 'a', deviationsAndAdaptations: 'a',
      calculationTraceability: 'a', scientificSynthesis: 'a', factualConclusion: 'Conclusion.'
    },
    annexes: {
      annexA_RawDataSummary: 'A', annexB_ComputedResultsSummary: 'B', annexC_QualityAssessmentSummary: 'C',
      annexD_ProtocolAdaptationsSummary: 'D', annexE_AuditTrailSummary: 'E', annexF_ScientificVersionSummary: 'F'
    },
    reviewComments: []
  } as ScientificReport;
}

export function runReferenceTraceabilityTests(): {
  results: ReferenceTraceabilityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ReferenceTraceabilityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- REF-01 : COLOR C12 E1 → propre T0 E1 ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'E1', 'COLOR', colorRaw(55, 2, 10));
    seedComputed(trial, 12, 'E1', 'COLOR', colorRaw(60, 2, 10));
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__COLOR`];
    const t = traceOf(rec);
    const expectedAcq = `acq-${stageT0.id}-E1-COLOR`;
    const ok = t?.referenceRule === 'SAME_PANEL_T0' &&
      t?.referenceStageId === stageT0.id &&
      t?.referencePanelId === `${trial.id}-p-E1` &&
      t?.referenceAcquisitionId === expectedAcq;
    record('REF-01', 'COLOR C12 E1 → propre T0 E1', ok, 'trace E1 complète', JSON.stringify(t));
  }

  // (REF-02/03 vérifiés via la boucle ci-dessus ; assertions individuelles ci-dessous.)
  {
    const trial = buildTrial();
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => {
      seedComputed(trial, 0, sfx, 'COLOR', colorRaw(50, 2, 10));
      seedComputed(trial, 12, sfx, 'COLOR', colorRaw(60, 2, 10));
    });
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const t2 = traceOf(trial.acquisitions[`${stageC12.id}__${trial.id}-p-E2__COLOR`]);
    const t3 = traceOf(trial.acquisitions[`${stageC12.id}__${trial.id}-p-E3__COLOR`]);
    const ok2 = t2?.referencePanelId === `${trial.id}-p-E2` && t2?.referenceRule === 'SAME_PANEL_T0';
    const ok3 = t3?.referencePanelId === `${trial.id}-p-E3` && t3?.referenceRule === 'SAME_PANEL_T0';
    record('REF-02', 'COLOR C12 E2 → propre T0 E2', ok2, 'panneau E2, SAME_PANEL_T0', JSON.stringify(t2));
    record('REF-03', 'COLOR C12 E3 → propre T0 E3', ok3, 'panneau E3, SAME_PANEL_T0', JSON.stringify(t3));
  }

  // --- REF-04 : référence COLOR jamais T ---
  {
    const trial = buildTrial();
    (['T', 'E1'] as const).forEach((sfx) => {
      seedComputed(trial, 0, sfx, 'COLOR', colorRaw(50, 2, 10));
      seedComputed(trial, 12, sfx, 'COLOR', colorRaw(60, 2, 10));
    });
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const t = traceOf(trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__COLOR`]);
    const ok = t?.referencePanelId !== `${trial.id}-p-T`;
    record('REF-04', 'Référence COLOR jamais T', ok === true, 'panel ≠ T', String(t?.referencePanelId));
  }

  // --- REF-05/06/07 : ADHÉSION C12 → T0/T ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'T', 'ADHESION', adhRaw(0));
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      seedComputed(trial, 12, sfx, 'ADHESION', adhRaw(1 + i));
    });
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const expectedAcq = `acq-${stageT0.id}-T-ADHESION`;
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      const t = traceOf(trial.acquisitions[`${stageC12.id}__${trial.id}-p-${sfx}__ADHESION`]);
      const ok = t?.referenceRule === 'T0_WITNESS_REFERENCE' &&
        t?.referenceStageId === stageT0.id &&
        t?.referencePanelId === `${trial.id}-p-T` &&
        t?.referenceAcquisitionId === expectedAcq;
      record(`REF-0${5 + i}`, `ADHÉSION C12 ${sfx} → T0/T`,
        ok, 'T0/T, T0_WITNESS_REFERENCE', JSON.stringify(t));
    });
  }

  // --- REF-08 : ADHÉSION C12 jamais T0/E ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'T', 'ADHESION', adhRaw(1));
    seedComputed(trial, 0, 'E1', 'ADHESION', adhRaw(5));
    seedComputed(trial, 12, 'E1', 'ADHESION', adhRaw(3));
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const t = traceOf(trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__ADHESION`]);
    const computed = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__ADHESION`].computed as AdhesionComputedData | null;
    const ok = t?.referencePanelId === `${trial.id}-p-T` && computed?.initialAdhesionClass === 1;
    record('REF-08', 'ADHÉSION C12 jamais T0/E (leurre E1=5 ignoré)',
      ok === true, 'réf T, initial=1', `réf=${String(t?.referencePanelId)?.slice(-3)}, initial=${String(computed?.initialAdhesionClass)}`);
  }

  // --- REF-09 : PERSOZ T0 sans référence artificielle ---
  {
    const trial = buildTrial();
    const rec = seedComputed(trial, 0, 'E1', 'PERSOZ', persozRaw());
    const t = traceOf(rec);
    const computed = rec.computed as PersozComputedData | null;
    const ok = t?.referenceRule === 'NONE' &&
      t?.referenceStageId === null && t?.referencePanelId === null && t?.referenceAcquisitionId === null &&
      typeof computed?.meanDampingTime === 'number';
    record('REF-09', 'PERSOZ T0 : NONE explicite, calcul intact',
      ok === true, 'NONE + mean numérique', `${t?.referenceRule}, mean=${String(computed?.meanDampingTime)}`);
  }

  // --- REF-10/11 : export avec identifiants réels (ligne C12/E1) ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'E1', 'COLOR', colorRaw(60, 2, 10));
    seedComputed(trial, 12, 'E1', 'COLOR', colorRaw(65, 2, 10));
    const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const expectedAcq = `acq-${stageT0.id}-E1-COLOR`;
    const row = csv.split('\n').find((l) => l.includes(';2016;') && l.includes(';"1";') && l.includes(';COLOR;'));
    const cols = (row || '').split(';');
    // 16 colonnes : 12 existantes + 4 référence en fin.
    const okCols = cols.length === 16;
    const okIds = typeof row === 'string' &&
      row.includes(`${stageT0.id}`) &&
      row.includes(`${trial.id}-p-E1`) &&
      row.includes(expectedAcq) &&
      row.includes('SAME_PANEL_T0');
    record('REF-10', 'Export : 4 colonnes référence présentes et renseignées',
      okCols && okIds, '16 cols + ids + SAME_PANEL_T0', (row || 'ligne absente').slice(-140));
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const recC12 = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__COLOR`];
    const traceC12 = (recC12.computed as { referenceTrace?: { referenceAcquisitionId?: unknown } } | null)?.referenceTrace;
    const recT0 = trial.acquisitions[`${stageT0.id}__${trial.id}-p-E1__COLOR`];
    const okId = traceC12?.referenceAcquisitionId === recT0.id && row !== undefined && row.includes(recT0.id);
    record('REF-11', 'Identifiants exportés = acquisitions utilisées (C12/E1)',
      okId, `trace pointe ${expectedAcq}, ligne l'exporte`, String(okId));
  }

  // --- REF-12 : aucune fiction si source absente ---
  {
    const trial = buildTrial();
    seedComputed(trial, 12, 'E2', 'COLOR', colorRaw(65, 2, 10));
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E2__COLOR`];
    const t = traceOf(rec);
    const computed = rec.computed as ColorComputedData | null;
    const ok = t?.referenceRule === 'NONE' &&
      t?.referenceStageId === null && t?.referenceAcquisitionId === null &&
      computed?.deltaE === null && typeof computed?.meanL === 'number';
    record('REF-12', 'Source absente : NONE + nulls, pas de fiction, mesure intacte',
      ok === true, 'NONE, ΔE null, meanL numérique',
      `${t?.referenceRule}, ΔE=${String(computed?.deltaE)}, L=${String(computed?.meanL)}`);
  }

  // --- REF-13 : non-régression numérique ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'E1', 'COLOR', colorRaw(60, 2, 10));
    const rec = seedComputed(trial, 12, 'E1', 'COLOR', colorRaw(65, 2, 10));
    const computed = rec.computed as ColorComputedData | null;
    const t = traceOf(rec);
    const ok = computed?.deltaE === 5 &&
      computed?.meanL === 65 &&
      t?.referenceRule === 'SAME_PANEL_T0';
    record('REF-13', 'Enrichissement seul : ΔE=5.00, L=65 inchangés + trace',
      ok === true, 'ΔE=5, L=65, trace SAME_PANEL_T0',
      `ΔE=${String(computed?.deltaE)}, L=${String(computed?.meanL)}, ${t?.referenceRule}`);
  }

  // --- REF-14 : populations inchangées ---
  {
    const t0 = { cycleIndex: 0 };
    const c6 = { cycleIndex: 6 };
    const c12 = { cycleIndex: 12 };
    const T = { label: 'T', roleCode: 'T', role: 'WITNESS' };
    const E1 = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
    const E2 = { label: '2', roleCode: 'E2', role: 'EXPOSED_2' };
    const E3 = { label: '3', roleCode: 'E3', role: 'EXPOSED_3' };
    const okAdh =
      isAdhesionEligiblePanel(T, t0) &&
      ![E1, E2, E3].some((p) => isAdhesionEligiblePanel(p, t0)) &&
      ![T, E1, E2, E3].some((p) => isAdhesionEligiblePanel(p, c6)) &&
      [E1, E2, E3].every((p) => isAdhesionEligiblePanel(p, c12)) &&
      !isAdhesionEligiblePanel(T, c12);
    const okPer =
      [E1, E2, E3].every((p) => isPersozEligiblePanel(p)) &&
      !isPersozEligiblePanel(T);
    const strict = getActiveE1E2E3Panels([T, E1, E2, E3]);
    const okPop = strict.length === 3;
    record('REF-14', 'Populations PERSOZ/ADHÉSION/E1-E3 inchangées',
      okAdh && okPer && okPop, 'matrices conformes', `adh=${String(okAdh)}, per=${String(okPer)}, pop=${String(okPop)}`);
  }

  // --- REF-15 : RAW exhaustif non filtré ---
  {
    const trial = buildTrial();
    seedComputed(trial, 0, 'E1', 'ADHESION', adhRaw(5));
    seedComputed(trial, 12, 'T', 'PERSOZ', persozRaw());
    const rawCsv = exportRawDataToCsv(trial);
    const ok = rawCsv.includes('ADHESION') && rawCsv.includes('PERSOZ');
    record('REF-15', 'RAW exhaustif : interdits toujours traçables',
      ok, 'ADHESION + PERSOZ présents', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
