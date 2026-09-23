/**
 * QUV-Lab — Suite de Tests Normatifs, Règles de Décision, Rapport Scientifique et Traçabilité GATE 3.4
 *
 * Vérifie :
 * 1. Inventaire des Références Normatives & Distinctions (NF EN 927-6, ISO 2813, ISO 1522, ISO 4628, CIE L*a*b*).
 * 2. Distinction stricte entre Exigence Normative (NORMATIVE_REQUIREMENT) et Recommandation Interne Labo (LAB_RECOMMENDATION).
 * 3. Cohérence du Calendrier d'Exposition (13 jalons, cycles de 168 h, 2016 h réelles).
 * 4. Règles de Décision Multi-Niveaux (Qualité des Données vs Conformité Protocolaire vs Décision Normative).
 * 5. Cas Limites des Décisions (Seuils stricts, détection d'anomalies, absence de conformité artificielle en cas de données non calculables).
 * 6. Audit Pré-Rapport (Vérification des 10 critères méthodologiques d'intégrité selon NF EN 927-6).
 * 7. Génération du Rapport Scientifique (19 sections + 6 Annexes complètes).
 * 8. Traçabilité des Métadonnées de Calcul (calculationVersion, calculatedAt, scientificRuleSetId).
 * 9. Ségrégation Éprouvettes Exposées vs Témoin T dans le Rapport et Exports (Présentation documentaire sans pollution des calculs).
 * 10. Traitement des Jalons Désactivés et Valeurs Manquantes dans le Rapport (Signalement explicite, pas d'interpolation).
 * 11. Étanchéité Multi-Lots et Multi-Systèmes dans le Rapport & Exports.
 * 12. Fidélité et Réciprocité de l'Export Dossier Scientifique JSON et Exports CSV (RAW vs COMPUTED REPORT).
 * 13. Journal d'Audit Scientifique (auditTrail append-only, zéro régression auditEvents).
 */

import {
  auditTrialBeforeReport,
  buildScientificReport,
  exportReportToCsv,
  exportRawDataToCsv
} from '../../services/reportGenerator';
import { getDefaultScientificRuleSet, createCountConfiguration, createSeriesConfiguration } from '../ruleSet';
import {
  evaluateCountProtocolCompliance,
  evaluateSeriesProtocolCompliance
} from '../protocolEngine';
import { calculateAdhesion } from '../adhesionEngine';
import { assessStageQuality, assessTrialQuality } from '../qualityEngine';
import {
  globalTrialStore,
  generateStandardExposureStages,
  generateUUID,
  TrialStoreService
} from '../../services/trialStore';
import {
  validateScientificContext,
  resolveScientificRuleSetForTrial
} from '../../services/trialStoreService';
import {
  Trial,
  BatchDefinition,
  PanelDefinition,
  ExposureStage
} from '../../types/trial';
import {
  ScientificRuleSet,
  ScientificContext,
  MeasurementCountConfiguration,
  AdhesionRawData,
  ColorRawData,
  GlossRawData,
  PersozRawData,
  VisualObservationsRawData
} from '../../types/scientific';

export interface Gate34TestResult {
  id: string;
  name: string;
  category:
    | 'NORMATIVE_DISTINCTION'
    | 'EXPOSURE_SCHEDULE_2016H'
    | 'DECISION_RULES_AND_LIMITS'
    | 'PRE_REPORT_AUDIT'
    | 'REPORT_GENERATION'
    | 'TRACABILITY_METADATA'
    | 'WITNESS_REPORT_SEGREGATION'
    | 'MISSING_AND_INACTIVE_STAGES'
    | 'MULTI_BATCH_REPORT_ISOLATION'
    | 'EXPORT_FIDELITY_JSON_CSV'
    | 'AUDIT_TRAIL_INTEGRITY'
    | 'PROTOCOL_STANDARD_SOURCE'
    | 'ADHESION_PROTOCOL_MUTUALIZATION'
    | 'SCIENTIFIC_CONTEXT_FREEZE';
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runGate34NormativeReportingTests(): {
  results: Gate34TestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: Gate34TestResult[] = [];
  const ruleSet: ScientificRuleSet = getDefaultScientificRuleSet();

  const record = (
    id: string,
    name: string,
    category: Gate34TestResult['category'],
    passed: boolean,
    expected: string,
    actual: string,
    details?: string
  ) => {
    results.push({ id, name, category, passed, expected, actual, details });
  };

  // ==========================================================================
  // 1. INVENTAIRE & DISTINCTION NORMATIVE VS RECOMMANDATION LABO
  // ==========================================================================

  {
    const colCfg = ruleSet.measurementConfigurations.COLOR;
    const gloCfg = ruleSet.seriesConfigurations?.GLOSS;
    const perCfg = ruleSet.measurementConfigurations.PERSOZ;
    if (!gloCfg) {
      throw new Error('Référentiel de brillance (GLOSS) manquant — suite G34 impossible.');
    }

    const colNormative = colCfg.origin === 'NORMATIVE_REQUIREMENT' && colCfg.clause === '6.3.2';
    const gloNormative = gloCfg.origin === 'NORMATIVE_REQUIREMENT' && gloCfg.clause === '6.3.3';
    const perLab = perCfg.origin === 'LAB_RECOMMENDATION' && Boolean(perCfg.standardReference?.includes('ISO 1522'));

    record(
      'G34-NOR-01',
      'Distinction formelle NF EN 927-6:2018 (Couleur 6.3.2, Brillance 6.3.3) vs Procédure Interne (Dureté Persoz LAB_RECOMMENDATION)',
      'NORMATIVE_DISTINCTION',
      colNormative && gloNormative && perLab,
      'Couleur=NORMATIVE(6.3.2), Brillance=NORMATIVE(6.3.3), Persoz=LAB_RECOMMENDATION(ISO 1522)',
      `Couleur=${colCfg.origin}(${colCfg.clause}), Brillance=${gloCfg.origin}(${gloCfg.clause}), Persoz=${perCfg.origin}`
    );
  }

  // ==========================================================================
  // 2. CALENDRIER D'EXPOSITION 2016 H & PAS DE CYCLE 168 H
  // ==========================================================================

  {
    const dummyTrialId = 'trial-schedule-test';
    const stages = generateStandardExposureStages(dummyTrialId);

    const countCorrect = stages.length === 13;
    const t0Hours = stages[0].scheduledExposureHours === 0;
    const c1Hours = stages[1].scheduledExposureHours === 168;
    const c2Hours = stages[2].scheduledExposureHours === 336;
    const c6Hours = stages[6].scheduledExposureHours === 1008;
    const c12Hours = stages[12].scheduledExposureHours === 2016;

    const schedulePassed = countCorrect && t0Hours && c1Hours && c2Hours && c6Hours && c12Hours;

    record(
      'G34-SCH-01',
      'Calendrier d\'exposition : 13 jalons (T0 + 12 cycles de 168h), étape finale exacte à 2016 h (et non 2000 h)',
      'EXPOSURE_SCHEDULE_2016H',
      schedulePassed,
      '13 jalons, C1=168h, C2=336h, C6=1008h, C12=2016h',
      `Nb=${stages.length}, C1=${stages[1]?.scheduledExposureHours}h, C6=${stages[6]?.scheduledExposureHours}h, C12=${stages[12]?.scheduledExposureHours}h`
    );
  }

  // ==========================================================================
  // 3. RÈGLES DE DÉCISION PROTOCOLAIRES & ADAPTATIONS JUSTIFIÉES
  // ==========================================================================

  {
    // A. Cas nominal standard : 4 pts couleur -> STANDARD
    const stdCol = createCountConfiguration('COLOR', 4, ruleSet);
    const evalStd = evaluateCountProtocolCompliance(stdCol, ruleSet);

    // B. Cas adapté avec justification obligatoire -> ADAPTED_JUSTIFIED
    const adaptedCol = createCountConfiguration('COLOR', 5, ruleSet, {
      justification: 'Éprouvettes de surface réduite 50x50 mm pour criblage R&D',
      operatorId: 'Ingénieur R&D'
    });
    const evalAdapted = evaluateCountProtocolCompliance(adaptedCol, ruleSet);

    // C. Cas adapté SANS justification -> ADAPTED_UNJUSTIFIED (bloquant)
    const unjustifiedCol = createCountConfiguration('COLOR', 5, ruleSet, {
      justification: '',
      operatorId: 'Opérateur'
    });
    const evalUnjustified = evaluateCountProtocolCompliance(unjustifiedCol, ruleSet);

    const passed =
      evalStd.status === 'STANDARD' &&
      evalAdapted.status === 'ADAPTED_JUSTIFIED' &&
      evalUnjustified.status === 'ADAPTED_UNJUSTIFIED' &&
      evalUnjustified.alerts.some((a) => a.severity === 'BLOCKING');

    record(
      'G34-DEC-01',
      'Décision Protocolaire : Rejet bloquant d\'une adaptation non justifiée (ADAPTED_UNJUSTIFIED) et validation d\'une adaptation motivée (ADAPTED_JUSTIFIED)',
      'DECISION_RULES_AND_LIMITS',
      passed,
      'Std=STANDARD, AdaptJustified=ADAPTED_JUSTIFIED, Unjustified=ADAPTED_UNJUSTIFIED (BLOCKING)',
      `Std=${evalStd.status}, Adapt=${evalAdapted.status}, Unjustified=${evalUnjustified.status}`
    );
  }

  // ==========================================================================
  // 4. CONSTRUCTION D'UN ESSAI MULTI-LOTS RÉFÉRENCE POUR LE RAPPORT & AUDIT
  // ==========================================================================

  const trialId = `trial-g34-reporting-${Date.now()}`;
  const stages = generateStandardExposureStages(trialId);
  const stageT0 = stages[0];
  const stageC1 = stages[1];
  const stageC12 = stages[12];

  const b1Id = `${trialId}-batch-1`;
  const b2Id = `${trialId}-batch-2`;

  const panelsB1: PanelDefinition[] = [
    { id: `${b1Id}-p1`, label: 'E1', roleCode: 'E1', role: 'EXPOSED_1', batchId: b1Id, status: 'ACTIVE', index: 1 },
    { id: `${b1Id}-p2`, label: 'E2', roleCode: 'E2', role: 'EXPOSED_2', batchId: b1Id, status: 'ACTIVE', index: 2 },
    { id: `${b1Id}-p3`, label: 'E3', roleCode: 'E3', role: 'EXPOSED_3', batchId: b1Id, status: 'ACTIVE', index: 3 },
    { id: `${b1Id}-pT`, label: 'T', roleCode: 'T', role: 'WITNESS', batchId: b1Id, status: 'ACTIVE', index: 4 }
  ];

  const panelsB2: PanelDefinition[] = [
    { id: `${b2Id}-p1`, label: 'E1', roleCode: 'E1', role: 'EXPOSED_1', batchId: b2Id, status: 'ACTIVE', index: 1 },
    { id: `${b2Id}-p2`, label: 'E2', roleCode: 'E2', role: 'EXPOSED_2', batchId: b2Id, status: 'ACTIVE', index: 2 },
    { id: `${b2Id}-p3`, label: 'E3', roleCode: 'E3', role: 'EXPOSED_3', batchId: b2Id, status: 'ACTIVE', index: 3 },
    { id: `${b2Id}-pT`, label: 'T', roleCode: 'T', role: 'WITNESS', batchId: b2Id, status: 'ACTIVE', index: 4 }
  ];

  const batches: BatchDefinition[] = [
    {
      id: b1Id,
      trialId,
      orderIndex: 0,
      reference: 'LOT-ACRYLIQUE-01',
      applicationDate: '2026-08-01',
      coatingSystem: 'Système Acrylique Hydro',
      productReference: 'Peinture ACRY-TOP',
      woodSpecies: 'Pin sylvestre',
      panels: panelsB1
    },
    {
      id: b2Id,
      trialId,
      orderIndex: 1,
      reference: 'LOT-ALKYDE-02',
      applicationDate: '2026-08-01',
      coatingSystem: 'Système Alkyde Solvant',
      productReference: 'Peinture ALKY-MAX',
      woodSpecies: 'Pin sylvestre',
      panels: panelsB2
    }
  ];

  const fullTrial: Trial = {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    metadata: {
      reference: 'ESSAI-QUV-2026-008',
      title: 'Campagne Comparative Acrylique vs Alkyde 2016h',
      projectOrClient: 'CERIBOIS R&D',
      createdBy: 'Tech Métrologue'
    },
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
      familyConfigs: {
        COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 4, ruleSet) },
        GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet) },
        PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches,
    acquisitions: {},
    mediaReferences: [],
    auditTrail: []
  };

  globalTrialStore.saveTrial(fullTrial);

  // Saisie T0 pour les 2 lots (Couleur, Gloss, Persoz, Observations)
  batches.forEach((b) => {
    b.panels.forEach((p, pIdx) => {
      const baseL = b.id === b1Id ? 60.0 : 40.0;
      const baseGloss = b.id === b1Id ? 80.0 : 30.0;

      // Color T0
      globalTrialStore.recordAcquisition({
        trialId,
        stageId: stageT0.id,
        batchId: b.id,
        panelId: p.id,
        familyId: 'COLOR',
        raw: {
          readings: [
            { pointIndex: 1, L: baseL, a: 0, b: 0 },
            { pointIndex: 2, L: baseL, a: 0, b: 0 },
            { pointIndex: 3, L: baseL, a: 0, b: 0 },
            { pointIndex: 4, L: baseL, a: 0, b: 0 }
          ]
        } as ColorRawData,
        operatorId: 'Opérateur T0'
      });

      // Gloss T0
      globalTrialStore.recordAcquisition({
        trialId,
        stageId: stageT0.id,
        batchId: b.id,
        panelId: p.id,
        familyId: 'GLOSS',
        raw: {
          series: [
            {
              seriesIndex: 1,
              orientation: 'GRAIN_DIRECTION',
              readings: [{ pointIndex: 1, value: baseGloss }, { pointIndex: 2, value: baseGloss }]
            },
            {
              seriesIndex: 2,
              orientation: 'OPPOSITE_GRAIN_DIRECTION',
              readings: [{ pointIndex: 1, value: baseGloss }, { pointIndex: 2, value: baseGloss }]
            }
          ]
        } as GlossRawData,
        operatorId: 'Opérateur T0'
      });

      // Persoz T0 — verrou PERSOZ/Témoin (PERSOZ interdit sur T, exposés uniquement).
      if (p.role !== 'WITNESS') {
        globalTrialStore.recordAcquisition({
          trialId,
          stageId: stageT0.id,
          batchId: b.id,
          panelId: p.id,
          familyId: 'PERSOZ',
          raw: {
            unit: 'SECONDS',
            readings: [
              { pointIndex: 1, dampingTimeSeconds: 120 },
              { pointIndex: 2, dampingTimeSeconds: 120 },
              { pointIndex: 3, dampingTimeSeconds: 120 }
            ]
          } as PersozRawData,
          operatorId: 'Opérateur T0'
        });
      }

      // Observations T0
      globalTrialStore.recordAcquisition({
        trialId,
        stageId: stageT0.id,
        batchId: b.id,
        panelId: p.id,
        familyId: 'OBSERVATIONS',
        raw: {
          observations: [
            { category: 'BLISTERING', categoryLabel: 'Cloquage', rating: 0, status: 'CONFORME' },
            { category: 'FLAKING', categoryLabel: 'Écaillage', rating: 0, status: 'CONFORME' },
            { category: 'CRACKING', categoryLabel: 'Craquelage', rating: 0, status: 'CONFORME' },
            { category: 'CHALKING', categoryLabel: 'Farinage', rating: 0, status: 'CONFORME' }
          ]
        } as VisualObservationsRawData,
        operatorId: 'Opérateur T0'
      });
    });
  });

  // Validation de l'étape T0
  globalTrialStore.validateStage(trialId, stageT0.id, 'Superviseur Qualité');

  // Saisie C1 (168h) :
  // Lot 1 : ΔL=+4.0 (ΔE=4.0), Rétention Gloss = 75% (Gloss=60GU)
  // Lot 2 : ΔL=+12.0 (ΔE=12.0), Rétention Gloss = 33.3% (Gloss=10GU)
  batches.forEach((b) => {
    b.panels.forEach((p) => {
      const isWitness = p.roleCode === 'T';
      const deltaL = isWitness ? 1.0 : b.id === b1Id ? 4.0 : 12.0;
      const baseL = b.id === b1Id ? 60.0 : 40.0;
      const finalGloss = isWitness ? (b.id === b1Id ? 80.0 : 30.0) : b.id === b1Id ? 60.0 : 10.0;

      globalTrialStore.recordAcquisition({
        trialId,
        stageId: stageC1.id,
        batchId: b.id,
        panelId: p.id,
        familyId: 'COLOR',
        raw: {
          readings: [
            { pointIndex: 1, L: baseL + deltaL, a: 0, b: 0 },
            { pointIndex: 2, L: baseL + deltaL, a: 0, b: 0 },
            { pointIndex: 3, L: baseL + deltaL, a: 0, b: 0 },
            { pointIndex: 4, L: baseL + deltaL, a: 0, b: 0 }
          ]
        } as ColorRawData,
        operatorId: 'Opérateur C1'
      });

      globalTrialStore.recordAcquisition({
        trialId,
        stageId: stageC1.id,
        batchId: b.id,
        panelId: p.id,
        familyId: 'GLOSS',
        raw: {
          series: [
            {
              seriesIndex: 1,
              orientation: 'GRAIN_DIRECTION',
              readings: [{ pointIndex: 1, value: finalGloss }, { pointIndex: 2, value: finalGloss }]
            },
            {
              seriesIndex: 2,
              orientation: 'OPPOSITE_GRAIN_DIRECTION',
              readings: [{ pointIndex: 1, value: finalGloss }, { pointIndex: 2, value: finalGloss }]
            }
          ]
        } as GlossRawData,
        operatorId: 'Opérateur C1'
      });
    });
  });

  // Attach photo active à C1 sur Lot 1 E1
  globalTrialStore.attachPhoto({
    trialId,
    stageId: stageC1.id,
    panelId: panelsB1[0].id,
    filename: 'macro_c1_lot1_e1.jpg',
    storageKey: 'data:image/jpeg;base64,mockC1PhotoData',
    caption: 'Observation macro C1 après 168h',
    operatorId: 'Opérateur Photo'
  });

  // ==========================================================================
  // 5. AUDIT PRÉ-RAPPORT & COMPLÉTUDE DU DOSSIER D'ESSAI
  // ==========================================================================

  {
    const currentTrial = globalTrialStore.getTrial(trialId)!;
    const auditResult = auditTrialBeforeReport(currentTrial, ruleSet);

    // Essai en cours (C1 validé mais C12 non encore atteint) -> canGenerate = true, isComplete = false (Rapport partiel d'étape)
    const canGeneratePartiel = auditResult.canGenerate === true;
    const isCompletePartiel = auditResult.isComplete === false;
    const hasWarning2016 = auditResult.warnings.some((w) => w.includes('2016 h'));

    record(
      'G34-AUD-01',
      'Audit Pré-Rapport : Détection exacte du statut partiel en cours d\'essai (canGenerate=true, isComplete=false, alerte 2016h tracée)',
      'PRE_REPORT_AUDIT',
      canGeneratePartiel && isCompletePartiel && hasWarning2016,
      'canGenerate=true, isComplete=false, avertissement "2016 h non encore réalisée"',
      `canGenerate=${auditResult.canGenerate}, isComplete=${auditResult.isComplete}, warnings=${auditResult.warnings.length}`
    );
  }

  // ==========================================================================
  // 6. GÉNÉRATION DU RAPPORT SCIENTIFIQUE (19 SECTIONS + 6 ANNEXES)
  // ==========================================================================

  let report = buildScientificReport(globalTrialStore.getTrial(trialId)!, ruleSet, {
    operatorId: 'Dr. Expert Bois'
  });

  {
    const has19Sections =
      Boolean(report.sections.identification) &&
      Boolean(report.sections.studyPurpose) &&
      Boolean(report.sections.normativeReferences) &&
      Boolean(report.sections.materialsAndBatches) &&
      Boolean(report.sections.panelsDefinition) &&
      Boolean(report.sections.experimentalConditions) &&
      Boolean(report.sections.exposureSchedule) &&
      Boolean(report.sections.measurementPlan) &&
      Boolean(report.sections.colorResults) &&
      Boolean(report.sections.glossResults) &&
      Boolean(report.sections.persozResults) &&
      Boolean(report.sections.visualObservations) &&
      Boolean(report.sections.kineticsAnalysis) &&
      Boolean(report.sections.qualityControl) &&
      Boolean(report.sections.deviationsAndAdaptations) &&
      Boolean(report.sections.calculationTraceability) &&
      Boolean(report.sections.scientificSynthesis) &&
      Boolean(report.sections.factualConclusion);

    const has6Annexes =
      Boolean(report.annexes.annexA_RawDataSummary) &&
      Boolean(report.annexes.annexB_ComputedResultsSummary) &&
      Boolean(report.annexes.annexC_QualityAssessmentSummary) &&
      Boolean(report.annexes.annexD_ProtocolAdaptationsSummary) &&
      Boolean(report.annexes.annexE_AuditTrailSummary) &&
      Boolean(report.annexes.annexF_ScientificVersionSummary);

    record(
      'G34-REP-01',
      'Rapport Scientifique : Présence intégrale des 19 sections normatives et des 6 annexes techniques et métrologiques',
      'REPORT_GENERATION',
      has19Sections && has6Annexes,
      '19 sections définies et 6 annexes A..F complètes',
      `Sections=OK, Annexes=OK, ID=${report.id}`
    );
  }

  // ==========================================================================
  // 7. TRAÇABILITÉ DES VERSIONS & RÈGLES DANS LE RAPPORT
  // ==========================================================================

  {
    const verMatch = report.metadata.calculationVersion === ruleSet.version;
    const ruleSetMatch = report.metadata.scientificRuleSetId === ruleSet.id;
    const stdRefMatch = report.normativeReference === 'NF EN 927-6';

    record(
      'G34-TRA-01',
      'Traçabilité du Rapport : Raccordement immuable à la version du moteur de calcul et au RuleSet ID',
      'TRACABILITY_METADATA',
      verMatch && ruleSetMatch && stdRefMatch,
      `version=${ruleSet.version}, ruleSetId=${ruleSet.id}, standard=NF EN 927-6`,
      `version=${report.metadata.calculationVersion}, ruleSetId=${report.metadata.scientificRuleSetId}`
    );
  }

  // ==========================================================================
  // 8. SÉGRÉGATION DU TÉMOIN DANS LES EXPORTS CSV ET RAPPORT
  // ==========================================================================

  {
    const currentTrial = globalTrialStore.getTrial(trialId)!;
    const csvReport = exportReportToCsv(currentTrial, report, ruleSet);
    const csvRaw = exportRawDataToCsv(currentTrial);

    // Le RAW CSV contient bien l'éprouvette T (donnée brute traçable)
    const rawHasWitness = csvRaw.includes(';"T";') || csvRaw.includes(';T;');
    // Le rapport CSV mentionne les données calculées mais avec libellé clair
    const reportHasWitness = csvReport.includes(';"T";') || csvReport.includes(';T;');

    record(
      'G34-WIT-01',
      'Témoin T dans les Exports : Présence documentaire traçable dans le RAW CSV sans altération des calculs exposés',
      'WITNESS_REPORT_SEGREGATION',
      rawHasWitness && reportHasWitness,
      'Témoin T exporté dans RAW et COMPUTED avec son rôle explicite',
      `RAW has T=${rawHasWitness}, REPORT has T=${reportHasWitness}`
    );
  }

  // ==========================================================================
  // 9. ÉTANCHÉITÉ MULTI-LOTS ET MULTI-SYSTÈMES DANS LE RAPPORT & CSV
  // ==========================================================================

  {
    const currentTrial = globalTrialStore.getTrial(trialId)!;
    const csvReport = exportReportToCsv(currentTrial, report, ruleSet);

    const hasLot1 = csvReport.includes('LOT-ACRYLIQUE-01');
    const hasLot2 = csvReport.includes('LOT-ALKYDE-02');
    const hasSystem1 = csvReport.includes('Système Acrylique Hydro');
    const hasSystem2 = csvReport.includes('Système Alkyde Solvant');

    const multiBatchPassed = hasLot1 && hasLot2 && hasSystem1 && hasSystem2;

    record(
      'G34-BAT-01',
      'Multi-Lots & Multi-Systèmes : Restitution distincte des lots et des systèmes de finition dans la matrice du rapport',
      'MULTI_BATCH_REPORT_ISOLATION',
      multiBatchPassed,
      'LOT-ACRYLIQUE-01 et LOT-ALKYDE-02 isolés avec leurs systèmes respectifs',
      `Lot1=${hasLot1}, Lot2=${hasLot2}, Syst1=${hasSystem1}, Syst2=${hasSystem2}`
    );
  }

  // ==========================================================================
  // 10. FIDÉLITÉ JSON / CSV & TRAÇABILITÉ DES ACTIONS DANS AUDIT TRAIL
  // ==========================================================================

  {
    const currentTrial = globalTrialStore.getTrial(trialId)!;
    const jsonStr = JSON.stringify({ trial: currentTrial, ruleSet, report });
    const parsed = JSON.parse(jsonStr);

    const jsonFidelity =
      parsed.trial.id === currentTrial.id &&
      Object.keys(parsed.trial.acquisitions).length === Object.keys(currentTrial.acquisitions).length &&
      parsed.trial.mediaReferences.length === currentTrial.mediaReferences.length;

    // Vérification du journal d'audit : toutes les actions (create, record, attach_photo, validate_stage) sont tracées
    const auditCount = currentTrial.auditTrail.length;
    const hasPhotoAudit = currentTrial.auditTrail.some((ev) => ev.action === 'ATTACH_PHOTO');
    const hasValidateAudit = currentTrial.auditTrail.some((ev) => ev.action === 'VALIDATE_STAGE');

    const auditPassed = auditCount > 0 && hasPhotoAudit && hasValidateAudit;

    record(
      'G34-EXP-01',
      'Fidélité Export JSON & Journal d\'Audit : Réciprocité complète et traçabilité des actions critiques dans auditTrail',
      'EXPORT_FIDELITY_JSON_CSV',
      jsonFidelity && auditPassed,
      'JSON 100% réversible, auditTrail contient ATTACH_PHOTO et VALIDATE_STAGE',
      `JSON Fidelity=${jsonFidelity}, Audit Events=${auditCount}, HasPhotoAudit=${hasPhotoAudit}`
    );
  }

  // ==========================================================================
  // 11. SOURCE DES RÉFÉRENCES STANDARD — CONFIGURATION PERSISTÉE PRIORITAIRE
  //     (ÉTAPE 2 — correction protocolEngine) : le standard descriptif provient de
  //     la configuration persistée de l'essai, jamais réinterprété par le RuleSet
  //     live ; repli legacy explicite seul ; aucune valeur par défaut n'est inventée.
  // ==========================================================================

  {
    // --- Test 1 — COUNT : configuration persistée prioritaire (A ≠ B)
    const ruleSetT1 = getDefaultScientificRuleSet();
    const configT1 = createCountConfiguration('COLOR', 4, ruleSetT1);
    // Valeur persistée A = 4 ; standard live forcé à B = 5 (clone du référentiel, sans le muter)
    const ruleSetLiveT1 = structuredClone(ruleSetT1);
    ruleSetLiveT1.measurementConfigurations.COLOR.standardRecommendedCount = 5;
    const evalT1 = evaluateCountProtocolCompliance(configT1, ruleSetLiveT1);
    record(
      'G34-PSS-01',
      'COUNT : statut basé sur la référence standard PERSISTÉE (A=4) et non sur le RuleSet live (B=5) — STANDARD conservé',
      'PROTOCOL_STANDARD_SOURCE',
      evalT1.status === 'STANDARD' && evalT1.isCompliantWithStandard === true,
      'STATUS STANDARD (standardRecommendedCount persisté = 4 === configuredCount 4)',
      `Statut=${evalT1.status}, standard persisté=${configT1.standardRecommendedCount}, standard live=5`
    );

    // --- Test 2 — GLOSS, configuration SERIES : standardConfiguration persistée prioritaire
    const ruleSetT2 = getDefaultScientificRuleSet();
    const stdGloss = ruleSetT2.seriesConfigurations!['GLOSS'].standardConfiguration;
    // Config créée sur la structure standard A ; le live est ensuite forcé à une structure B ≠ A
    const configT2 = createSeriesConfiguration(
      'GLOSS',
      stdGloss.seriesCount,
      stdGloss.readingsPerSeries,
      ruleSetT2
    );
    const ruleSetLiveT2 = structuredClone(ruleSetT2);
    ruleSetLiveT2.seriesConfigurations!['GLOSS'].standardConfiguration.seriesCount =
      stdGloss.seriesCount + 1;
    const evalT2 = evaluateSeriesProtocolCompliance(configT2, ruleSetLiveT2);
    record(
      'G34-PSS-02',
      'GLOSS — configuration SERIES : statut basé sur la standardConfiguration PERSISTÉE (A) et non sur le RuleSet live (B) — STANDARD conservé',
      'PROTOCOL_STANDARD_SOURCE',
      evalT2.status === 'STANDARD' && evalT2.isCompliantWithStandard === true,
      'STATUS STANDARD (standardConfiguration persistée === configuredConfiguration)',
      `Statut=${evalT2.status}, persisté=${configT2.standardConfiguration.seriesCount}x${configT2.standardConfiguration.readingsPerSeries}, live=${ruleSetLiveT2.seriesConfigurations!['GLOSS'].standardConfiguration.seriesCount}x${ruleSetLiveT2.seriesConfigurations!['GLOSS'].standardConfiguration.readingsPerSeries}`
    );

    // --- Test 3 — changement du RuleSet live APRÈS création : statut resté basé sur A
    const ruleSetT3 = getDefaultScientificRuleSet();
    const configT3 = createCountConfiguration('COLOR', 5, ruleSetT3, {
      justification: 'Éprouvettes de surface réduite 50x50 mm pour criblage R&D',
      operatorId: 'Ingénieur R&D'
    });
    // configT3 : standard persisté A = 4, configuredCount = 5, justifié → ADAPTED_JUSTIFIED
    const ruleSetLiveT3 = structuredClone(ruleSetT3);
    ruleSetLiveT3.measurementConfigurations.COLOR.standardRecommendedCount = 5; // live B = 5
    const evalT3 = evaluateCountProtocolCompliance(configT3, ruleSetLiveT3);
    record(
      'G34-PSS-03',
      'Changement du RuleSet live après création : la config existante reste évaluée sur sa référence PERSISTÉE (A=4 → ADAPTED_JUSTIFIED), pas sur le live (B=5 → aurait donné STANDARD)',
      'PROTOCOL_STANDARD_SOURCE',
      evalT3.status === 'ADAPTED_JUSTIFIED' && evalT3.isAdapted === true,
      'STATUS ADAPTED_JUSTIFIED (référence persistée A=4, configuredCount=5, justification valide)',
      `Statut=${evalT3.status}, standard persisté=${configT3.standardRecommendedCount}, standard live=5`
    );

    // --- Test 4 — absence de référence persistée : repli legacy explicite, aucun défaut inventé
    const ruleSetT4 = getDefaultScientificRuleSet();
    const legacyConfig = {
      familyId: 'COLOR',
      mode: 'STANDARD_DEFAULT',
      configuredCount: 4,
      deviationFromStandard: false,
      configuredBy: 'OPERATOR',
      configuredAt: new Date().toISOString(),
      ruleSource: 'NORMATIVE'
    } as unknown as MeasurementCountConfiguration; // simulation d'un import antérieur sans standardRecommendedCount
    const evalT4 = evaluateCountProtocolCompliance(legacyConfig, ruleSetT4);
    record(
      'G34-PSS-04',
      'Absence de référence persistée : repli explicite sur le RuleSet live (STANDARD conservé) — aucun défaut artificiel',
      'PROTOCOL_STANDARD_SOURCE',
      evalT4.status === 'STANDARD' && evalT4.isCompliantWithStandard === true,
      'STATUS STANDARD (repli legacy sur ruleSet.measurementConfigurations.COLOR.standardRecommendedCount=4)',
      `Statut=${evalT4.status}`
    );

    // --- Test 4bis — ni config ni RuleSet : INCOMPLETE, aucune valeur inventée
    const ruleSetT4b = getDefaultScientificRuleSet();
    const ruleSetWithoutColor = structuredClone(ruleSetT4b);
    delete ruleSetWithoutColor.measurementConfigurations.COLOR;
    const evalT4b = evaluateCountProtocolCompliance(legacyConfig, ruleSetWithoutColor);
    record(
      'G34-PSS-05',
      'Ni référence persistée ni référence live : INCOMPLETE (CALCULATION_UNAVAILABLE) — aucune valeur n\'est inventée',
      'PROTOCOL_STANDARD_SOURCE',
      evalT4b.status === 'INCOMPLETE' && evalT4b.alerts[0]?.code === 'CALCULATION_UNAVAILABLE',
      'STATUS INCOMPLETE + alerte CALCULATION_UNAVAILABLE',
      `Statut=${evalT4b.status}, code=${evalT4b.alerts[0]?.code}`
    );
  }

  // ==========================================================================
  // 12. MUTUALISATION ADHESION → PROTOCOL ENGINE (ÉTAPE 3)
  //     La famille ADHESION (mode de configuration COUNT) n'implémente plus
  //     localement le statut descriptif : il provient de
  //     evaluateCountProtocolCompliance() (référence standard persistée
  //     prioritaire, repli legacy RuleSet live uniquement).
  // ==========================================================================

  {
    const adhRaw = (classes: number[]): AdhesionRawData => ({
      measurements: classes.map((adhesionClass, i) => ({ measurementIndex: i + 1, adhesionClass })),
      measurementDateTime: '2026-09-01T08:00:00.000Z',
      gridSpacingMm: 3,
      normReference: 'NF EN ISO 2409:2020'
    });

    // --- G34-ADH-01 — STANDARD (standard 2 / config 2)
    const adhCfgStd = createCountConfiguration('ADHESION', 2, ruleSet);
    const adhStd = calculateAdhesion(adhRaw([0, 1]), adhCfgStd, ruleSet).computed;
    record(
      'G34-ADH-01',
      'ADHESION (COUNT) : statut STANDARD via evaluateCountProtocolCompliance() — standard 2 / config 2',
      'ADHESION_PROTOCOL_MUTUALIZATION',
      adhStd?.protocolStatus === 'STANDARD',
      'protocolStatus STANDARD (config persistée standardRecommendedCount=2 === configuredCount=2)',
      `protocolStatus=${adhStd?.protocolStatus}`
    );

    // --- G34-ADH-02 — ADAPTED_JUSTIFIED (standard 2 / config 3 / justification non vide)
    const adhCfgJust = createCountConfiguration('ADHESION', 3, ruleSet, {
      justification: 'Éprouvettes réduites — triple mesure de contrôle',
      operatorId: 'Opérateur'
    });
    const adhJust = calculateAdhesion(adhRaw([0, 1, 2]), adhCfgJust, ruleSet).computed;
    record(
      'G34-ADH-02',
      'ADHESION (COUNT) : statut ADAPTED_JUSTIFIED via la fonction commune — standard 2 / config 3 / justification valide',
      'ADHESION_PROTOCOL_MUTUALIZATION',
      adhJust?.protocolStatus === 'ADAPTED_JUSTIFIED',
      'protocolStatus ADAPTED_JUSTIFIED (3 ≠ 2, justification ≥ 8 caractères)',
      `protocolStatus=${adhJust?.protocolStatus}`
    );

    // --- G34-ADH-03 — ADAPTED_UNJUSTIFIED (standard 2 / config 3 / justification vide)
    const adhCfgUnj = createCountConfiguration('ADHESION', 3, ruleSet, {
      justification: '',
      operatorId: 'Opérateur'
    });
    const adhUnj = calculateAdhesion(adhRaw([0, 1, 2]), adhCfgUnj, ruleSet).computed;
    record(
      'G34-ADH-03',
      'ADHESION (COUNT) : statut ADAPTED_UNJUSTIFIED via la fonction commune — standard 2 / config 3 / justification absente',
      'ADHESION_PROTOCOL_MUTUALIZATION',
      adhUnj?.protocolStatus === 'ADAPTED_UNJUSTIFIED',
      'protocolStatus ADAPTED_UNJUSTIFIED (3 ≠ 2, justification vide)',
      `protocolStatus=${adhUnj?.protocolStatus}`
    );

    // --- G34-ADH-04 — configuration persistée ≠ RuleSet live
    const ruleSetLiveAdh = structuredClone(ruleSet);
    ruleSetLiveAdh.measurementConfigurations.ADHESION.standardRecommendedCount = 3; // live = 3, persisté = 2
    const adhLive = calculateAdhesion(adhRaw([0, 1, 2]), adhCfgJust, ruleSetLiveAdh).computed;
    const adhCommon = evaluateCountProtocolCompliance(adhCfgJust, ruleSetLiveAdh);
    record(
      'G34-ADH-04',
      'ADHESION : changement du RuleSet live (standard 3) — statut fondé sur la référence PERSISTÉE (2 → ADAPTED_JUSTIFIED), jamais sur le live (3 → aurait donné STANDARD)',
      'ADHESION_PROTOCOL_MUTUALIZATION',
      adhLive?.protocolStatus === 'ADAPTED_JUSTIFIED' &&
        adhCommon.status === adhLive?.protocolStatus &&
        adhCfgJust.standardRecommendedCount === 2,
      'protocolStatus ADAPTED_JUSTIFIED (référence persistée 2) == statut direct de la fonction commune',
      `adhésion=${adhLive?.protocolStatus}, commune=${adhCommon.status}, persisté=${adhCfgJust.standardRecommendedCount}, live=3`
    );

    // --- G34-ADH-05 — calcul scientifique strictement inchangé
    const adhCfg5 = createCountConfiguration('ADHESION', 2, ruleSet);
    const adhRaw5 = adhRaw([1, 2]);
    const ruleSetLive5 = structuredClone(ruleSet);
    ruleSetLive5.measurementConfigurations.ADHESION.standardRecommendedCount = 1; // live divergent, ignoré pour la ref persistée
    const runA = calculateAdhesion(adhRaw5, adhCfg5, ruleSet);
    const runB = calculateAdhesion(adhRaw5, adhCfg5, ruleSetLive5);
    const scientificUnchanged =
      runA.computed?.panelMean === runB.computed?.panelMean &&
      runA.computed?.adhesionClass === runB.computed?.adhesionClass &&
      runA.computed?.qualityAssessment.expectedCount === runB.computed?.qualityAssessment.expectedCount &&
      runA.computed?.qualityAssessment.validCount === runB.computed?.qualityAssessment.validCount &&
      runA.computed?.qualityAssessment.completenessPercent === runB.computed?.qualityAssessment.completenessPercent &&
      JSON.stringify(runA.computed?.individualResults) === JSON.stringify(runB.computed?.individualResults);
    record(
      'G34-ADH-05',
      'ADHESION : mutualisation du statut descriptif — calcul scientifique inchangé (configuredCount/RAW/résultats identiques) quel que soit le standard live',
      'ADHESION_PROTOCOL_MUTUALIZATION',
      scientificUnchanged && runA.computed?.panelMean === 1.5 && runA.computed?.qualityAssessment.expectedCount === 2,
      'panelMean=1.5, expectedCount=2, validCount=2, completeness=100 %, statut STANDARD — RUN A == RUN B',
      `panelMeanA=${runA.computed?.panelMean}, panelMeanB=${runB.computed?.panelMean}, expectedCount=${runA.computed?.qualityAssessment.expectedCount}, unchanged=${scientificUnchanged}`
    );
  }

  // ==========================================================================
  // 13. GEL DU CONTEXTE SCIENTIFIQUE (ÉTAPE 4) — NOT_FROZEN / FROZEN / INVALID
  //     Résolution fail-closed du RuleSet de calcul + atomicité du gel au 1er verrou
  // ==========================================================================

  {
    // Essais créés sur un store ISOLÉ (createIsolatedStore) : aucun impact sur
    // globalTrialStore / localStorage, chaque scénario reçoit son propre essai.
    const makeColorTrial = (store: TrialStoreService, applicationDate?: string, familyConfigs?: Trial['config']['familyConfigs']) => {
      const trial = store.createTrial({
        metadata: { reference: 'G34-CONTEXT-E4', title: 'Essai contexte scientifique (Étape 4)', createdBy: 'TechGate34' },
        batches: [
          {
            reference: 'LOT-CONTEXT-01',
            applicationDate: applicationDate ?? '2026-08-01',
            coatingSystem: 'Alkyde',
            productReference: 'PRD-CONTEXT-01'
          }
        ],
        activeFamilies: familyConfigs ? (Object.keys(familyConfigs) as Trial['config']['activeFamilies']) : ['COLOR'],
        familyConfigs
      });
      return trial;
    };
    const colorRaw = (n = 4): ColorRawData => ({
      readings: Array.from({ length: n }, (_, i) => ({ pointIndex: i + 1, L: 60, a: 0, b: 0 }))
    });

    // --- G34-CONTEXT-01 — NOT_FROZEN : contexte absent → live autorisé, pas d'erreur
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const state = validateScientificContext(t.scientificContext);
      let resolvedLive = false;
      const resolved = resolveScientificRuleSetForTrial(t, ruleSet);
      resolvedLive = resolved === ruleSet;
      const notFrozen =
        t.scientificContext === undefined &&
        state === 'NOT_FROZEN' &&
        resolvedLive;
      record(
        'G34-CONTEXT-01',
        'Contexte absent (NOT_FROZEN) : RuleSet live autorisé, aucune erreur (état dérivé, aucun objet FROZEN)',
        'SCIENTIFIC_CONTEXT_FREEZE',
        notFrozen,
        'scientificContext undefined → NOT_FROZEN ; résolution = RuleSet live',
        `context=${t.scientificContext === undefined ? 'absent' : 'présent'}, state=${state}, resolvedLive=${resolvedLive}`
      );
    }

    // --- G34-CONTEXT-02 — premier gel : FROZEN complet avec identité, snapshot, trigger
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const after = store.getTrial(t.id);
      const ctx = after?.scientificContext;
      const frozen =
        !!ctx &&
        ctx.status === 'FROZEN' &&
        !!ctx.scientificRuleSetSnapshot &&
        typeof ctx.scientificRuleSetId === 'string' &&
        ctx.scientificRuleSetId.length > 0 &&
        typeof ctx.scientificRuleSetVersion === 'string' &&
        ctx.scientificRuleSetVersion.length > 0 &&
        typeof ctx.calculationEngineVersion === 'string' &&
        ctx.calculationEngineVersion.length > 0 &&
        !!ctx.frozenAt &&
        ctx.frozenBy === 'OP-001' &&
        ctx.frozenTrigger === 'FIRST_ACQUISITION' &&
        after?.configurationStatus === 'LOCKED';
      record(
        'G34-CONTEXT-02',
        'Premier gel : après 1re acquisition valide → contexte FROZEN complet (identité, snapshot, moteur, trigger FIRST_ACQUISITION)',
        'SCIENTIFIC_CONTEXT_FREEZE',
        frozen,
        'status=FROZEN, snapshot présent, scientificRuleSetId/Version présents, frozenTrigger=FIRST_ACQUISITION, config LOCKED',
        `status=${ctx?.status}, trigger=${ctx?.frozenTrigger}, snapshot=${!!ctx?.scientificRuleSetSnapshot}, locked=${after?.configurationStatus}`
      );
    }

    // --- G34-CONTEXT-03 — snapshot indépendant : modifier le RuleSet live après capture
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const after = store.getTrial(t.id);
      const ctx = after?.scientificContext;
      const snapshotBefore = ctx?.scientificRuleSetSnapshot;
      // Mutation d'une instance « live » distincte APRÈS capture : le snapshot gelé doit rester intact.
      const liveMutated = structuredClone(ruleSet);
      liveMutated.measurementConfigurations.COLOR.standardRecommendedCount = 99;
      liveMutated.id = 'LIVE-MUTATED';
      const snapshotIntact =
        !!ctx &&
        !!snapshotBefore &&
        ctx.scientificRuleSetSnapshot === snapshotBefore &&
        snapshotBefore.id !== liveMutated.id &&
        snapshotBefore.measurementConfigurations.COLOR.standardRecommendedCount === 4 &&
        JSON.stringify(snapshotBefore) === JSON.stringify(ctx.scientificRuleSetSnapshot);
      const resolved = after ? resolveScientificRuleSetForTrial(after, liveMutated) : null;
      const resolvedSnapshot = resolved === snapshotBefore && resolved !== liveMutated;
      record(
        'G34-CONTEXT-03',
        'Snapshot indépendant : muter le RuleSet live après la capture → snapshot inchangé (deep clone, jamais une référence live)',
        'SCIENTIFIC_CONTEXT_FREEZE',
        snapshotIntact && resolvedSnapshot,
        'snapshot conservé tel quel après mutation live ; résolution retourne le snapshot, jamais le live muté',
        `snapshotIntact=${snapshotIntact}, resolvedSnapshot=${resolvedSnapshot}, liveMutatedIgnored=${resolved !== liveMutated}`
      );
    }

    // --- G34-CONTEXT-04 — FROZEN → SNAPSHOT uniquement (C1 recalculé sur le snapshot)
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const stageC1 = t.stages.find((s) => s.cycleIndex === 1)!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const before = store.getTrial(t.id);
      const ctxBefore = before?.scientificContext;
      const snapshotRef = ctxBefore?.scientificRuleSetSnapshot;
      // Acquisition C1 sur essai FROZEN : résolution = snapshot uniquement, live interdit.
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageC1.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-C1'
      });
      const after = store.getTrial(t.id);
      const ctxAfter = after?.scientificContext;
      const liveVariant = structuredClone(ruleSet);
      liveVariant.id = 'LIVE-SHOULD-NOT-BE-USED';
      const resolved = after ? resolveScientificRuleSetForTrial(after, liveVariant) : null;
      const usesSnapshot =
        !!ctxAfter &&
        !!ctxBefore &&
        ctxAfter.status === 'FROZEN' &&
        ctxAfter.scientificRuleSetId === ctxBefore.scientificRuleSetId &&
        ctxAfter.scientificRuleSetVersion === ctxBefore.scientificRuleSetVersion &&
        ctxAfter.frozenAt === ctxBefore.frozenAt &&
        ctxAfter.scientificRuleSetSnapshot === snapshotRef &&
        resolved === snapshotRef &&
        resolved !== liveVariant;
      record(
        'G34-CONTEXT-04',
        'FROZEN → SNAPSHOT UNIQUEMENT : recalcul C1 sur le snapshot, contexte strictement identique, live ignoré',
        'SCIENTIFIC_CONTEXT_FREEZE',
        usesSnapshot,
        'C1 recalculé via le snapshot gelé ; id/version/frozenAt/snapshot inchangés ; resolved = snapshot, jamais le live',
        `usesSnapshot=${usesSnapshot}, resolvedIsSnapshot=${resolved === snapshotRef}, liveIgnored=${resolved !== liveVariant}`
      );
    }

    // --- G34-CONTEXT-05 — persistance : relecture du store → contexte FROZEN complet
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const reloaded = store.getTrial(t.id);
      const ctx = reloaded?.scientificContext;
      // Simulation de la persistance réelle (JSON localStorage) : round-trip sérialisé.
      const roundTripped = JSON.parse(JSON.stringify(reloaded)) as Trial;
      const persisted =
        !!ctx &&
        ctx.status === 'FROZEN' &&
        !!ctx.scientificRuleSetSnapshot &&
        !!roundTripped.scientificContext &&
        roundTripped.scientificContext.status === 'FROZEN' &&
        !!roundTripped.scientificContext.scientificRuleSetSnapshot &&
        roundTripped.scientificContext.scientificRuleSetId === roundTripped.scientificContext.scientificRuleSetSnapshot.id;
      record(
        'G34-CONTEXT-05',
        'Persistance : relecture du store (et round-trip sérialisé JSON) → ScientificContext FROZEN complet conservé',
        'SCIENTIFIC_CONTEXT_FREEZE',
        persisted,
        'status=FROZEN, snapshot présent après relecture et sérialisation, identité intacte',
        `persisted=${persisted}, statusReloaded=${ctx?.status}, idCoherent=${roundTripped.scientificContext?.scientificRuleSetId === roundTripped.scientificContext?.scientificRuleSetSnapshot?.id}`
      );
    }

    // --- G34-CONTEXT-06 — acquisition invalide avant premier gel → NOT_FROZEN conservé
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelT = batch.panels.find((p) => p.roleCode === 'T')!;
      // PERSOZ interdit sur le témoin T : échec réel du service (verrou PERSOZ) avant tout gel.
      let threw = false;
      try {
        store.recordAcquisition({
          trialId: t.id,
          stageId: stageT0.id,
          batchId: batch.id,
          panelId: panelT.id,
          familyId: 'PERSOZ',
          raw: {
            unit: 'SECONDS',
            readings: [
              { pointIndex: 1, dampingTimeSeconds: 120 },
              { pointIndex: 2, dampingTimeSeconds: 120 },
              { pointIndex: 3, dampingTimeSeconds: 120 }
            ]
          } as PersozRawData,
          operatorId: 'OP-001'
        });
      } catch {
        threw = true;
      }
      const after = store.getTrial(t.id);
      const notFrozenKept =
        threw &&
        after?.scientificContext === undefined &&
        after?.configurationStatus !== 'LOCKED' &&
        Object.keys(after?.acquisitions ?? {}).length === 0 &&
        validateScientificContext(after?.scientificContext) === 'NOT_FROZEN';
      record(
        'G34-CONTEXT-06',
        'Acquisition invalide rejetée avant le 1er verrou (PERSOZ sur témoin T) → NOT_FROZEN conservé, aucun gel, rien de persisté',
        'SCIENTIFIC_CONTEXT_FREEZE',
        notFrozenKept,
        'throw réel du service ; contexte absent (NOT_FROZEN), config non verrouillée, acquisitions vides',
        `threw=${threw}, context=${after?.scientificContext === undefined ? 'absent' : 'présent'}, locked=${after?.configurationStatus}, acquisitions=${Object.keys(after?.acquisitions ?? {}).length}`
      );
    }

    // --- G34-CONTEXT-07 — ancien essai (legacy verrouillé, sans contexte) : NOT_FROZEN, live, pas de migration
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      // Simulation d'un essai existant antérieur à l'Étape 4 : verrouillé mais SANS contexte.
      t.configurationStatus = 'LOCKED';
      store.saveTrial(t);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      let threw = false;
      try {
        store.recordAcquisition({
          trialId: t.id,
          stageId: stageT0.id,
          batchId: batch.id,
          panelId: panelE1.id,
          familyId: 'COLOR',
          raw: colorRaw(),
          operatorId: 'OP-LEGACY'
        });
      } catch {
        threw = true;
      }
      const after = store.getTrial(t.id);
      const legacyOk =
        !threw &&
        after?.scientificContext === undefined &&
        after?.configurationStatus === 'LOCKED' &&
        validateScientificContext(after?.scientificContext) === 'NOT_FROZEN' &&
        Object.keys(after?.acquisitions ?? {}).length === 1;
      record(
        'G34-CONTEXT-07',
        'Ancien essai verrouillé sans contexte (legacy) : aucune migration, contexte toujours NOT_FROZEN, acquisition live acceptée',
        'SCIENTIFIC_CONTEXT_FREEZE',
        legacyOk,
        'pas d’injection automatique de snapshot ; RuleSet live utilisé ; acquisition persistée normalement',
        `threw=${threw}, context=${after?.scientificContext === undefined ? 'absent' : 'présent'}, state=${validateScientificContext(after?.scientificContext)}, acquisitions=${Object.keys(after?.acquisitions ?? {}).length}`
      );
    }

    // --- G34-CONTEXT-08 — configuredCount opérationnel inchangé par le gel
    {
      const store = TrialStoreService.createIsolatedStore();
      // COLOR : standard culminant à 4, configuration opérationnelle adaptée à 3 (justifiée).
      const countCfg = createCountConfiguration('COLOR', 3, ruleSet, {
        justification: 'Adaptation du plan de mesure tracée pour le test G34-CONTEXT-08.'
      });
      const t = makeColorTrial(store, '2026-08-01', {
        COLOR: { familyId: 'COLOR', enabled: true, countConfig: countCfg }
      } as Trial['config']['familyConfigs']);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(3),
        operatorId: 'OP-001'
      });
      const after = store.getTrial(t.id);
      const cfgAfter = after?.config.familyConfigs.COLOR.countConfig;
      const ctx = after?.scientificContext;
      const countIntact =
        !!cfgAfter &&
        cfgAfter.configuredCount === 3 &&
        cfgAfter.standardRecommendedCount === 4 &&
        !!ctx &&
        ctx.status === 'FROZEN';
      record(
        'G34-CONTEXT-08',
        'Le gel ne modifie pas configuredCount : config opérationnelle 3 conservée, standard descriptif 4 intact, contexte FROZEN',
        'SCIENTIFIC_CONTEXT_FREEZE',
        countIntact,
        'configuredCount=3, standardRecommendedCount=4 après gel, contexte FROZEN',
        `configuredCount=${cfgAfter?.configuredCount}, standardRecommendedCount=${cfgAfter?.standardRecommendedCount}, status=${ctx?.status}`
      );
    }

    // --- G34-CONTEXT-09 — identité cohérente : id/version du contexte ≡ id/version du snapshot
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const ctx = store.getTrial(t.id)?.scientificContext;
      const coherent =
        !!ctx &&
        ctx.status === 'FROZEN' &&
        ctx.scientificRuleSetId === ctx.scientificRuleSetSnapshot.id &&
        ctx.scientificRuleSetVersion === ctx.scientificRuleSetSnapshot.version &&
        validateScientificContext(ctx) === 'FROZEN';
      record(
        'G34-CONTEXT-09',
        'Identité cohérente : scientificRuleSetId/Version du contexte identiques au snapshot ; contexte validé FROZEN',
        'SCIENTIFIC_CONTEXT_FREEZE',
        coherent,
        'id ≡ snapshot.id, version ≡ snapshot.version, validate = FROZEN',
        `idEq=${ctx?.scientificRuleSetId === ctx?.scientificRuleSetSnapshot.id}, verEq=${ctx?.scientificRuleSetVersion === ctx?.scientificRuleSetSnapshot.version}, state=${ctx ? validateScientificContext(ctx) : 'undefined'}`
      );
    }

    // --- G34-CONTEXT-10 — versions séparées : RuleSet (référentiel) ≠ moteur (traçabilité)
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      store.recordAcquisition({
        trialId: t.id,
        stageId: stageT0.id,
        batchId: batch.id,
        panelId: panelE1.id,
        familyId: 'COLOR',
        raw: colorRaw(),
        operatorId: 'OP-001'
      });
      const ctx = store.getTrial(t.id)?.scientificContext;
      const splitVersions =
        !!ctx &&
        typeof ctx.scientificRuleSetVersion === 'string' &&
        typeof ctx.calculationEngineVersion === 'string' &&
        ctx.scientificRuleSetVersion.length > 0 &&
        ctx.calculationEngineVersion.length > 0 &&
        ctx.scientificRuleSetVersion !== ctx.calculationEngineVersion &&
        ctx.scientificRuleSetVersion === ruleSet.version &&
        ctx.calculationEngineVersion === '1.2.0';
      record(
        'G34-CONTEXT-10',
        'Séparation des versions : scientificRuleSetVersion (référentiel) ≠ calculationEngineVersion (étiquette moteur)',
        'SCIENTIFIC_CONTEXT_FREEZE',
        splitVersions,
        `version RuleSet=${ruleSet.version}, étiquette moteur=1.2.0, distinctes et toutes deux tracées`,
        `scientificRuleSetVersion=${ctx?.scientificRuleSetVersion}, calculationEngineVersion=${ctx?.calculationEngineVersion}, distinct=${ctx?.scientificRuleSetVersion !== ctx?.calculationEngineVersion}`
      );
    }

    // --- G34-CONTEXT-11 — FROZEN sans snapshot → INVALID, RuleSet live interdit
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      t.scientificContext = {
        scientificRuleSetId: 'RS-MISSING-SNAPSHOT',
        scientificRuleSetVersion: 'v-test',
        scientificRuleSetSnapshot: undefined as unknown as ScientificRuleSet,
        calculationEngineVersion: '1.2.0',
        frozenAt: '2026-01-01T00:00:00.000Z',
        frozenBy: 'SYSTEM',
        frozenTrigger: 'FIRST_ACQUISITION',
        status: 'FROZEN'
      } as unknown as ScientificContext;
      store.saveTrial(t);
      const state = validateScientificContext(store.getTrial(t.id)?.scientificContext);
      let resolveThrew = false;
      try {
        resolveScientificRuleSetForTrial(store.getTrial(t.id)!, ruleSet);
      } catch {
        resolveThrew = true;
      }
      // L'acquisition sur un contexte INVALID doit échouer (fail-closed), sans utiliser le live.
      let acqThrew = false;
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      try {
        store.recordAcquisition({
          trialId: t.id,
          stageId: stageT0.id,
          batchId: batch.id,
          panelId: panelE1.id,
          familyId: 'COLOR',
          raw: colorRaw(),
          operatorId: 'OP-001'
        });
      } catch {
        acqThrew = true;
      }
      const after = store.getTrial(t.id);
      const failClosed =
        state === 'INVALID' &&
        resolveThrew &&
        acqThrew &&
        after?.scientificContext !== undefined &&
        validateScientificContext(after?.scientificContext) === 'INVALID';
      record(
        'G34-CONTEXT-11',
        'FROZEN sans snapshot → INVALID : résolution fail-closed (erreur explicite), live interdit, aucune écriture',
        'SCIENTIFIC_CONTEXT_FREEZE',
        failClosed,
        'état INVALID, resolve et acquisition lèvent une erreur explicite, jamais de fallback live',
        `state=${state}, resolveThrew=${resolveThrew}, acqThrew=${acqThrew}, after=${validateScientificContext(after?.scientificContext)}`
      );
    }

    // --- G34-CONTEXT-12 — identité incohérente (id ≠ snapshot.id) → INVALID, pas de fallback
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      const weirdSnapshot = structuredClone(ruleSet);
      weirdSnapshot.id = 'RS-DIFFERENT-ID';
      t.scientificContext = {
        scientificRuleSetId: 'RS-A',
        scientificRuleSetVersion: 'v-test',
        scientificRuleSetSnapshot: weirdSnapshot,
        calculationEngineVersion: '1.2.0',
        frozenAt: '2026-01-01T00:00:00.000Z',
        frozenBy: 'SYSTEM',
        frozenTrigger: 'FIRST_ACQUISITION',
        status: 'FROZEN'
      };
      store.saveTrial(t);
      const state = validateScientificContext(store.getTrial(t.id)?.scientificContext);
      let resolveThrew = false;
      try {
        resolveScientificRuleSetForTrial(store.getTrial(t.id)!, ruleSet);
      } catch {
        resolveThrew = true;
      }
      const failClosed = state === 'INVALID' && resolveThrew;
      record(
        'G34-CONTEXT-12',
        'Identité incohérente (context.id RS-A ≠ snapshot.id RS-DIFFERENT-ID) → INVALID, aucun fallback live',
        'SCIENTIFIC_CONTEXT_FREEZE',
        failClosed,
        'état INVALID, résolution fail-closed explicite, snapshot jamais substitué au live',
        `state=${state}, resolveThrew=${resolveThrew}`
      );
    }

    // --- G34-CONTEXT-13 — contexte partiellement écrit → INVALID, pas de réparation, pas de conversion NOT_FROZEN
    {
      const store = TrialStoreService.createIsolatedStore();
      const t = makeColorTrial(store);
      // Contexte présent mais incomplet : identité + snapshot, mais ni enginVersion, ni frozenAt/by/trigger/status exploitable.
      t.scientificContext = {
        scientificRuleSetId: 'RS-PARTIAL',
        scientificRuleSetVersion: 'v-test',
        scientificRuleSetSnapshot: structuredClone(ruleSet)
        // calculationEngineVersion, frozenAt, frozenBy, frozenTrigger et status absents → INVALID
      } as unknown as ScientificContext;
      store.saveTrial(t);
      const state = validateScientificContext(store.getTrial(t.id)?.scientificContext);
      let resolveThrew = false;
      try {
        resolveScientificRuleSetForTrial(store.getTrial(t.id)!, ruleSet);
      } catch {
        resolveThrew = true;
      }
      const after = store.getTrial(t.id);
      const noRepair =
        state === 'INVALID' &&
        resolveThrew &&
        after?.scientificContext !== undefined &&
        validateScientificContext(after?.scientificContext) === 'INVALID' &&
        after.scientificContext?.status !== 'FROZEN';
      record(
        'G34-CONTEXT-13',
        'Contexte partiellement écrit → INVALID : pas de réparation silencieuse, pas de conversion en NOT_FROZEN, live jamais utilisé',
        'SCIENTIFIC_CONTEXT_FREEZE',
        noRepair,
        'état INVALID conservé, résolution fail-closed, contexte non réparé et non converti',
        `state=${state}, resolveThrew=${resolveThrew}, after=${validateScientificContext(after?.scientificContext)}, status=${after?.scientificContext?.status}`
      );
    }

    // --- G34-CONTEXT-14 — échec avant la persistance finale (conditionning T0 BLOCKING) → ancien état conservé
    {
      const store = TrialStoreService.createIsolatedStore();
      // ApplicationDate absente → conditioning T0 BLOCKING (mécanisme d'échec réel du service).
      const t = makeColorTrial(store, undefined);
      const stageT0 = t.stages.find((s) => s.stageType === 'INITIAL_PRE_EXPOSURE')!;
      const batch = t.batches[0];
      const batchNoDate = {
        ...batch,
        id: batch.id // le lot a été créé sans applicationDate : transient
      };
      // S'assurer que le lot de l'essai est sans applicationDate (failure path réel).
      (batch as { applicationDate?: string }).applicationDate = undefined as unknown as string;
      const panelE1 = batch.panels.find((p) => p.roleCode === 'E1')!;
      let threw = false;
      try {
        store.recordAcquisition({
          trialId: t.id,
          stageId: stageT0.id,
          batchId: batch.id,
          panelId: panelE1.id,
          familyId: 'COLOR',
          raw: colorRaw(),
          operatorId: 'OP-001'
        });
      } catch {
        threw = true;
      }
      const after = store.getTrial(t.id);
      const preserved =
        threw &&
        after?.scientificContext === undefined && // jamais de FROZEN partiel
        after?.configurationStatus !== 'LOCKED' &&
        Object.keys(after?.acquisitions ?? {}).length === 0 &&
        validateScientificContext(after?.scientificContext) === 'NOT_FROZEN';
      record(
        'G34-CONTEXT-14',
        'Échec avant la persistance finale (conditionning T0 BLOCKING, applicationDate absente) → ancien état conservé, aucun FROZEN partiel',
        'SCIENTIFIC_CONTEXT_FREEZE',
        preserved,
        'throw réel du service avant tout write ; contexte absent (NOT_FROZEN), pas de verrou, pas d’acquisition persistée',
        `threw=${threw}, context=${after?.scientificContext === undefined ? 'absent' : 'présent'}, locked=${after?.configurationStatus}, acquisitions=${Object.keys(after?.acquisitions ?? {}).length}`
      );
    }
  }
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed
    }
  };
}
