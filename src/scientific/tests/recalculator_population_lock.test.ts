/**
 * QUV-Lab — Suite de Tests VERROU POPULATION recalculator (P1).
 *
 * Une acquisition PERSOZ/ADHÉSION non éligible (matrice métier) ne produit
 * AUCUN computed exploitable : aucun appel moteur, aucune référence
 * (referenceRaw/StageId/PanelId/AcquisitionId/rule), statut EMPTY.
 * Les admissibles calculent normalement avec leur référence canonique.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial, PanelAcquisitionRecord } from '../../types/trial';
import type { ReferenceTrace } from '../../types/scientific';

export interface RecalculatorPopulationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-rpl-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-RPL-${trialSeq}`, createdBy: 'TEST_OP' },
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
      id: batchId, trialId, reference: `LOT RPL-${trialSeq}`, orderIndex: 1,
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

function recalc(trial: Trial, cycleIndex: number, panelSuffix: string, familyId: string, raw: unknown): PanelAcquisitionRecord {
  const stage = trial.stages.find((s) => s.cycleIndex === cycleIndex)!;
  const rec: PanelAcquisitionRecord = {
    id: `acq-${stage.id}-${panelSuffix}-${familyId}`,
    trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId: `${trial.id}-p-${panelSuffix}`, familyId,
    raw, computed: null, status: 'COMPLETE', alerts: [],
    trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
  };
  const { updatedRecord, rawUnchanged } = recalculateAcquisition(rec, trial, getDefaultScientificRuleSet());
  trial.acquisitions[`${stage.id}__${trial.id}-p-${panelSuffix}__${familyId}`] = updatedRecord;
  if (!rawUnchanged) throw new Error('RAW muté pendant le recalcul');
  return updatedRecord;
}

function traceOf(rec: PanelAcquisitionRecord): ReferenceTrace | undefined {
  return (rec.computed as { referenceTrace?: ReferenceTrace } | null)?.referenceTrace;
}

export function runRecalculatorPopulationTests(): {
  results: RecalculatorPopulationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: RecalculatorPopulationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const blocked = (rec: PanelAcquisitionRecord): boolean =>
    rec.computed === null && rec.status === 'EMPTY';

  // --- PERSOZ 1-3 : E1/E2/E3 → COMPUTED ---
  (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
    const trial = buildTrial();
    recalc(trial, 0, sfx, 'PERSOZ', persozRaw());
    const rec = recalc(trial, 12, sfx, 'PERSOZ', persozRaw());
    const mean = (rec.computed as { meanDampingTime?: unknown } | null)?.meanDampingTime;
    record(`RPL-0${1 + i}`, `PERSOZ ${sfx} valide → COMPUTED produit`,
      typeof mean === 'number', 'mean numérique', `mean=${String(mean)}, status=${rec.status}`);
  });

  // --- PERSOZ 4-7 : T → rien ---
  {
    const trial = buildTrial();
    const rec = recalc(trial, 0, 'T', 'PERSOZ', persozRaw());
    record('RPL-04', 'PERSOZ T → aucun COMPUTED exploitable',
      blocked(rec), 'null + EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  }
  {
    const trial = buildTrial();
    const rec = recalc(trial, 12, 'T', 'PERSOZ', persozRaw());
    record('RPL-05', 'PERSOZ T RAW valide → toujours refusé',
      blocked(rec), 'null + EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  }
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'PERSOZ', persozRaw());
    const rec = recalc(trial, 12, 'T', 'PERSOZ', persozRaw());
    const t = traceOf(rec);
    record('RPL-06', 'PERSOZ T avec T0 disponible → aucune référence',
      blocked(rec) && t === undefined, 'null, sans trace', `computed=${String(rec.computed)}`);
  }
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'PERSOZ', persozRaw());
    const rec = recalc(trial, 12, 'T', 'PERSOZ', persozRaw());
    record('RPL-07', 'PERSOZ T avec historique → référence supprimée (rien)',
      blocked(rec) && traceOf(rec) === undefined, 'null, sans trace', `computed=${String(rec.computed)}`);
  }

  // --- PERSOZ 8 : E1 conserve sa référence ---
  {
    const trial = buildTrial();
    recalc(trial, 0, 'E1', 'PERSOZ', persozRaw());
    const rec = recalc(trial, 12, 'E1', 'PERSOZ', persozRaw());
    const t = traceOf(rec);
    record('RPL-08', 'PERSOZ E1 valide conserve sa référence T0 même panneau',
      t?.referenceRule === 'SAME_PANEL_T0' && t?.referencePanelId === `${trial.id}-p-E1`,
      'SAME_PANEL_T0 E1', JSON.stringify(t));
  }

  // --- ADHÉSION 9-19 ---
  {
    const trial = buildTrial();
    const rec = recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const cls = (rec.computed as { adhesionClass?: unknown } | null)?.adhesionClass;
    record('RPL-09', 'ADHÉSION T0/T → calcul autorisé',
      cls === 0, 'classe 0', `classe=${String(cls)}`);
  }
  ([
    ['10', 0, 'E1'], ['11', 0, 'E2'], ['12', 0, 'E3'],
    ['13', 1, 'T'], ['14', 6, 'E2'], ['15', 11, 'E3'], ['16', 12, 'T']
  ] as const).forEach(([num, cycle, panel]) => {
    const trial = buildTrial();
    if (cycle === 12) recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalc(trial, cycle, panel, 'ADHESION', adhRaw(2));
    record(`RPL-${num}`, `ADHÉSION ${cycle === 0 ? 'T0' : `C${cycle}`}/${panel} → refusé`,
      blocked(rec), 'null + EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  });
  (['E1', 'E2', 'E3'] as const).forEach((sfx, i) => {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalc(trial, 12, sfx, 'ADHESION', adhRaw(2));
    const cls = (rec.computed as { adhesionClass?: unknown } | null)?.adhesionClass;
    record(`RPL-${17 + i}`, `ADHÉSION C12/${sfx} → calcul autorisé`,
      cls === 2, 'classe 2', `classe=${String(cls)}`);
  });
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'ADHESION', adhRaw(1));
    const rec = recalc(trial, 12, 'E1', 'ADHESION', adhRaw(3));
    const t = traceOf(rec);
    const computed = rec.computed as { initialAdhesionClass?: unknown } | null;
    record('RPL-20', 'ADHÉSION C12/E1 conserve la référence T0 du témoin',
      t?.referenceRule === 'T0_WITNESS_REFERENCE' &&
        t?.referencePanelId === `${trial.id}-p-T` &&
        computed?.initialAdhesionClass === 1,
      'T0_WITNESS_REFERENCE, initial=1', JSON.stringify(t));
  }

  // --- Références 21-25 ---
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalc(trial, 12, 'T', 'ADHESION', adhRaw(1));
    record('RPL-21', 'Interdite : aucun referenceRaw (Δ impossible, computed null)',
      rec.computed === null, 'computed null', `computed=${String(rec.computed)}`);
  }
  {
    const trial = buildTrial();
    const rec = recalc(trial, 6, 'E1', 'ADHESION', adhRaw(2));
    record('RPL-22', 'Interdite : aucun referenceStageId',
      rec.computed === null, 'computed null', `computed=${String(rec.computed)}`);
  }
  {
    const trial = buildTrial();
    const rec = recalc(trial, 12, 'T', 'PERSOZ', persozRaw());
    record('RPL-23', 'Interdite : aucun referencePanelId',
      rec.computed === null, 'computed null', `computed=${String(rec.computed)}`);
  }
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const okRef = recalc(trial, 12, 'E1', 'ADHESION', adhRaw(2));
    const tRef = traceOf(okRef);
    const koRef = recalc(trial, 12, 'T', 'ADHESION', adhRaw(1));
    record('RPL-24', 'Règle : T0_WITNESS_REFERENCE si autorisée, sinon aucune',
      tRef?.referenceRule === 'T0_WITNESS_REFERENCE' && koRef.computed === null,
      'référence vs rien', `${tRef?.referenceRule} / ${String(koRef.computed)}`);
  }
  {
    const trial = buildTrial();
    recalc(trial, 0, 'T', 'ADHESION', adhRaw(0));
    const rec = recalc(trial, 6, 'E1', 'ADHESION', adhRaw(2));
    record('RPL-25', 'T0 existant ne réhabilite pas C6/E1',
      blocked(rec), 'null + EMPTY', `computed=${String(rec.computed)}, status=${rec.status}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
