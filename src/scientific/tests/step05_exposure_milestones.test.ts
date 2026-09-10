/**
 * QUV-Lab — Suite de Tests JALONS D'EXPOSITION DÉTERMINISTES (Step 05).
 *
 * Règle scientifique : le cycle QUV détermine le jalon, l'opérateur ne saisit
 * jamais la durée. scheduledExposureHours === cycleIndex × 168 pour chaque
 * jalon standard. Aucune valeur manuelle (335.8 h interdite), traçabilité
 * horodatée (measuredAt/scheduledAt) préservée, plan de mesurage intact.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { buildScientificReport } from '../../services/reportGenerator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import { getEffectiveExposureHours } from '../analysis/TrendAnalyzer';
import type { Trial } from '../../types/trial';

export interface Step05MilestoneTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const byCycle = (stages: Trial['stages'], cycle: number) =>
  stages.find((s) => s.cycleIndex === cycle)!;

function buildMinimalTrial(): Trial {
  const trialId = 'trial-step05';
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: 'QUV-STEP05', createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{
      id: batchId, trialId, reference: 'LOT STEP05', orderIndex: 1,
      panels: [
        { id: `${trialId}-p-E1`, batchId, index: 1, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  } as Trial;
}

export function runStep05MilestoneTests(): {
  results: Step05MilestoneTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Step05MilestoneTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const stages = generateStandardExposureStages('trial-step05-ref');

  // --- STEP05-HOURS-01 : T0 ---
  {
    const t0 = byCycle(stages, 0);
    const ok = t0.scheduledExposureHours === 0;
    record('STEP05-HOURS-01', 'T0 : cycleIndex 0 → 0 h',
      ok, '0', String(t0.scheduledExposureHours));
  }

  // --- STEP05-HOURS-02 : C1 ---
  {
    const c1 = byCycle(stages, 1);
    const ok = c1.scheduledExposureHours === 168;
    record('STEP05-HOURS-02', 'C1 : cycleIndex 1 → 168 h',
      ok, '168', String(c1.scheduledExposureHours));
  }

  // --- STEP05-HOURS-03 : C2 (anti-335.8) ---
  {
    const c2 = byCycle(stages, 2);
    const ok = c2.scheduledExposureHours === 336 &&
      (c2.scheduledExposureHours as number) !== 335.8 &&
      c2.actualExposureHours === undefined;
    record('STEP05-HOURS-03', 'C2 : 336 h exact, jamais 335.8, sans valeur manuelle',
      ok, '336, ≠335.8, actual undefined',
      `${String(c2.scheduledExposureHours)}, actual=${String(c2.actualExposureHours)}`);
  }

  // --- STEP05-HOURS-04 : C3–C11 ---
  {
    const bad: number[] = [];
    for (let i = 3; i <= 11; i++) {
      if (byCycle(stages, i).scheduledExposureHours !== i * 168) bad.push(i);
    }
    const ok = bad.length === 0;
    record('STEP05-HOURS-04', 'C3–C11 : cycleIndex × 168 exact',
      ok, 'aucun écart', bad.length === 0 ? 'OK' : `écarts: ${bad.join(',')}`);
  }

  // --- STEP05-HOURS-05 : C12 ---
  {
    const c12 = byCycle(stages, 12);
    const ok = c12.scheduledExposureHours === 2016;
    record('STEP05-HOURS-05', 'C12 : cycleIndex 12 → 2016 h',
      ok, '2016', String(c12.scheduledExposureHours));
  }

  // --- STEP05-HOURS-06 : invariant global (plan complet + restreint) ---
  {
    const full = generateStandardExposureStages('trial-step05-full');
    const okFull = full.length === 13 && full.every((s) => s.scheduledExposureHours === s.cycleIndex * 168);
    const restricted = generateStandardExposureStages('trial-step05-restr', [3, 9]);
    const okRestr = restricted.every((s) => s.scheduledExposureHours === s.cycleIndex * 168);
    const ok = okFull && okRestr;
    record('STEP05-HOURS-06', 'Invariant cycleIndex × 168 (complet + restreint)',
      ok, '13 jalons + restreint OK', String(ok));
  }

  // --- STEP05-HOURS-07 : aucune valeur manuelle émise ---
  {
    const ok = stages.every((s) => s.actualExposureHours === undefined);
    record('STEP05-HOURS-07', "Aucun actualExposureHours généré (rien à 'fixer')",
      ok, 'tous undefined', String(ok));
  }

  // --- STEP05-HOURS-08 : traçabilité horodatée préservée ---
  {
    const t0 = byCycle(stages, 0);
    const c1 = byCycle(stages, 1);
    const ok = typeof t0.measuredAt === 'string' && typeof t0.scheduledAt === 'string' &&
      typeof c1.measuredAt === 'string' && typeof c1.scheduledAt === 'string';
    record('STEP05-HOURS-08', 'measuredAt/scheduledAt présents (traçabilité, pas durée)',
      ok, 'timestamps présents', String(ok));
  }

  // --- STEP05-HOURS-09 : legacy 335.8 ne supplante jamais le jalon ---
  {
    const trial = buildMinimalTrial();
    const c2 = trial.stages.find((s) => s.cycleIndex === 2)!;
    c2.actualExposureHours = 335.8;
    const report = buildScientificReport(trial, getDefaultScientificRuleSet(), { operatorId: 'TEST_OP' });
    const text = report.sections.exposureSchedule;
    const ok = text.includes("Jalon d'exposition : 336 h") && !text.includes('335.8');
    record('STEP05-HOURS-09', 'Legacy 335.8 ignoré : rapport affiche le jalon 336 h',
      ok, '336 h, sans 335.8', String(ok));
  }

  // --- STEP05-HOURS-10 : INACTIVE = cycle physique conservé, hors plan mesure ---
  {
    const restricted = generateStandardExposureStages('trial-step05-inact', [3, 9]);
    const c1 = restricted.find((s) => s.cycleIndex === 1)!;
    const c2 = restricted.find((s) => s.cycleIndex === 2)!;
    const t0 = restricted.find((s) => s.cycleIndex === 0)!;
    const c12 = restricted.find((s) => s.cycleIndex === 12)!;
    const ok = c1.status === 'INACTIVE' && c1.scheduledExposureHours === 168 &&
      c2.status === 'INACTIVE' && c2.scheduledExposureHours === 336 &&
      t0.status !== 'INACTIVE' && c12.status !== 'INACTIVE';
    record('STEP05-HOURS-10', 'INACTIVE : cycle physique intact, T0/C12 jamais exclus',
      ok, 'INACTIVE+168/336, T0/C12 actifs', String(ok));
  }

  // --- STEP05-HOURS-11 : règle verrouillée via la durée scientifique exposée ---
  {
    const t0 = byCycle(stages, 0);
    const c1 = byCycle(stages, 1);
    const c12 = byCycle(stages, 12);
    const ok = getEffectiveExposureHours(t0) === 0 &&
      getEffectiveExposureHours(c1) === 168 &&
      getEffectiveExposureHours(c12) === 2016;
    record('STEP05-HOURS-11', 'Durée scientifique : T0=0 h (0 valide, jamais null), C1=168 h, C12=2016 h',
      ok, '0 / 168 / 2016', `${String(getEffectiveExposureHours(t0))} / ${String(getEffectiveExposureHours(c1))} / ${String(getEffectiveExposureHours(c12))}`);
  }

  // --- STEP05-HOURS-12 : durée machine ne substitue jamais la durée scientifique ---
  {
    const c1 = byCycle(stages, 1);
    c1.actualExposureHours = 2024;
    const ok = getEffectiveExposureHours(c1) === 168;
    record('STEP05-HOURS-12', 'Durée machine 2024 tracée à part : durée scientifique C1 = 168 h',
      ok, '168', String(getEffectiveExposureHours(c1)));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
