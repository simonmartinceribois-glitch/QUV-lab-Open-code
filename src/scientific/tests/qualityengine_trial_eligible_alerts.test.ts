/**
 * QUV-Lab — Suite de Tests FILTRAGE TRIAL qualityEngine (P2).
 *
 * assessTrialQuality() ne décompte que les alertes des acquisitions
 * admissibles (PERSOZ E1-E3, ADHÉSION selon matrice, autres familles
 * inchangées) : une interdite/historique ne dégrade jamais le global.
 * RAW jamais modifié (lecture seule).
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { assessTrialQuality } from '../qualityEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { MeasurementAlert } from '../../types/scientific';

export interface TrialEligibleAlertsTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-qet-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-QET-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['PERSOZ', 'ADHESION'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT QET-${trialSeq}`, orderIndex: 1,
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

function alert(severity: 'BLOCKING' | 'WARNING', familyId: string): MeasurementAlert {
  return { id: `al-${severity}`, severity, code: 'TEST', message: 'test', familyId };
}

function seed(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string, alerts: MeasurementAlert[] = []): void {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const record: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw: {} as any, computed: null, status: 'COMPLETE', alerts,
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = record;
}

function assess(trial: Trial) {
  return assessTrialQuality(trial, getDefaultScientificRuleSet());
}

export function runTrialEligibleAlertsTests(): {
  results: TrialEligibleAlertsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: TrialEligibleAlertsTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- TEST 01 : PERSOZ/T BLOCKING ignoré ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'T', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 01', 'PERSOZ/T BLOCKING ignoré (0 blocking, GOOD)',
      q.blockingAlertsCount === 0 && q.globalQuality === 'GOOD',
      'blocking=0, GOOD', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 02 : PERSOZ/E1 BLOCKING compté ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'E1', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 02', 'PERSOZ/E1 BLOCKING compté (1 blocking, INVALID)',
      q.blockingAlertsCount === 1 && q.globalQuality === 'INVALID',
      'blocking=1, INVALID', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 03 : PERSOZ E2/E3 admissibles ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'E2', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    seed(trial, 12, 'E3', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 03', 'PERSOZ E2+E3 BLOCKING comptés',
      q.blockingAlertsCount === 2 && q.globalQuality === 'INVALID',
      'blocking=2, INVALID', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 04 : ADHÉSION T0/T BLOCKING compté ---
  {
    const trial = buildTrial();
    seed(trial, 0, 'T', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const q = assess(trial);
    record('TEST 04', 'ADHÉSION T0/T BLOCKING compté',
      q.blockingAlertsCount === 1 && q.globalQuality === 'INVALID',
      'blocking=1, INVALID', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 05 : ADHÉSION T0/E1 BLOCKING ignoré ---
  {
    const trial = buildTrial();
    seed(trial, 0, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const q = assess(trial);
    record('TEST 05', 'ADHÉSION T0/E1 BLOCKING ignoré',
      q.blockingAlertsCount === 0 && q.globalQuality === 'GOOD',
      'blocking=0, GOOD', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 06 : ADHÉSION C12/E1 BLOCKING compté ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const q = assess(trial);
    record('TEST 06', 'ADHÉSION C12/E1 BLOCKING compté',
      q.blockingAlertsCount === 1 && q.globalQuality === 'INVALID',
      'blocking=1, INVALID', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 07 : ADHÉSION C12/T BLOCKING ignoré ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'T', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const q = assess(trial);
    record('TEST 07', 'ADHÉSION C12/T BLOCKING ignoré',
      q.blockingAlertsCount === 0 && q.globalQuality === 'GOOD',
      'blocking=0, GOOD', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 08 : ADHÉSION C6 BLOCKING ignoré ---
  {
    const trial = buildTrial();
    seed(trial, 6, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const q = assess(trial);
    record('TEST 08', 'ADHÉSION C6 BLOCKING ignoré (aucune cible)',
      q.blockingAlertsCount === 0 && q.globalQuality === 'GOOD',
      'blocking=0, GOOD', `blocking=${q.blockingAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 09 : WARNING non admissible ignoré ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'T', 'PERSOZ', [alert('WARNING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 09', 'WARNING non admissible ignoré (0 warning, GOOD)',
      q.warningAlertsCount === 0 && q.globalQuality === 'GOOD',
      'warning=0, GOOD', `warning=${q.warningAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 10 : WARNING admissible conservé ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'E1', 'PERSOZ', [alert('WARNING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 10', 'WARNING admissible conservé (1 warning, WARNING)',
      q.warningAlertsCount === 1 && q.globalQuality === 'WARNING',
      'warning=1, WARNING', `warning=${q.warningAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 11 : mélange (T BLOCKING ignoré, E1 WARNING conservé) ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'T', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    seed(trial, 12, 'E1', 'PERSOZ', [alert('WARNING', 'PERSOZ')]);
    const q = assess(trial);
    record('TEST 11', 'Mixte : T ignoré, E1 conservé (0 blocking, 1 warning)',
      q.blockingAlertsCount === 0 && q.warningAlertsCount === 1 && q.globalQuality === 'WARNING',
      'blocking=0, warning=1, WARNING',
      `blocking=${q.blockingAlertsCount}, warning=${q.warningAlertsCount}, ${q.globalQuality}`);
  }

  // --- TEST 12 : RAW inchangé ---
  {
    const trial = buildTrial();
    seed(trial, 12, 'T', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    seed(trial, 12, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const before = JSON.stringify(trial.acquisitions);
    assess(trial);
    const after = JSON.stringify(trial.acquisitions);
    record('TEST 12', 'Filtrage sans mutation RAW (interdits conservés)',
      before === after && Object.keys(trial.acquisitions).length === 2,
      'identique, 2 acquisitions', `identique=${String(before === after)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
