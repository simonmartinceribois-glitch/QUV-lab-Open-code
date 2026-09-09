/**
 * QUV-Lab — Suite de Tests INTÉGRITÉ STATISTIQUE PERSOZ & DURÉE RÉELLE.
 *
 * P0 : les variations Persoz sont moyennées uniquement sur les éprouvettes
 * à variation calculable (compteurs séparés) ; absence → null, jamais 0 ;
 * vrai 0 conservé ; témoin T exclu.
 * P1 : durée effective = actualExposureHours si présente (0 réel conservé),
 * sinon scheduledExposureHours (jamais `actual || scheduled`).
 */

import { compareSystemsAtStage } from '../analysis/MultiSystemComparator';
import { extractTemporalKinetics, getEffectiveExposureHours } from '../analysis/TrendAnalyzer';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';

export interface PersozIntegrityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

type PersozDatum = { mean: number; delta: number | null; rel: number | null };

function buildPersozTrial(
  trialId: string,
  data: Partial<Record<'T' | 'E1' | 'E2' | 'E3', PersozDatum | null>>
): Trial {
  const stageId = `${trialId}-st-c12`;
  const batchId = `${trialId}-batch-1`;
  const defs = [
    { label: 'T', role: 'WITNESS', roleCode: 'T' },
    { label: '1', role: 'EXPOSED_1', roleCode: 'E1' },
    { label: '2', role: 'EXPOSED_2', roleCode: 'E2' },
    { label: '3', role: 'EXPOSED_3', roleCode: 'E3' }
  ] as const;
  const keyOf: Record<string, 'T' | 'E1' | 'E2' | 'E3'> = { T: 'T', '1': 'E1', '2': 'E2', '3': 'E3' };
  const panels = defs.map((d, i) => ({
    id: `${trialId}-p-${d.roleCode}`, batchId, index: i + 1, label: d.label,
    role: d.role as 'WITNESS' | 'EXPOSED_1' | 'EXPOSED_2' | 'EXPOSED_3',
    roleCode: d.roleCode as 'T' | 'E1' | 'E2' | 'E3', status: 'ACTIVE' as const
  }));
  const acquisitions: Trial['acquisitions'] = {};
  for (const p of panels) {
    const datum = data[keyOf[p.label]];
    if (datum !== null && datum !== undefined) {
      acquisitions[`${stageId}__${p.id}__PERSOZ`] = {
        id: `${trialId}-a-${p.roleCode}`, trialId, stageId, batchId, panelId: p.id,
        familyId: 'PERSOZ', raw: {},
        computed: {
          meanDampingTime: datum.mean,
          deltaDampingTime: datum.delta,
          relativeHardnessVariationPercent: datum.rel
        },
        status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
      } as unknown as Trial['acquisitions'][string];
    }
  }
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-PI-${trialId}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['PERSOZ'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [{
      id: stageId, trialId, cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE',
      name: 'C12', scheduledExposureHours: 2016, status: 'VALIDATED'
    }],
    batches: [{ id: batchId, trialId, reference: `LOT ${trialId}`, orderIndex: 1, panels }],
    acquisitions, auditTrail: [], mediaReferences: []
  } as Trial;
}

function buildComparatorTrial(trialId: string, actualHours: number | undefined): Trial {
  const stageId = `${trialId}-st-x`;
  const mkBatch = (n: number) => {
    const batchId = `${trialId}-batch-${n}`;
    const panelId = `${trialId}-p-${n}-E1`;
    return {
      id: batchId, trialId, reference: `LOT ${trialId}-${n}`, orderIndex: n,
      panels: [{
        id: panelId, batchId, index: 1, label: '1',
        role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const
      }]
    };
  };
  const b1 = mkBatch(1);
  const b2 = mkBatch(2);
  const acquisitions: Trial['acquisitions'] = {};
  for (const [b, n] of [[b1, 1], [b2, 2]] as const) {
    const panelId = `${trialId}-p-${n}-E1`;
    const stageId2 = `${trialId}-st-x`;
    const batchId = `${trialId}-batch-${n}`;
    acquisitions[`${stageId2}__${panelId}__COLOR`] = {
      id: `${trialId}-a-${n}-c`, trialId, stageId: stageId2, batchId, panelId,
      familyId: 'COLOR', raw: {},
      computed: { deltaE: n === 1 ? 2 : 8, deltaL: 0, deltaA: 0, deltaB: 0 },
      status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
    acquisitions[`${stageId2}__${panelId}__GLOSS`] = {
      id: `${trialId}-a-${n}-g`, trialId, stageId: stageId2, batchId, panelId,
      familyId: 'GLOSS', raw: {},
      computed: { meanGloss: 60, deltaGloss: -5, retentionRatePercent: n === 1 ? 80 : 60 },
      status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
  }
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-DC-${trialId}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR', 'GLOSS'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [{
      id: stageId, trialId, cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE',
      name: 'STAGE-X', scheduledExposureHours: 2016, actualExposureHours: actualHours,
      status: 'VALIDATED'
    }],
    batches: [b1, b2],
    acquisitions, auditTrail: [], mediaReferences: []
  } as Trial;
}
export function runPersozIntegrityTests(): {
  results: PersozIntegrityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: PersozIntegrityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const ruleSet = getDefaultScientificRuleSet();

  // --- PERSOZ-MISSING-01 : (+10, missing, -5) → +2.5 (jamais +1.67) ---
  {
    const t = buildPersozTrial('pi-01', {
      E1: { mean: 100, delta: 8, rel: 10 },
      E2: null,
      E3: { mean: 100, delta: -4, rel: -5 }
    });
    const item = compareSystemsAtStage(t, 'pi-01-st-c12', ruleSet).items[0];
    const got = item.persoz?.persozDeltaPercent ?? null;
    const ok = got === 2.5;
    record('PERSOZ-MISSING-01', 'Manquant exclu du dénominateur : (+10-5)/2=+2.5',
      ok, '+2.5 (pas +1.67)', String(got));
  }

  // --- PERSOZ-MISSING-02 : vrai 0 conservé (0, +10, missing) → +5 ---
  {
    const t = buildPersozTrial('pi-02', {
      E1: { mean: 100, delta: 0, rel: 0 },
      E2: { mean: 100, delta: 8, rel: 10 },
      E3: null
    });
    const item = compareSystemsAtStage(t, 'pi-02-st-c12', ruleSet).items[0];
    const got = item.persoz?.persozDeltaPercent ?? null;
    const ok = got === 5;
    record('PERSOZ-MISSING-02', 'Zéro réel conservé : (0+10)/2=+5',
      ok, '+5', String(got));
  }

  // --- PERSOZ-MISSING-03 : tout manquant → null, jamais 0 ---
  {
    const t = buildPersozTrial('pi-03', { E1: null, E2: null, E3: null });
    const item = compareSystemsAtStage(t, 'pi-03-st-c12', ruleSet).items[0];
    const gotP = item.persoz?.persozDeltaPercent ?? null;
    const gotD = item.persoz?.deltaSeconds ?? null;
    const t2 = buildPersozTrial('pi-03b', {
      E1: { mean: 100, delta: null, rel: null },
      E2: { mean: 110, delta: null, rel: null },
      E3: { mean: 105, delta: null, rel: null }
    });
    const item2 = compareSystemsAtStage(t2, 'pi-03b-st-c12', ruleSet).items[0];
    const gotP2 = item2.persoz?.persozDeltaPercent ?? null;
    const gotD2 = item2.persoz?.deltaSeconds ?? null;
    const ok = gotP === null && gotD === null && gotP2 === null && gotD2 === null;
    record('PERSOZ-MISSING-03', 'Aucune variation calculable → null (jamais 0)',
      ok, 'null ×4', `${String(gotP)},${String(gotD)},${String(gotP2)},${String(gotD2)}`);
  }

  // --- PERSOZ-MISSING-04 : témoin +999 % exclu ---
  {
    const t = buildPersozTrial('pi-04', {
      T: { mean: 100, delta: 50, rel: 999 },
      E1: { mean: 100, delta: 1, rel: 10 },
      E2: { mean: 100, delta: 2, rel: 20 },
      E3: { mean: 100, delta: 3, rel: 30 }
    });
    const item = compareSystemsAtStage(t, 'pi-04-st-c12', ruleSet).items[0];
    const got = item.persoz?.persozDeltaPercent ?? null;
    const ok = got === 20;
    record('PERSOZ-MISSING-04', 'Témoin +999 % exclu : (10+20+30)/3=20',
      ok, '20', String(got));
  }

  // --- PERSOZ-DURATION-01 : actual prioritaire ---
  {
    const got = getEffectiveExposureHours({ scheduledExposureHours: 2016, actualExposureHours: 2024 });
    const ok = got === 2024;
    record('PERSOZ-DURATION-01', 'actual=2024 prioritaire sur scheduled=2016',
      ok, '2024', String(got));
  }

  // --- PERSOZ-DURATION-02 : actual 0 conservé ---
  {
    const got = getEffectiveExposureHours({ scheduledExposureHours: 2016, actualExposureHours: 0 });
    const ok = got === 0;
    record('PERSOZ-DURATION-02', 'actual=0 conservé (pas de retour à 2016)',
      ok, '0', String(got));
  }

  // --- PERSOZ-DURATION-03 : fallback scheduled si absent ---
  {
    const got = getEffectiveExposureHours({ scheduledExposureHours: 2016, actualExposureHours: undefined });
    const ok = got === 2016;
    record('PERSOZ-DURATION-03', 'actual absent → scheduled 2016',
      ok, '2016', String(got));
  }

  // --- PERSOZ-DURATION-04 : axe cinétique utilise la durée effective ---
  {
    const t = buildPersozTrial('pi-dur', {
      E1: { mean: 100, delta: 5, rel: 5 },
      E2: null,
      E3: null
    });
    const st = t.stages[0];
    st.actualExposureHours = 2024;
    const kinetics = extractTemporalKinetics(t, t.batches[0].id);
    const point = kinetics.find((k) => k.cycleIndex === 12);
    const ok = point?.exposureHours === 2024;
    record('PERSOZ-DURATION-04', 'Axe cinétique : point C12 à 2024 h effectifs',
      ok, '2024', String(point?.exposureHours));
  }

  // --- DURATION-COMPARATOR-01 : 2024 effectif partout (résultat + textes) ---
  {
    const t = buildComparatorTrial('dc-01', 2024);
    const comp = compareSystemsAtStage(t, 'dc-01-st-x', ruleSet);
    const colorStmt = comp.rankings.find((r) => r.familyId === 'COLOR')?.factualStatement ?? '';
    const glossStmt = comp.rankings.find((r) => r.familyId === 'GLOSS')?.factualStatement ?? '';
    const ok = comp.exposureHours === 2024 &&
      colorStmt.includes('2024 h') && !colorStmt.includes('2016 h') &&
      glossStmt.includes('2024 h') && !glossStmt.includes('2016 h');
    record('DURATION-COMPARATOR-01', 'actual=2024 : résultat + COLOR + GLOSS en 2024 h',
      ok, '2024 partout, sans 2016', `exp=${String(comp.exposureHours)}`);
  }

  // --- DURATION-COMPARATOR-02 : actual 0 conservé partout ---
  {
    const t = buildComparatorTrial('dc-02', 0);
    const comp = compareSystemsAtStage(t, 'dc-02-st-x', ruleSet);
    const colorStmt = comp.rankings.find((r) => r.familyId === 'COLOR')?.factualStatement ?? '';
    const glossStmt = comp.rankings.find((r) => r.familyId === 'GLOSS')?.factualStatement ?? '';
    const ok = comp.exposureHours === 0 &&
      colorStmt.includes('à 0 h') && !colorStmt.includes('2016 h') &&
      glossStmt.includes('à 0 h') && !glossStmt.includes('2016 h');
    record('DURATION-COMPARATOR-02', 'actual=0 : 0 h partout, aucun fallback 2016',
      ok, '0 h partout', `exp=${String(comp.exposureHours)}`);
  }

  // --- DURATION-COMPARATOR-03 : fallback prévu 2016 h ---
  {
    const t = buildComparatorTrial('dc-03', undefined);
    const comp = compareSystemsAtStage(t, 'dc-03-st-x', ruleSet);
    const colorStmt = comp.rankings.find((r) => r.familyId === 'COLOR')?.factualStatement ?? '';
    const glossStmt = comp.rankings.find((r) => r.familyId === 'GLOSS')?.factualStatement ?? '';
    const ok = comp.exposureHours === 2016 &&
      colorStmt.includes('2016 h') && glossStmt.includes('2016 h');
    record('DURATION-COMPARATOR-03', 'actual absent : 2016 h prévu partout',
      ok, '2016 h partout', `exp=${String(comp.exposureHours)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
