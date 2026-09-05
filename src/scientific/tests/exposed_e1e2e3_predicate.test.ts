/**
 * QUV-Lab — Suite de Tests PRÉDICAT E1/E2/E3 EXPOSÉS (durcissement P2).
 *
 * `isExposedE1E2E3Panel()` est la source unique d'éprouvette exposée normalisée
 * (PERSOZ, ADHÉSION C12, agrégations scientifiques) : découplée de PERSOZ,
 * `getActiveExposedPanels()` générique conservé pour les cinétiques.
 * T n'est jamais exposé ; aucun custom/incohérent/inactif ne passe.
 */

import { generateStandardExposureStages, globalTrialStore, IntegrityViolationError } from '../../services/trialStore';
import {
  isExposedE1E2E3Panel,
  getActiveE1E2E3Panels,
  isPersozEligiblePanel,
  isAdhesionEligiblePanel
} from '../panelUtils';
import { aggregateBatchPersoz, aggregateBatchGloss } from '../aggregations';
import { recalculateAcquisition } from '../recalculator';
import { getDefaultScientificRuleSet } from '../ruleSet';
import type { Trial } from '../../types/trial';
import type { PersozComputedData, GlossComputedData, AdhesionRawData } from '../../types/scientific';

export interface ExposedPredicateTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const P = (roleCode: string, role: string, status = 'ACTIVE', label = 'X') => ({ roleCode, role, status, label });

function mkPersoz(mean: number | null): PersozComputedData {
  return {
    pointsCount: 3,
    validCount: 3,
    meanDampingTime: mean,
    stdDevDampingTime: 0.5,
    coefficientOfVariationPercent: 0.6,
    deltaDampingTime: null,
    relativeHardnessVariationPercent: null,
    qualityAssessment: {
      expectedCount: 3, actualCount: 3, validCount: 3, suspectCount: 0,
      invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
    },
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  } as PersozComputedData;
}

function mkGloss(mean: number | null): GlossComputedData {
  return {
    totalReadings: 4,
    validCount: 4,
    meanGloss: mean,
    stdDevGloss: 0.5,
    seriesStats: [],
    deltaGloss: null,
    retentionRatePercent: 90,
    qualityAssessment: {
      expectedCount: 4, actualCount: 4, validCount: 4, suspectCount: 0,
      invalidCount: 0, missingCount: 0, completenessPercent: 100, status: 'GOOD', warnings: []
    },
    protocolStatus: 'STANDARD',
    computation: { calculationVersion: 'test', calculatedAt: '2026-09-05T00:00:00Z' }
  } as GlossComputedData;
}

let trialSeq = 0;

function buildTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-exp-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  const trial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-EXP-${trialSeq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['PERSOZ', 'ADHESION'], familyConfigs: {} },
    scheduleConfig: {
      cycleDurationHours: 168, maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [], finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [
      {
        id: batchId, trialId, reference: `LOT EXP-${trialSeq}`, orderIndex: 1,
        dryFilmThicknessMicrons: 90, applicationDate: '2026-08-01T00:00:00Z',
        panels: [
          { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E2`, batchId, index: 3, label: '2', role: 'EXPOSED_2' as const, roleCode: 'E2' as const, status: 'ACTIVE' as const },
          { id: `${trialId}-p-E3`, batchId, index: 4, label: '3', role: 'EXPOSED_3' as const, roleCode: 'E3' as const, status: 'ACTIVE' as const }
        ]
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  };
  globalTrialStore.saveTrial(trial);
  return trial;
}

function persozRaw() {
  return {
    readings: [
      { pointIndex: 1, dampingTimeSeconds: 85.2 },
      { pointIndex: 2, dampingTimeSeconds: 84.8 },
      { pointIndex: 3, dampingTimeSeconds: 85.5 }
    ],
    unit: 'SECONDS'
  };
}

function adhRaw(adhesionClass: number): AdhesionRawData {
  return {
    adhesionClass,
    gridSpacingMm: 2,
    coatingThicknessMicrons: 90,
    measurementDateTime: '2026-10-24T00:00:00Z',
    applicationDateTime: '2026-08-01T00:00:00Z',
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020'
  };
}

export function runExposedE1E2E3Tests(): {
  results: ExposedPredicateTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ExposedPredicateTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // --- Exposition 1-3 : E1/E2/E3 valides ---
  ([
    ['EXP-01', 'E1', 'EXPOSED_1'],
    ['EXP-02', 'E2', 'EXPOSED_2'],
    ['EXP-03', 'E3', 'EXPOSED_3']
  ] as const).forEach(([id, code, role]) => {
    const ok = isExposedE1E2E3Panel(P(code, role));
    record(id, `${code} est exposé valide`, ok, 'true', String(ok));
  });

  // --- Exposition 4 : T jamais exposé ---
  {
    const tVariants = [
      P('T', 'WITNESS', 'ACTIVE', 'T'),
      P('T', 'EXPOSED_1', 'ACTIVE', 'X'),
      P('E1', 'WITNESS', 'ACTIVE', 'X'),
      P('T', 'WITNESS', 'ACTIVE', 'X')
    ];
    const noneExposed = tVariants.every((p) => !isExposedE1E2E3Panel(p));
    record('EXP-04', "T n'est jamais exposé (toutes variantes)", noneExposed, 'aucune variante exposée', noneExposed ? 'OK' : 'FUITE');
  }

  // --- Exposition 5 : inactif exclu ---
  {
    const list = getActiveE1E2E3Panels([
      { id: 'e1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' },
      { id: 'e2', roleCode: 'E2', role: 'EXPOSED_2', status: 'EXCLUDED' },
      { id: 't', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' }
    ]);
    record(
      'EXP-05',
      'Panneau inactif exclu du strict',
      list.length === 1 && list[0].id === 'e1',
      '[e1]',
      JSON.stringify(list.map((p) => p.id))
    );
  }

  // --- Exposition 6 : EXPOSED_CUSTOM non assimilé ---
  {
    const ok =
      !isExposedE1E2E3Panel(P('E', 'EXPOSED_CUSTOM')) &&
      !isExposedE1E2E3Panel(P('E1', 'EXPOSED_CUSTOM')) &&
      !isExposedE1E2E3Panel(P('E', 'EXPOSED_1'));
    record('EXP-06', 'EXPOSED_CUSTOM / code E générique non assimilés à E1/E2/E3', ok, 'tous refusés', ok ? 'OK' : 'FUITE');
  }

  // --- Exposition 7 : incohérents non E1/E2/E3 ---
  {
    const ok =
      !isExposedE1E2E3Panel(P('E1', 'EXPOSED_2')) &&
      !isExposedE1E2E3Panel(P('E2', 'WITNESS')) &&
      !isExposedE1E2E3Panel({} as { roleCode: string; role: string });
    record('EXP-07', 'Code/role incohérents jamais E1/E2/E3', ok, 'tous refusés', ok ? 'OK' : 'FUITE');
  }

  // --- PERSOZ 8 : E1/E2/E3 acceptés (store) ---
  {
    const trial = buildTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    let ok = 0;
    (['E1', 'E2', 'E3'] as const).forEach((sfx) => {
      try {
        globalTrialStore.recordAcquisition({
          trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
          panelId: `${trial.id}-p-${sfx}`, familyId: 'PERSOZ', raw: persozRaw(), operatorId: 'TEST_OP'
        });
        ok += 1;
      } catch { /* compté */ }
    });
    record('EXP-08', 'PERSOZ E1/E2/E3 acceptés', ok === 3, '3/3', `${ok}/3`);
  }

  // --- PERSOZ 9-11 : T / WITNESS / incohérent refusés ---
  {
    const trial = buildTrial();
    const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
    const attempt = (panelId: string): boolean => {
      try {
        globalTrialStore.recordAcquisition({
          trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
          panelId, familyId: 'PERSOZ', raw: persozRaw(), operatorId: 'TEST_OP'
        });
        return false;
      } catch (err) {
        return err instanceof IntegrityViolationError;
      }
    };
    const rT = attempt(`${trial.id}-p-T`);
    record('EXP-09', 'PERSOZ T refusé', rT, 'IntegrityViolationError', String(rT));
    const rEligibleDirect =
      isPersozEligiblePanel(P('E1', 'EXPOSED_1')) && !isPersozEligiblePanel(P('T', 'WITNESS', 'ACTIVE', 'T'));
    record('EXP-10', 'Rôle WITNESS refusé (prédicat PERSOZ découplé)', rEligibleDirect, 'E1 oui / T non', String(rEligibleDirect));
    const rIncoherent =
      !isPersozEligiblePanel(P('E1', 'EXPOSED_2')) && !isPersozEligiblePanel(P('E', 'EXPOSED_1'));
    record('EXP-11', 'Rôle/code incohérent refusé (PERSOZ)', rIncoherent, 'refusés', String(rIncoherent));
  }

  // --- PERSOZ 12 : PZ-T verts (couverture existante préservée) ---
  {
    const ok = isPersozEligiblePanel(P('E2', 'EXPOSED_2')) && isPersozEligiblePanel(P('E3', 'EXPOSED_3'));
    record('EXP-12', 'Sémantique PERSOZ inchangée (E2/E3 éligibles)', ok, 'true', String(ok));
  }

  // --- ADHÉSION 13-16 : matrice via prédicat + store ---
  {
    const t0 = { cycleIndex: 0 };
    const c12 = { cycleIndex: 12 };
    const T = P('T', 'WITNESS', 'ACTIVE', 'T');
    const E1 = P('E1', 'EXPOSED_1');
    const E2 = P('E2', 'EXPOSED_2');
    const E3 = P('E3', 'EXPOSED_3');
    const r13 = isAdhesionEligiblePanel(T, t0);
    record('EXP-13', 'ADHÉSION T0 → T accepté', r13, 'true', String(r13));
    const r14 = ![E1, E2, E3].some((p) => isAdhesionEligiblePanel(p, t0));
    record('EXP-14', 'ADHÉSION T0 → E1/E2/E3 refusés', r14, 'aucun éligible', String(r14));
    const r15 = [E1, E2, E3].every((p) => isAdhesionEligiblePanel(p, c12));
    record('EXP-15', 'ADHÉSION C12 → E1/E2/E3 acceptés', r15, 'tous éligibles', String(r15));
    const r16 = !isAdhesionEligiblePanel(T, c12);
    record('EXP-16', 'ADHÉSION C12 → T refusé', r16, 'false', String(!r16));
  }

  // --- ADHÉSION 17 : C1-C11 aucune cible ---
  {
    const c6 = { cycleIndex: 6 };
    const panels = [P('T', 'WITNESS', 'ACTIVE', 'T'), P('E1', 'EXPOSED_1'), P('E2', 'EXPOSED_2'), P('E3', 'EXPOSED_3')];
    const none = panels.every((p) => !isAdhesionEligiblePanel(p, c6));
    record('EXP-17', 'ADHÉSION C1-C11 → aucune cible', none, 'aucune éligible', String(none));
  }

  // --- ADHÉSION 18 : référence C12 = T0/T (recalcul, leurre ignoré) ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const trial = buildTrial();
    const stageT0 = trial.stages.find((s) => s.cycleIndex === 0)!;
    const stageC12 = trial.stages.find((s) => s.cycleIndex === 12)!;
    const batchId = trial.batches[0].id;
    const seed = (stageId: string, panelId: string, cls: number) => {
      trial.acquisitions[`${stageId}__${panelId}__ADHESION`] = {
        id: `acq-${stageId}-${panelId}`, trialId: trial.id, stageId, batchId, panelId,
        familyId: 'ADHESION', raw: adhRaw(cls), computed: null, status: 'COMPLETE', alerts: [],
        trace: { createdBy: 'TEST_OP', createdAt: '2026-09-05T00:00:00Z', source: 'MANUAL_KEYPAD' }, mediaIds: []
      };
    };
    seed(stageT0.id, `${trial.id}-p-T`, 1);
    seed(stageT0.id, `${trial.id}-p-E1`, 5);
    seed(stageC12.id, `${trial.id}-p-E1`, 3);
    const rec = trial.acquisitions[`${stageC12.id}__${trial.id}-p-E1__ADHESION`];
    const { updatedRecord } = recalculateAcquisition(rec, trial, ruleSet);
    const computed = updatedRecord.computed as { initialAdhesionClass?: unknown; deltaAdhesionClass?: unknown } | null;
    const ok = computed?.initialAdhesionClass === 1 && computed?.deltaAdhesionClass === 2;
    record('EXP-18', 'Référence C12 = T0/T (T0/E1=5 ignoré)', ok, 'initial=1, Δ=+2',
      `initial=${String(computed?.initialAdhesionClass)}, Δ=${String(computed?.deltaAdhesionClass)}`);
  }

  // --- Agrégations 19-21 ---
  {
    // 19 : chemin appelant strict — T accidentel filtré avant agrégation.
    const panels = [
      { id: 't', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' },
      { id: 'e1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' },
      { id: 'e2', roleCode: 'E2', role: 'EXPOSED_2', status: 'ACTIVE' },
      { id: 'e3', roleCode: 'E3', role: 'EXPOSED_3', status: 'ACTIVE' }
    ];
    const strict = getActiveE1E2E3Panels(panels);
    const byId: Record<string, PersozComputedData> = {
      t: mkPersoz(200), e1: mkPersoz(84), e2: mkPersoz(86), e3: mkPersoz(85)
    };
    const agg = aggregateBatchPersoz('b', 's', strict.map((p) => byId[p.id]));
    const ok = strict.length === 3 && agg.interPanelMean === 85 && agg.panelsCount === 3;
    record('EXP-19', 'T accidentel exclu par le chemin strict avant agrégation', ok, '3 panneaux, mean=85 (pas 200)',
      `${strict.length} panneaux, mean=${String(agg.interPanelMean)}`);
  }
  {
    // 20 : population = E1/E2/E3 uniquement.
    const agg = aggregateBatchPersoz('b', 's', [mkPersoz(84), mkPersoz(86), mkPersoz(85)]);
    record('EXP-20', 'Population statistique = E1/E2/E3 uniquement', agg.activePanelsCount === 3 && agg.interPanelMean === 85,
      '3 actifs, mean=85', `${agg.activePanelsCount} actifs, mean=${String(agg.interPanelMean)}`);
  }
  {
    // 21 : formules inchangées (valeurs connues, n−1).
    const aggP = aggregateBatchPersoz('b', 's', [mkPersoz(80), mkPersoz(90), mkPersoz(100)]);
    const aggG = aggregateBatchGloss('b', 's', [mkGloss(44), mkGloss(46), mkGloss(45)]);
    const ok = aggP.interPanelMean === 90 && aggP.interPanelStdDev === 10 &&
      aggG.interPanelMean === 45 && aggG.interPanelStdDev === 1;
    record('EXP-21', 'Formules moyenne/écart-type inchangées', ok, 'Persoz 90/10, Gloss 45/1',
      `Persoz ${String(aggP.interPanelMean)}/${String(aggP.interPanelStdDev)}, Gloss ${String(aggG.interPanelMean)}/${String(aggG.interPanelStdDev)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
