/**
 * QUV-Lab — Suite de Tests FIDÉLITÉ DU RAPPORT SCIENTIFIQUE.
 *
 * Aucune donnée expérimentale absente ne devient une valeur fictive :
 * 'Non renseigné' explicite, 0 préservé, exigences normatives distinguées
 * des mesures. auditTrialBeforeReport() vérifie réellement chaque point.
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import {
  buildScientificReport,
  auditTrialBeforeReport,
  displayReportValue
} from '../../services/reportGenerator';
import { getDefaultScientificRuleSet, createCountConfiguration } from '../ruleSet';
import { isPersozEligiblePanel, isAdhesionEligiblePanel, getActiveE1E2E3Panels } from '../panelUtils';
import type { Trial } from '../../types/trial';

export interface ReportFidelityTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

let trialSeq = 0;

function buildSparseTrial(): Trial {
  trialSeq += 1;
  const trialId = `trial-rf-${trialSeq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-05T00:00:00Z',
    updatedAt: '2026-09-05T00:00:00Z',
    metadata: { reference: `QUV-RF-${trialSeq}`, createdBy: 'TEST_OP' },
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
      id: batchId, trialId, reference: `LOT RF-${trialSeq}`, orderIndex: 1,
      panels: [
        { id: `${trialId}-p-T`, batchId, index: 1, label: 'T', role: 'WITNESS' as const, roleCode: 'T' as const, status: 'ACTIVE' as const },
        { id: `${trialId}-p-E1`, batchId, index: 2, label: '1', role: 'EXPOSED_1' as const, roleCode: 'E1' as const, status: 'ACTIVE' as const }
      ]
    }],
    acquisitions: {}, auditTrail: [], mediaReferences: []
  } as Trial;
}

function buildReport(trial: Trial) {
  return buildScientificReport(trial, getDefaultScientificRuleSet(), { operatorId: 'TEST_OP' });
}

const FORBIDDEN_PATTERNS = [
  'Support: Chêne',
  '| Couches: 3',
  'P120',
  '| Application: Pinceau',
  '| Séchage: 7 jours',
  '150 × 75 × 15 mm',
  'Sur quartier (NF EN 927-6)',
  'Stabilisation selon NF EN 927-6 §5'
];

export function runReportFidelityTests(): {
  results: ReportFidelityTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ReportFidelityTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const sparseText = (): string => {
    const report = buildReport(buildSparseTrial());
    return `${report.sections.materialsAndBatches}\n${report.sections.panelsDefinition}`;
  };

  // --- RF-01..08 : champs absents → Non renseigné, jamais fictif ---
  ([
    ['RF-01', 'Support: Chêne'],
    ['RF-02', '| Couches: 3'],
    ['RF-03', 'P120'],
    ['RF-04', '| Application: Pinceau'],
    ['RF-05', '| Séchage: 7 jours']
  ] as const).forEach(([id, pattern]) => {
    const text = sparseText();
    const ok = !text.includes(pattern) && text.includes('Non renseigné');
    record(id, `Absent → 'Non renseigné', jamais '${pattern}'`,
      ok, 'Non renseigné, sans fictif', ok ? 'OK' : `TROUVÉ: ${pattern}`);
  });
  {
    const text = sparseText();
    const okDims = !text.includes('150 × 75 × 15 mm') && text.includes('Non renseigné');
    record('RF-06', 'Dimensions absentes → Non renseigné (3 champs)',
      okDims, 'Non renseigné, sans 150×75×15', String(okDims));
    const okOri = !text.includes('Sur quartier (NF EN 927-6)');
    record('RF-07', 'Orientation absente → Non renseigné',
      okOri, 'sans Sur quartier', String(okOri));
    const okCond = !text.includes('Stabilisation selon NF EN 927-6 §5');
    record('RF-08', 'Conditionnement absent → Non renseigné',
      okCond, 'sans Stabilisation §5', String(okCond));
  }

  // --- RF-09 : zéro préservé ---
  {
    const okZero = displayReportValue(0) === '0';
    const okUndef = displayReportValue(undefined) === 'Non renseigné';
    const okNull = displayReportValue(null) === 'Non renseigné';
    const okEmpty = displayReportValue('   ') === 'Non renseigné';
    const ok = okZero && okUndef && okNull && okEmpty;
    record('RF-09', '0 reste 0 ; undefined/null/vide → Non renseigné',
      ok, '0 / Non renseigné ×3', `0→${displayReportValue(0)}`);
  }

  // --- RF-10 : normatif ≠ expérimental ---
  {
    const report = buildReport(buildSparseTrial());
    const ok = report.sections.normativeReferences.includes('NF EN 927-6') &&
      report.sections.materialsAndBatches.includes('Non renseigné');
    record('RF-10', 'Exigence normative affichée sans fabriquer de donnée',
      ok, 'norme citée + Non renseigné', String(ok));
  }

  // --- RF-11 : adaptationsTraced ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const tNone = buildSparseTrial();
    const aNone = auditTrialBeforeReport(tNone, ruleSet);
    const tJust = buildSparseTrial();
    (tJust.config.familyConfigs as Record<string, unknown>)['COLOR'] = {
      familyId: 'COLOR', enabled: true,
      countConfig: createCountConfiguration('COLOR', 2, ruleSet, { justification: 'Motif reel.' })
    };
    const aJust = auditTrialBeforeReport(tJust, ruleSet);
    const tUnjust = buildSparseTrial();
    (tUnjust.config.familyConfigs as Record<string, unknown>)['COLOR'] = {
      familyId: 'COLOR', enabled: true,
      countConfig: createCountConfiguration('COLOR', 2, ruleSet)
    };
    const aUnjust = auditTrialBeforeReport(tUnjust, ruleSet);
    const ok = aNone.checklist.adaptationsTraced === true &&
      aJust.checklist.adaptationsTraced === true &&
      aUnjust.checklist.adaptationsTraced === false;
    record('RF-11', 'adaptationsTraced : rien/justifié=true, injustifié=false',
      ok, 'true/true/false',
      `rien=${String(aNone.checklist.adaptationsTraced)}, just=${String(aJust.checklist.adaptationsTraced)}, injust=${String(aUnjust.checklist.adaptationsTraced)}`);
  }

  // --- RF-12 : alertsCataloged ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const tNone = buildSparseTrial();
    const aNone = auditTrialBeforeReport(tNone, ruleSet);
    const tOk = buildSparseTrial();
    const stage = tOk.stages.find((s) => s.cycleIndex === 0)!;
    tOk.acquisitions[`${stage.id}__${tOk.id}-p-E1__COLOR`] = {
      id: 'a1', trialId: tOk.id, stageId: stage.id, batchId: tOk.batches[0].id,
      panelId: `${tOk.id}-p-E1`, familyId: 'COLOR', raw: {}, computed: null,
      status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
    const aOk = auditTrialBeforeReport(tOk, ruleSet);
    const tBad = buildSparseTrial();
    const stageB = tBad.stages.find((s) => s.cycleIndex === 0)!;
    const recNoAlerts: Record<string, unknown> = {
      id: 'a2', trialId: tBad.id, stageId: stageB.id, batchId: tBad.batches[0].id,
      panelId: `${tBad.id}-p-E1`, familyId: 'COLOR', raw: {}, computed: null,
      status: 'COMPLETE',
      trace: {}, mediaIds: []
    };
    tBad.acquisitions[`${stageB.id}__${tBad.id}-p-E1__COLOR`] = recNoAlerts as unknown as Trial['acquisitions'][string];
    const aBad = auditTrialBeforeReport(tBad, ruleSet);
    const ok = aNone.checklist.alertsCataloged === true &&
      aOk.checklist.alertsCataloged === true &&
      aBad.checklist.alertsCataloged === false;
    record('RF-12', 'alertsCataloged : catalogue présent/absent détecté',
      ok, 'true/true/false',
      `vide=${String(aNone.checklist.alertsCataloged)}, ok=${String(aOk.checklist.alertsCataloged)}, sans=${String(aBad.checklist.alertsCataloged)}`);
  }

  // --- RF-13 : computationsAvailable ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const tFull = buildSparseTrial();
    const stage = tFull.stages.find((s) => s.cycleIndex === 0)!;
    tFull.acquisitions[`${stage.id}__${tFull.id}-p-E1__COLOR`] = {
      id: 'a1', trialId: tFull.id, stageId: stage.id, batchId: tFull.batches[0].id,
      panelId: `${tFull.id}-p-E1`, familyId: 'COLOR', raw: {}, computed: { qualityAssessment: { status: 'GOOD' } },
      status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
    const aFull = auditTrialBeforeReport(tFull, ruleSet);
    const tNull = buildSparseTrial();
    const stageN = tNull.stages.find((s) => s.cycleIndex === 0)!;
    tNull.acquisitions[`${stageN.id}__${tNull.id}-p-E1__COLOR`] = {
      id: 'a2', trialId: tNull.id, stageId: stageN.id, batchId: tNull.batches[0].id,
      panelId: `${tNull.id}-p-E1`, familyId: 'COLOR', raw: {}, computed: null,
      status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
    } as unknown as Trial['acquisitions'][string];
    const aNull = auditTrialBeforeReport(tNull, ruleSet);
    const tEmpty = buildSparseTrial();
    const aEmpty = auditTrialBeforeReport(tEmpty, ruleSet);
    const ok = aFull.checklist.computationsAvailable === true &&
      aNull.checklist.computationsAvailable === false &&
      aEmpty.checklist.computationsAvailable === false;
    record('RF-13', 'computationsAvailable : présent/vrai, sinon faux (vide inclus)',
      ok, 'true/false/false',
      `full=${String(aFull.checklist.computationsAvailable)}, null=${String(aNull.checklist.computationsAvailable)}, vide=${String(aEmpty.checklist.computationsAvailable)}`);
  }

  // --- RF-14 : C12 ---
  {
    const ruleSet = getDefaultScientificRuleSet();
    const tDone = buildSparseTrial();
    const c12Done = tDone.stages.find((s) => s.cycleIndex === 12)!;
    c12Done.status = 'VALIDATED';
    const aDone = auditTrialBeforeReport(tDone, ruleSet);
    const tMissing = buildSparseTrial();
    tMissing.stages = tMissing.stages.filter((s) => s.cycleIndex !== 12);
    const aMissing = auditTrialBeforeReport(tMissing, ruleSet);
    const tPending = buildSparseTrial();
    const aPending = auditTrialBeforeReport(tPending, ruleSet);
    const warnPending = aPending.warnings.some((w) => w.includes('2016'));
    const ok = aDone.checklist.final2016hAvailableOrFlagged === true &&
      aMissing.checklist.final2016hAvailableOrFlagged === false &&
      aPending.checklist.final2016hAvailableOrFlagged === true && warnPending;
    record('RF-14', 'C12 : fait=true, absent=false, en cours=flagué+warning',
      ok, 'true/false/(true+warning)',
      `fait=${String(aDone.checklist.final2016hAvailableOrFlagged)}, absent=${String(aMissing.checklist.final2016hAvailableOrFlagged)}, encours=${String(aPending.checklist.final2016hAvailableOrFlagged)}`);
  }

  // --- RF-15/16/17 : non-régressions populations ---
  {
    const perOk = isPersozEligiblePanel({ roleCode: 'E1', role: 'EXPOSED_1' }) &&
      !isPersozEligiblePanel({ roleCode: 'T', role: 'WITNESS' });
    record('RF-15', 'PERSOZ : E1-E3, T interdit (inchangé)', perOk, 'true', String(perOk));
    const t0 = { cycleIndex: 0 };
    const c6 = { cycleIndex: 6 };
    const c12 = { cycleIndex: 12 };
    const T = { label: 'T', roleCode: 'T', role: 'WITNESS' };
    const E1 = { label: '1', roleCode: 'E1', role: 'EXPOSED_1' };
    const adhOk = isAdhesionEligiblePanel(T, t0) && !isAdhesionEligiblePanel(E1, t0) &&
      !isAdhesionEligiblePanel(T, c6) && isAdhesionEligiblePanel(E1, c12) && !isAdhesionEligiblePanel(T, c12);
    record('RF-16', 'ADHÉSION : matrice T0/T, C6 rien, C12/E (inchangée)', adhOk, 'true', String(adhOk));
    const panels = [
      { id: 't', label: 'T', roleCode: 'T', role: 'WITNESS', status: 'ACTIVE' },
      { id: 'e1', label: '1', roleCode: 'E1', role: 'EXPOSED_1', status: 'ACTIVE' }
    ];
    const strict = getActiveE1E2E3Panels(panels);
    record('RF-17', 'COLOR/GLOSS : T exclu des exposés (inchangé)',
      strict.length === 1 && strict[0].id === 'e1', '[e1]', JSON.stringify(strict.map((p) => p.id)));
  }

  // --- Test global de non-fabrication ---
  {
    const text = sparseText();
    const found = FORBIDDEN_PATTERNS.filter((p) => text.includes(p));
    const ok = found.length === 0 && text.includes('Non renseigné');
    record('RF-GLOBAL', 'Rapport minimal : aucun fictif, Non renseigné présent',
      ok, '0 fictif + Non renseigné', found.length === 0 ? 'OK' : `TROUVÉS: ${found.join(', ')}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
