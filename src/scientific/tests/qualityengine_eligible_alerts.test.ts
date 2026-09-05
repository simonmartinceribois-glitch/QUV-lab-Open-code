/**
 * QUV-Lab — Suite de Tests ALERTES ÉLIGIBLES qualityEngine (P2).
 *
 * Seules les acquisitions admissibles (population canonique famille + jalon)
 * influencent les statuts via leurs alertes : une acquisition interdite ou
 * historique (PERSOZ/T, ADHÉSION hors matrice) ne dégrade jamais à elle seule
 * la famille ni le panneau attendus. RAW jamais modifié (évaluation pure).
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { assessStageQuality } from '../qualityEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { MeasurementAlert } from '../../types/scientific';

export interface EligibleAlertsTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(families: string[]): Trial {
  trialSeq += 1;
  const trialId = `trial-qea-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-QEA-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: families, familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: `LOT QEA-${trialSeq}`, orderIndex: 1,
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

function assess(trial: Trial, cycleIndex: number) {
  const ruleSet = getDefaultScientificRuleSet();
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  return assessStageQuality(stage.id, trial, ruleSet);
}

export function runEligibleAlertsTests(): {
  results: EligibleAlertsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: EligibleAlertsTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- QEA-01 : PERSOZ/T BLOCKING ignoré ---
  {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 0, sfx, 'PERSOZ'));
    seed(trial, 0, 'T', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    const a = assess(trial, 0);
    record('QEA-01', 'PERSOZ/T BLOCKING ignoré (famille GOOD, 3 complets)',
      a.familyAssessments['PERSOZ'] === 'GOOD' && a.panelsComplete === 3 && a.panelsInvalid === 0,
      'GOOD, complete=3, invalid=0',
      `${a.familyAssessments['PERSOZ']}, complete=${a.panelsComplete}, invalid=${a.panelsInvalid}`);
  }

  // --- QEA-02/03/04 : BLOCKING valide pris en compte ---
  (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((s) => seed(trial, 0, s, 'PERSOZ', s === sfx ? [alert('BLOCKING', 'PERSOZ')] : []));
    const a = assess(trial, 0);
    record(`QEA-0${2 + i}`, `PERSOZ/${sfx} BLOCKING valide → INVALID`,
      a.familyAssessments['PERSOZ'] === 'INVALID' && a.panelsInvalid === 1,
      'INVALID, invalid=1', `${a.familyAssessments['PERSOZ']}, invalid=${a.panelsInvalid}`);
  });

  // --- QEA-05 : ADHÉSION T0/T BLOCKING pris en compte ---
  {
    const trial = buildTrial(['ADHESION']);
    seed(trial, 0, 'T', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const a = assess(trial, 0);
    record('QEA-05', 'ADHÉSION T0/T BLOCKING → INVALID',
      a.familyAssessments['ADHESION'] === 'INVALID' && a.panelsInvalid === 1,
      'INVALID, invalid=1', `${a.familyAssessments['ADHESION']}, invalid=${a.panelsInvalid}`);
  }

  // --- QEA-06 : ADHÉSION T0/E1 BLOCKING ignoré ---
  {
    const trial = buildTrial(['ADHESION']);
    seed(trial, 0, 'T', 'ADHESION');
    seed(trial, 0, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const a = assess(trial, 0);
    record('QEA-06', 'ADHÉSION T0/E1 BLOCKING ignoré (GOOD, T complet)',
      a.familyAssessments['ADHESION'] === 'GOOD' && a.panelsComplete === 1 && a.panelsInvalid === 0,
      'GOOD, complete=1, invalid=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}, invalid=${a.panelsInvalid}`);
  }

  // --- QEA-07/08/09 : ADHÉSION C12 E BLOCKING pris en compte ---
  (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
    const trial = buildTrial(['ADHESION']);
    (['E1', 'E2', 'E3'] as const).forEach((s) => seed(trial, 12, s, 'ADHESION', s === sfx ? [alert('BLOCKING', 'ADHESION')] : []));
    const a = assess(trial, 12);
    record(`QEA-0${7 + i}`, `ADHÉSION C12/${sfx} BLOCKING → INVALID`,
      a.familyAssessments['ADHESION'] === 'INVALID',
      'INVALID', String(a.familyAssessments['ADHESION']));
  });

  // --- QEA-10 : ADHÉSION C12/T BLOCKING ignoré ---
  {
    const trial = buildTrial(['ADHESION']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 12, sfx, 'ADHESION'));
    seed(trial, 12, 'T', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const a = assess(trial, 12);
    record('QEA-10', 'ADHÉSION C12/T BLOCKING ignoré (GOOD, 3 complets)',
      a.familyAssessments['ADHESION'] === 'GOOD' && a.panelsComplete === 3 && a.panelsInvalid === 0,
      'GOOD, complete=3, invalid=0',
      `${a.familyAssessments['ADHESION']}, complete=${a.panelsComplete}, invalid=${a.panelsInvalid}`);
  }

  // --- QEA-11 : ADHÉSION C6 (population vide) sans influence ---
  {
    const trial = buildTrial(['ADHESION']);
    seed(trial, 6, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    seed(trial, 6, 'T', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const a = assess(trial, 6);
    record('QEA-11', 'ADHÉSION C6 : population vide, BLOCKING historiques sans influence',
      !('ADHESION' in a.familyAssessments) && a.panelsInvalid === 0 && a.globalStatus === 'GOOD',
      'pas de clé, invalid=0, GOOD',
      `clé=${String('ADHESION' in a.familyAssessments)}, invalid=${a.panelsInvalid}, global=${a.globalStatus}`);
  }

  // --- QEA-12 : WARNING non admissible ignoré ---
  {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seed(trial, 0, sfx, 'PERSOZ'));
    seed(trial, 0, 'T', 'PERSOZ', [alert('WARNING', 'PERSOZ')]);
    const a = assess(trial, 0);
    record('QEA-12', 'WARNING non admissible → aucun WARNING artificiel',
      a.familyAssessments['PERSOZ'] === 'GOOD' && a.panelsWithWarnings === 0,
      'GOOD, warnings=0', `${a.familyAssessments['PERSOZ']}, warnings=${a.panelsWithWarnings}`);
  }

  // --- QEA-13 : WARNING admissible conservé ---
  {
    const trial = buildTrial(['PERSOZ']);
    seed(trial, 0, 'E1', 'PERSOZ', [alert('WARNING', 'PERSOZ')]);
    seed(trial, 0, 'E2', 'PERSOZ');
    seed(trial, 0, 'E3', 'PERSOZ');
    const a = assess(trial, 0);
    record('QEA-13', 'WARNING admissible (E1) → WARNING conservé',
      a.familyAssessments['PERSOZ'] === 'WARNING',
      'WARNING', String(a.familyAssessments['PERSOZ']));
  }

  // --- QEA-14 : RAW inchangé par l'évaluation ---
  {
    const trial = buildTrial(['PERSOZ', 'ADHESION']);
    seed(trial, 0, 'T', 'PERSOZ', [alert('BLOCKING', 'PERSOZ')]);
    seed(trial, 0, 'E1', 'ADHESION', [alert('BLOCKING', 'ADHESION')]);
    const before = JSON.stringify(trial.acquisitions);
    assess(trial, 0);
    const after = JSON.stringify(trial.acquisitions);
    record('QEA-14', 'RAW inchangé par assessStageQuality (interdits conservés)',
      before === after && Object.keys(trial.acquisitions).length === 2,
      'identique, 2 acquisitions', `identique=${String(before === after)}`);
  }

  // --- QEA-15 : autres familles inchangées (COLOR/T BLOCKING compte) ---
  {
    const trial = buildTrial(['COLOR']);
    (['T', 'E1', 'E2', 'E3'] as const).forEach((sfx) =>
      seed(trial, 0, sfx, 'COLOR', sfx === 'T' ? [alert('BLOCKING', 'COLOR')] : []));
    const a = assess(trial, 0);
    record('QEA-15', 'COLOR : comportement historique conservé (T BLOCKING → INVALID)',
      a.familyAssessments['COLOR'] === 'INVALID' && a.panelsInvalid === 1,
      'INVALID, invalid=1', `${a.familyAssessments['COLOR']}, invalid=${a.panelsInvalid}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
