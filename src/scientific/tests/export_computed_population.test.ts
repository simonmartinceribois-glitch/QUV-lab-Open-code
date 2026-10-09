/**
 * QUV-Lab — Suite de Tests VERROUILLAGE POPULATION COMPUTED CSV (P1).
 *
 * exportReportToCsv() (section COMPUTED) ne restitue que les populations
 * canoniques via isComputedExportAdmissible : PERSOZ E1-E3, ADHESION T0/T et
 * C12/E1-E3, COLOR/GLOSS E1-E3, OBSERVATIONS inchangées.
 * exportRawDataToCsv() reste exhaustif (aucune donnée supprimée).
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import {
  exportReportToCsv,
  exportRawDataToCsv,
  isComputedExportAdmissible
} from '../../services/reportGenerator';
import { isPersozEligiblePanel, isAdhesionEligiblePanel, isExposedE1E2E3Panel } from '../panelUtils';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { ScientificReport } from '../../types/scientific';

export interface ExportComputedPopulationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function computedOk(): any {
  return {
    qualityAssessment: { status: 'GOOD' },
    computation: { calculationVersion: 't', calculatedAt: '2026-09-05T00:00:00Z' }
  };
}

function rawFor(familyId: string): any {
  if (familyId === 'PERSOZ') return { readings: [{ pointIndex: 1, dampingTimeSeconds: 85 }] };
  if (familyId === 'ADHESION') {
    return {
      measurements: [{ measurementIndex: 1, adhesionClass: 2 }],
      gridSpacingMm: 2,
      measurementDateTime: '2026-10-24T00:00:00Z',
      normReference: 'NF EN ISO 2409:2020'
    };
  }
  if (familyId === 'COLOR') return { readings: [{ pointIndex: 1, L: 60, a: 2, b: 10 }] };
  if (familyId === 'GLOSS') {
    return { series: [{ seriesIndex: 1, orientation: 'x', readings: [{ pointIndex: 1, value: 45 }] }] };
  }
  return { observations: [{ category: 'X', rating: 0, status: 'CONFORME', comment: '' }] };
}

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-csv-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-CSV-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION', 'OBSERVATIONS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT CSV-${trialSeq}`, orderIndex: 1,
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

function seed(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string): void {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const record: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw: rawFor(familyId), computed: computedOk(), status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = record;
}

function minimalReport(trialId: string): ScientificReport {
  return {
    id: 'rep-csv', metadata: {
      reportId: 'rep-csv', trialId, generatedAt: '2026-09-05T00:00:00Z', generatedBy: 'TEST_OP',
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

function computedLines(trial: Trial): string[] {
  const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
  // Section par-panneau uniquement (avant la section inter-panneaux COLOR).
  const head = csv.split('=== COULEUR')[0];
  return head.split('\n');
}

function hasComputed(lines: string[], panelLabel: string, familyId: string, hours?: number): boolean {
  return lines.some((l) =>
    l.includes(`;"${panelLabel}";`) && l.includes(`;${familyId};`) &&
    (hours === undefined || l.includes(`";${hours};`)));
}

export function runExportComputedPopulationTests(): {
  results: ExportComputedPopulationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ExportComputedPopulationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const trial = buildTrial();
  // Scénario mixte :Forbidden + valides sur tous les jalons utiles.
  seed(trial, 12, 'T', 'PERSOZ');
  (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 12, sfx, 'PERSOZ'));
  seed(trial, 0, 'T', 'ADHESION');
  seed(trial, 0, 'E1', 'ADHESION');
  (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 12, sfx, 'ADHESION'));
  seed(trial, 12, 'T', 'ADHESION');
  seed(trial, 5, 'E1', 'ADHESION');
  seed(trial, 12, 'T', 'COLOR');
  (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 12, sfx, 'COLOR'));
  seed(trial, 12, 'T', 'GLOSS');
  (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 12, sfx, 'GLOSS'));
  seed(trial, 12, 'T', 'OBSERVATIONS');
  seed(trial, 12, 'E1', 'OBSERVATIONS');

  const lines = computedLines(trial);

  // --- CSV-POP-01 : PERSOZ/T absent ---
  {
    const ok = !hasComputed(lines, 'T', 'PERSOZ');
    record('CSV-POP-01', 'PERSOZ/T absent du COMPUTED', ok, 'absent', ok ? 'absent' : 'PRÉSENT (fuite)');
  }

  // --- CSV-POP-02 : PERSOZ E1/E2/E3 présents ---
  {
    const ok = (['1', '2', '3'] as const).every((label) => hasComputed(lines, label, 'PERSOZ'));
    record('CSV-POP-02', 'PERSOZ E1/E2/E3 exportés', ok, '3 lignes', String(ok));
  }

  // --- CSV-POP-03/04 : ADHÉSION T0 ---
  {
    const t0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const okT = lines.some((l) => l.startsWith(`"${t0.name}"`) && l.includes(';"T";') && l.includes(';ADHESION;'));
    const okE = !lines.some((l) => l.startsWith(`"${t0.name}"`) && l.includes(';"1";') && l.includes(';ADHESION;'));
    record('CSV-POP-03', 'ADHÉSION T0/T exportée', okT, 'présente', String(okT));
    record('CSV-POP-04', 'ADHÉSION T0/E1 absente', okE, 'absente', okE ? 'absente' : 'PRÉSENTE (fuite)');
  }

  // --- CSV-POP-05/06 : ADHÉSION C12 ---
  {
    const c12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const rows = lines.filter((l) => l.startsWith(`"${c12.name}"`) && l.includes(';ADHESION;'));
    const okE = (['1', '2', '3'] as const).every((label) => rows.some((l) => l.includes(`;"${label}";`)));
    const okT = !rows.some((l) => l.includes(';"T";'));
    record('CSV-POP-05', 'ADHÉSION C12/E1-E3 exportées', okE, '3 lignes', String(okE));
    record('CSV-POP-06', 'ADHÉSION C12/T absente', okT, 'absente', okT ? 'absente' : 'PRÉSENTE (fuite)');
  }

  // --- CSV-POP-07 : ADHÉSION C5 absente ---
  {
    const c5 = trial.stages.find((s) => s.cycleIndex === 5)!;
    const ok = !lines.some((l) => l.startsWith(`"${c5.name}"`) && l.includes(';ADHESION;'));
    record('CSV-POP-07', 'ADHÉSION C1-C11 absente (C5 testé)', ok, 'absente', ok ? 'absente' : 'PRÉSENTE (fuite)');
  }

  // --- CSV-POP-08/09 : COLOR ---
  {
    const okT = !hasComputed(lines, 'T', 'COLOR');
    const okE = (['1', '2', '3'] as const).every((label) => hasComputed(lines, label, 'COLOR'));
    record('CSV-POP-08', 'COLOR/T absent du COMPUTED', okT, 'absent', okT ? 'absent' : 'PRÉSENT (fuite)');
    record('CSV-POP-09', 'COLOR E1/E2/E3 exportés', okE, '3 lignes', String(okE));
  }

  // --- CSV-POP-10/11 : GLOSS ---
  {
    const okT = !hasComputed(lines, 'T', 'GLOSS');
    const okE = (['1', '2', '3'] as const).every((label) => hasComputed(lines, label, 'GLOSS'));
    record('CSV-POP-10', 'GLOSS/T absent', okT, 'absent', okT ? 'absent' : 'PRÉSENT (fuite)');
    record('CSV-POP-11', 'GLOSS E1/E2/E3 exportés', okE, '3 lignes', String(okE));
  }

  // --- CSV-POP-12 : RAW exhaustif ---
  {
    const raw = exportRawDataToCsv(trial);
    const ok =
      raw.includes('PERSOZ') && raw.includes('ADHESION') &&
      raw.split('\n').filter((l) => l.includes(';"T";') && l.includes(';PERSOZ;')).length === 1 &&
      raw.split('\n').filter((l) => l.includes(';"T";') && l.includes(';ADHESION;')).length === 2;
    record('CSV-POP-12', 'RAW exhaustif : interdits toujours traçables',
      ok, 'PERSOZ/T + 2 ADHESION/T présents', String(ok));
  }

  // --- CSV-POP-13 : section COLOR inter-panneaux E-only ---
  {
    const csv = exportReportToCsv(trial, minimalReport(trial.id), getDefaultScientificRuleSet());
    const section = csv.split('=== COULEUR')[1] || '';
    // E : L 60/63/66 → meanL 63.000 ; T (L=200 absent de la section).
    const trial2 = buildTrial();
    (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
      const stage = trial2.stages.find((s) => s.cycleIndex === 12)!;
      const rec: PanelAcquisitionRecord = {
        id: `acq-${sfx}`, trialId: trial2.id, stageId: stage.id, batchId: trial2.batches[0].id,
        panelId: `${trial2.id}-p-${sfx}`, familyId: 'COLOR',
        raw: { readings: [{ pointIndex: 1, L: [60, 63, 66][i], a: 2, b: 10 }] },
        computed: {
          pointsCount: 1, validCount: 1,
          meanL: [60, 63, 66][i], meanA: 2, meanB: 10,
          qualityAssessment: { status: 'GOOD' }, computation: { calculationVersion: 't', calculatedAt: 'x' }
        } as any,
        status: 'COMPLETE', alerts: [],
        trace: { createdBy: 'T', createdAt: 'x', source: 'MANUAL_KEYPAD' }, mediaIds: []
      };
      trial2.acquisitions[`${stage.id}__${trial2.id}-p-${sfx}__COLOR`] = rec;
    });
    const csv2 = exportReportToCsv(trial2, minimalReport(trial2.id), getDefaultScientificRuleSet());
    const row = csv2.split('\n').find((l) => l.includes('COLOR_L_moy') === false && l.includes(';63.000;'));
    void section;
    record('CSV-POP-13', 'Section COLOR : E1-E3 seuls (meanL=63.000)',
      row !== undefined, 'ligne 63.000 présente', row ? row.slice(0, 90) : 'absente');
  }

  // --- CSV-POP-14 : OBSERVATIONS inchangées ---
  {
    const okT = hasComputed(lines, 'T', 'OBSERVATIONS');
    const okE = hasComputed(lines, '1', 'OBSERVATIONS');
    record('CSV-POP-14', 'OBSERVATIONS : T et E1 toujours restitués',
      okT && okE, 'T + E1 présents', `T=${String(okT)}, E1=${String(okE)}`);
  }

  // --- CSV-POP-15 : invariance des prédicats ---
  {
    const t0 = { cycleIndex: 0 };
    const c5 = { cycleIndex: 5 };
    const c12 = { cycleIndex: 12 };
    const T = trial.batches[0].panels[0];
    const E1 = trial.batches[0].panels[1];
    const ok =
      !isComputedExportAdmissible('PERSOZ', T, t0 as any) &&
      isComputedExportAdmissible('PERSOZ', E1, t0 as any) &&
      isComputedExportAdmissible('ADHESION', T, t0 as any) &&
      !isComputedExportAdmissible('ADHESION', E1, t0 as any) &&
      !isComputedExportAdmissible('ADHESION', T, c12 as any) &&
      isComputedExportAdmissible('ADHESION', E1, c12 as any) &&
      !isComputedExportAdmissible('ADHESION', E1, c5 as any) &&
      !isComputedExportAdmissible('COLOR', T, c12 as any) &&
      isComputedExportAdmissible('COLOR', E1, c12 as any) &&
      !isComputedExportAdmissible('GLOSS', T, c12 as any) &&
      isComputedExportAdmissible('GLOSS', E1, c12 as any) &&
      isComputedExportAdmissible('OBSERVATIONS', T, c12 as any) &&
      isPersozEligiblePanel(E1) && isExposedE1E2E3Panel(E1);
    record('CSV-POP-15', 'Invariance : export = prédicats existants, sans règle parallèle',
      ok, 'matrice 13 cas conforme', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
