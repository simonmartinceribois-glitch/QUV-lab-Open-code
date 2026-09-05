/**
 * QUV-Lab — Suite de Tests POPULATION PERSOZ dans qualityEngine (P1).
 *
 * assessStageQuality() attend PERSOZ sur E1/E2/E3 à tous les jalons via
 * isPersozEligiblePanel : T n'est jamais compté comme mesure manquante,
 * les E manquants le sont, les T artificiels ne masquent rien.
 * COLOR/GLOSS conservent leur comportement historique (T attendu) ;
 * ADHÉSION conserve sa matrice (vérifiée en non-régression).
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { assessStageQuality } from '../qualityEngine';
import { getDefaultScientificRuleSet } from '../ruleSet';
import { isPersozEligiblePanel, isAdhesionEligiblePanel } from '../panelUtils';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';

export interface PersozQualityPopulationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(families: string[]): Trial {
  trialSeq += 1;
  const trialId = `trial-pq-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-PQ-${trialSeq}`, createdBy: 'TEST_OP' },
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
      id: batchId, trialId, reference: `LOT PQ-${trialSeq}`, orderIndex: 1,
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

function seedFam(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string): void {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const record: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw: {} as any, computed: null, status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = record;
}

function assess(trial: Trial, cycleIndex: number) {
  const ruleSet = getDefaultScientificRuleSet();
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  return assessStageQuality(stage.id, trial, ruleSet);
}

export function runPersozQualityPopulationTests(): {
  results: PersozQualityPopulationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: PersozQualityPopulationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- PERSOZ-Q-01 : T exclu, E complets → GOOD ---
  {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, 0, sfx, 'PERSOZ'));
    const a = assess(trial, 0);
    record('PERSOZ-Q-01', 'T exclu, E1/E2/E3 présents → PERSOZ complet',
      a.familyAssessments['PERSOZ'] === 'GOOD' && a.panelsComplete === 3 && a.panelsWithWarnings === 0,
      'GOOD, complete=3, warnings=0',
      `${a.familyAssessments['PERSOZ']}, complete=${a.panelsComplete}, warnings=${a.panelsWithWarnings}`);
  }

  // --- PERSOZ-Q-02 : E complets → GOOD ---
  {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, 12, sfx, 'PERSOZ'));
    const a = assess(trial, 12);
    record('PERSOZ-Q-02', 'E1/E2/E3 présents à C12 → GOOD',
      a.familyAssessments['PERSOZ'] === 'GOOD',
      'GOOD', String(a.familyAssessments['PERSOZ']));
  }

  // --- PERSOZ-Q-03/04/05 : E manquant → incomplet, T non compté ---
  ([['E1', '03'], ['E2', '04'], ['E3', '05']] as const).forEach(([missing, num]) => {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).filter((s) => s !== missing).forEach((sfx) => seedFam(trial, 0, sfx, 'PERSOZ'));
    const a = assess(trial, 0);
    record(`PERSOZ-Q-${num}`, `${missing} manquant (T absent) → incomplet, T non compté`,
      a.familyAssessments['PERSOZ'] !== 'GOOD' &&
        a.panelsComplete === 2 && a.panelsWithWarnings === 1,
      'non-GOOD, complete=2, warnings=1',
      `${a.familyAssessments['PERSOZ']}, complete=${a.panelsComplete}, warnings=${a.panelsWithWarnings}`);
  });

  // --- PERSOZ-Q-06 : T artificiel ne masque rien ---
  {
    const trial = buildTrial(['PERSOZ']);
    seedFam(trial, 0, 'T', 'PERSOZ');
    seedFam(trial, 0, 'E1', 'PERSOZ');
    seedFam(trial, 0, 'E2', 'PERSOZ');
    const a = assess(trial, 0);
    record('PERSOZ-Q-06', 'T artificiel + E3 manquant → toujours incomplet',
      a.familyAssessments['PERSOZ'] !== 'GOOD' && a.panelsComplete === 2,
      'non-GOOD, complete=2 (T ignoré)',
      `${a.familyAssessments['PERSOZ']}, complete=${a.panelsComplete}`);
  }

  // --- PERSOZ-Q-07 : tous les jalons E1/E2/E3 ---
  {
    let allGood = true;
    const detail: string[] = [];
    for (let cycle = 0; cycle <= 12; cycle++) {
      const trial = buildTrial(['PERSOZ']);
      (['E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, cycle, sfx, 'PERSOZ'));
      const a = assess(trial, cycle);
      const good = a.familyAssessments['PERSOZ'] === 'GOOD';
      if (!good) {
        allGood = false;
        detail.push(`C${cycle}=${a.familyAssessments['PERSOZ']}`);
      }
    }
    record('PERSOZ-Q-07', 'Population E1/E2/E3 sur T0..C12 (13 jalons)',
      allGood, 'GOOD aux 13 jalons', allGood ? '13/13 GOOD' : detail.join(', '));
  }

  // --- PERSOZ-Q-08 : non-régression ADHÉSION ---
  {
    const t0 = { cycleIndex: 0 };
    const c6 = { cycleIndex: 6 };
    const c12 = { cycleIndex: 12 };
    const T = { label: 'T', roleCode: 'T', role: 'WITNESS' };
    const E1 = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
    const ok =
      isAdhesionEligiblePanel(T, t0) &&
      !isAdhesionEligiblePanel(E1, t0) &&
      ![T, E1].some((p) => isAdhesionEligiblePanel(p, c6)) &&
      isAdhesionEligiblePanel(E1, c12) &&
      !isAdhesionEligiblePanel(T, c12);
    record('PERSOZ-Q-08', 'ADHÉSION : T0/T, C6 rien, C12/E (inchangé)',
      ok, 'matrice conforme', String(ok));
  }

  // --- PERSOZ-Q-09 : COLOR historique conservé (T attendu) ---
  {
    const trial = buildTrial(['COLOR']);
    (['T', 'E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, 0, sfx, 'COLOR'));
    const full = assess(trial, 0);
    const trial2 = buildTrial(['COLOR']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial2, 0, sfx, 'COLOR'));
    const noT = assess(trial2, 0);
    record('PERSOZ-Q-09', 'COLOR : T attendu (comportement historique conservé)',
      full.familyAssessments['COLOR'] === 'GOOD' && noT.familyAssessments['COLOR'] !== 'GOOD',
      'complet=GOOD, sans T=non-GOOD',
      `complet=${full.familyAssessments['COLOR']}, sansT=${noT.familyAssessments['COLOR']}`);
  }

  // --- PERSOZ-Q-10 : GLOSS historique conservé (T attendu) ---
  {
    const trial = buildTrial(['GLOSS']);
    (['T', 'E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, 0, sfx, 'GLOSS'));
    const a = assess(trial, 0);
    record('PERSOZ-Q-10', 'GLOSS : T attendu (comportement historique conservé)',
      a.familyAssessments['GLOSS'] === 'GOOD' && a.panelsComplete === 4,
      'GOOD, complete=4', `${a.familyAssessments['GLOSS']}, complete=${a.panelsComplete}`);
  }

  // --- Invariance : population qualityEngine === isPersozEligiblePanel ---
  {
    const trial = buildTrial(['PERSOZ']);
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => seedFam(trial, 0, sfx, 'PERSOZ'));
    const a = assess(trial, 0);
    const panels = [
      { suffix: 'T', eligible: isPersozEligiblePanel({ roleCode: 'T', role: 'WITNESS' }) },
      { suffix: 'E1', eligible: isPersozEligiblePanel({ roleCode: 'E1', role: 'EXPOSED_1' }) },
      { suffix: 'E2', eligible: isPersozEligiblePanel({ roleCode: 'E2', role: 'EXPOSED_2' }) },
      { suffix: 'E3', eligible: isPersozEligiblePanel({ roleCode: 'E3', role: 'EXPOSED_3' }) }
    ];
    const invariant =
      panels.find((p) => p.suffix === 'T')?.eligible === false &&
      panels.filter((p) => p.suffix !== 'T').every((p) => p.eligible === true) &&
      a.panelsComplete === 3 && a.panelsWithWarnings === 0;
    record('PERSOZ-Q-INV', 'Invariance : qualityEngine === isPersozEligiblePanel (T faux, E vrais)',
      invariant, 'T=false, E1-E3=true, complete=3',
      `invariant=${String(invariant)}, complete=${a.panelsComplete}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
