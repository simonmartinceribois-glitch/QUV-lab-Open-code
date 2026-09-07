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

function addComputedAcq(trial: Trial, family: 'COLOR' | 'GLOSS', computed: unknown): void {
  const stage = trial.stages.find((s) => s.cycleIndex === 0)!;
  const panelId = `${trial.id}-p-E1`;
  trial.acquisitions[`${stage.id}__${panelId}__${family}`] = {
    id: `rf-${family}`, trialId: trial.id, stageId: stage.id, batchId: trial.batches[0].id,
    panelId, familyId: family, raw: {}, computed,
    status: 'COMPLETE', alerts: [], trace: {}, mediaIds: []
  } as unknown as Trial['acquisitions'][string];
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

  // --- RF-18..20 : renforcement vérification displayReportValue nullable ---
  {
    // Test : 0 reste 0, jamais "Non renseigné"
    const ok0 = displayReportValue(0) === '0';
    record('RF-18', 'displayReportValue(0) === "0" (zéro expérimental conservé)',
      ok0, '"0"', `obtenu=${displayReportValue(0)}`);
    // Test : undefined → "Non renseigné"
    const okUndef = displayReportValue(undefined) === 'Non renseigné';
    record('RF-19', 'displayReportValue(undefined) === "Non renseigné"',
      okUndef, '"Non renseigné"', `obtenu=${displayReportValue(undefined)}`);
    // Test : null → "Non renseigné"
    const okNull = displayReportValue(null) === 'Non renseigné';
    record('RF-20', 'displayReportValue(null) === "Non renseigné"',
      okNull, '"Non renseigné"', `obtenu=${displayReportValue(null)}`);
  }

  // --- Test global de non-fabrication ---

  // --- RF-21..24 : pipeline réel COLOR/GLOSS (missing vs zéro/100 légitimes) ---
  {
    const tMissing = buildSparseTrial();
    const rMissing = buildReport(tMissing);
    const okColorMissing = rMissing.sections.colorResults.includes('enregistrée : Non renseigné');
    record('RF-21', 'COLOR-MISSING : pipeline rapport affiche Non renseigné',
      okColorMissing, 'enregistrée : Non renseigné', String(okColorMissing));
    const okGlossMissing = rMissing.sections.glossResults.includes('Non renseigné');
    record('RF-22', 'GLOSS-MISSING : pipeline rapport affiche Non renseigné',
      okGlossMissing, 'Non renseigné', String(okGlossMissing));
  }
  {
    const tZero = buildSparseTrial();
    addComputedAcq(tZero, 'COLOR', { deltaE: 0 });
    const rZero = buildReport(tZero);
    const okRealZero = rZero.sections.colorResults.includes('enregistrée : 0.00');
    record('RF-23', 'COLOR-REAL-ZERO : vrai ΔE=0 affiché 0.00 (pas Non renseigné)',
      okRealZero, 'enregistrée : 0.00', String(okRealZero));
    const t100 = buildSparseTrial();
    addComputedAcq(t100, 'GLOSS', { retentionRatePercent: 100 });
    const r100 = buildReport(t100);
    const okReal100 = r100.sections.glossResults.includes('minimale de 100.0 %');
    record('RF-24', 'GLOSS-REAL-100 : vraie rétention=100 affichée 100.0 %',
      okReal100, 'minimale de 100.0 %', String(okReal100));
  }

  // --- RF-25..27 : rapport partiel / C12 (rendu, pas seulement audit) ---
  {
    const tPart = buildSparseTrial();
    const c12 = tPart.stages.find((s) => s.cycleIndex === 12)!;
    c12.status = 'NOT_STARTED';
    const rPart = buildReport(tPart);
    const okPart = rPart.completenessStatus === 'PARTIEL / INTERMÉDIAIRE' &&
      rPart.executiveSummary.includes('PARTIEL') &&
      rPart.sections.factualConclusion.includes('aucune conclusion globale');
    record('RF-25', 'PARTIEL : C12 non validé → statut PARTIEL + blocage conformité',
      okPart, 'PARTIEL + blocage', String(okPart));
  }
  {
    const tFull = buildSparseTrial();
    const t0 = tFull.stages.find((s) => s.cycleIndex === 0)!;
    t0.status = 'VALIDATED';
    const c12 = tFull.stages.find((s) => s.cycleIndex === 12)!;
    c12.status = 'VALIDATED';
    const rFull = buildReport(tFull);
    const okFull = rFull.isComplete === true &&
      rFull.completenessStatus === 'COMPLET' &&
      !rFull.executiveSummary.includes('PARTIEL');
    record('RF-26', 'COMPLET : T0+C12 validés → COMPLET sans mention PARTIEL',
      okFull, 'COMPLET', String(okFull));
  }
  {
    const tProg = buildSparseTrial();
    const c12 = tProg.stages.find((s) => s.cycleIndex === 12)!;
    c12.status = 'IN_PROGRESS';
    const audit = auditTrialBeforeReport(tProg, getDefaultScientificRuleSet());
    const rProg = buildReport(tProg);
    const okProg = audit.checklist.final2016hAvailableOrFlagged === true &&
      audit.warnings.some((w) => w.includes('2016')) &&
      rProg.isComplete === false &&
      rProg.completenessStatus === 'PARTIEL / INTERMÉDIAIRE';
    record('RF-27', 'C12 présent non validé → flagué + PARTIEL (pas de conformité)',
      okProg, 'flagué + PARTIEL', String(okProg));
  }

  // --- RF-28 : synthèse T0 conditionnée à l'audit (pas d'affirmation fictive) ---
  {
    const tNoT0 = buildSparseTrial();
    const st0 = tNoT0.stages.find((s) => s.cycleIndex === 0)!;
    st0.status = 'NOT_STARTED';
    const rNoT0 = buildReport(tNoT0);
    const okNoT0 = rNoT0.sections.scientificSynthesis.includes('ne sont pas validées') &&
      !rNoT0.sections.scientificSynthesis.includes('ont été validées');
    const tT0 = buildSparseTrial();
    const st0v = tT0.stages.find((s) => s.cycleIndex === 0)!;
    st0v.status = 'VALIDATED';
    const rT0 = buildReport(tT0);
    const okT0 = rT0.sections.scientificSynthesis.includes('ont été validées');
    const ok = okNoT0 && okT0;
    record('RF-28', 'T0 non validé → synthèse prudente ; T0 validé → synthèse affirmative',
      ok, 'prudent/affirmatif selon audit', String(ok));
  }

  // --- RF-29 : cinétique, étape finale 2016 h conditionnée à C12 validé ---
  {
    const tInc = buildSparseTrial();
    const c12i = tInc.stages.find((s) => s.cycleIndex === 12)!;
    c12i.status = 'NOT_STARTED';
    const rInc = buildReport(tInc);
    const okInc = rInc.sections.kineticsAnalysis.includes('2016 h restant à réaliser') &&
      !rInc.sections.kineticsAnalysis.includes('finale à 2016 h.');
    const tDone = buildSparseTrial();
    const c12d = tDone.stages.find((s) => s.cycleIndex === 12)!;
    c12d.status = 'VALIDATED';
    const rDone = buildReport(tDone);
    const okDone = rDone.sections.kineticsAnalysis.includes('finale à 2016 h.');
    const ok = okInc && okDone;
    record('RF-29', 'C12 non validé → finale restante ; C12 validé → finale observée',
      ok, 'restante/observée selon C12', String(ok));
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
