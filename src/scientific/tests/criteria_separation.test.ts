/**
 * QUV-Lab — SÉPARATION STRICTE COMPUTED / CRITÈRE (P4)
 * Vérifie :
 *   T1 — COMPUTED neutre : les 4 familles ne portent plus criterionCategory,
 *        ni infiperfAlert (brillance), ni delayCompliance (adhérence).
 *   T2 — Brillance : retentionRatePercent toujours calculée ; l'évaluation du
 *        seuil vit exclusivement en couche CRITÈRE (S3), classée critère
 *        complémentaire INFIPERF / FCBA — jamais exigence NF EN 927-6.
 *   T3 — Qualité / critère découplés : une rétention < 50 % reste une donnée
 *        valide (aucune alerte qualité, status préservé) tout en étant repérée
 *        défavorable à la couche S3.
 *   T4 — Adhésion : le verdict de délai S3 est identique à la logique
 *        scientifique (calculateDelayCompliance) ; source unique pour UI/rapport.
 *   T5 — MultiSystemComparator : initialMeanGloss consommé quand disponible,
 *        repli historiquement équivalent sinon (résultats identiques).
 */

import {
  getDefaultScientificRuleSet,
  createCountConfiguration,
  createSeriesConfiguration
} from '../ruleSet';
import { calculateColor } from '../colorEngine';
import { calculateGloss } from '../glossEngine';
import { calculatePersoz } from '../persozEngine';
import { calculateAdhesion, calculateDelayCompliance } from '../adhesionEngine';
import {
  evaluateGlossRetentionCriterion,
  getGlossRetentionThreshold
} from '../criteria/criteriaGloss';
import { evaluateAdhesionDelayCriterion } from '../criteria/criteriaAdhesion';
import { compareSystemsAtStage } from '../analysis/MultiSystemComparator';
import {
  ColorRawData,
  GlossRawData,
  PersozRawData,
  AdhesionRawData,
  ScientificRuleSet
} from '../../types/scientific';
import { Trial } from '../../types/trial';

export interface CriteriaSeparationTestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runCriteriaSeparationTests(): {
  results: CriteriaSeparationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: CriteriaSeparationTestResult[] = [];
  const ruleSet = getDefaultScientificRuleSet();
  const record = (id: number, name: string, category: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, category, passed, expected, actual });
  };

  // Configuration brillance canonique 2×2 (total 4 lectures).
  const glossConfig = createSeriesConfiguration('GLOSS', 2, 2, ruleSet);

  // ----------------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------------
  const mkGlossRaw = (values: number[]): GlossRawData => ({
    series: [
      {
        seriesIndex: 1,
        orientation: 'GRAIN_DIRECTION',
        readings: values.slice(0, 2).map((value, i) => ({ pointIndex: i + 1, value }))
      },
      {
        seriesIndex: 2,
        orientation: 'OPPOSITE_GRAIN_DIRECTION',
        readings: values.slice(2, 4).map((value, i) => ({ pointIndex: i + 1, value }))
      }
    ]
  });

  const mkColorRaw = (): ColorRawData => ({
    readings: [
      { pointIndex: 1, L: 50.2, a: 1.2, b: -0.4 },
      { pointIndex: 2, L: 50.4, a: 1.1, b: -0.3 },
      { pointIndex: 3, L: 50.1, a: 1.3, b: -0.5 },
      { pointIndex: 4, L: 50.3, a: 1.2, b: -0.4 }
    ]
  });

  const mkPersozRaw = (): PersozRawData => ({
    readings: [
      { pointIndex: 1, dampingTimeSeconds: 180 },
      { pointIndex: 2, dampingTimeSeconds: 178 },
      { pointIndex: 3, dampingTimeSeconds: 182 }
    ],
    unit: 'SECONDS'
  });

  const mkAdhRaw = (overrides?: Partial<AdhesionRawData>): AdhesionRawData => ({
    measurements: [
      { measurementIndex: 1, adhesionClass: 0 },
      { measurementIndex: 2, adhesionClass: 1 }
    ],
    measurementDateTime: '2026-10-24T00:00:00Z',
    gridSpacingMm: 2,
    requiredMinimumDelayHours: 168,
    normReference: 'NF EN ISO 2409:2020',
    ...overrides
  });

  const createComparatorTrial = (reference: string): Trial => ({
    id: `trial-${reference}`,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { reference, title: 'Essai test', createdBy: 'TestRunner' },
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
      familyConfigs: {
        COLOR: { familyId: 'COLOR', enabled: true },
        GLOSS: { familyId: 'GLOSS', enabled: true },
        PERSOZ: { familyId: 'PERSOZ', enabled: true },
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: [
      {
        id: 'st-t0',
        trialId: `trial-${reference}`,
        cycleIndex: 0,
        stageType: 'INITIAL_PRE_EXPOSURE',
        name: 'T0',
        scheduledExposureHours: 0,
        status: 'VALIDATED'
      },
      {
        id: 'st-2016',
        trialId: `trial-${reference}`,
        cycleIndex: 12,
        stageType: 'FINAL_POST_EXPOSURE',
        name: '2016 h',
        scheduledExposureHours: 2016,
        status: 'VALIDATED'
      }
    ],
    batches: [
      {
        id: 'b1',
        trialId: `trial-${reference}`,
        reference: 'LOT A',
        orderIndex: 1,
        coatingSystem: 'Lasure',
        woodSpecies: 'Pin',
        productReference: 'PROD-01',
        panels: [
          { id: 'p1', batchId: 'b1', index: 1, label: 'P01', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' },
          { id: 'p2', batchId: 'b1', index: 2, label: 'P02', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' }
        ]
      }
    ],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  });

  const seedGlossAcq = (
    trial: Trial,
    stageId: string,
    panelId: string,
    computed: Record<string, unknown>
  ) => {
    const key = `${stageId}__${panelId}__GLOSS`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId: 'b1',
      panelId,
      familyId: 'GLOSS',
      raw: {},
      computed,
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  // ----------------------------------------------------------------------------
  // T1 — COMPUTED NEUTRE : plus aucun champ critère/verdict dans COMPUTED
  // ----------------------------------------------------------------------------
  {
    const colorRes = calculateColor(mkColorRaw(), createCountConfiguration('COLOR', 4, ruleSet), ruleSet);
    const glossRes = calculateGloss(
      mkGlossRaw([44.1, 44.3, 43.9, 44.2]),
      glossConfig,
      ruleSet
    );
    const persozRes = calculatePersoz(mkPersozRaw(), createCountConfiguration('PERSOZ', 3, ruleSet), ruleSet);
    const adhRes = calculateAdhesion(mkAdhRaw(), createCountConfiguration('ADHESION', 2, ruleSet), ruleSet);

    const colorKeys = Object.keys(colorRes.computed);
    const glossKeys = Object.keys(glossRes.computed);
    const persozKeys = Object.keys(persozRes.computed);
    const adhKeys = Object.keys(adhRes.computed);

    const noCriterionCategory =
      !colorKeys.includes('criterionCategory') &&
      !glossKeys.includes('criterionCategory') &&
      !persozKeys.includes('criterionCategory') &&
      !adhKeys.includes('criterionCategory');
    const noInfiperfAlert = !glossKeys.includes('infiperfAlert');
    const noDelayCompliance = !adhKeys.includes('delayCompliance');

    record(
      1,
      'T1 COMPUTED neutre — aucune écriture critère/verdict (couleur/brillant/Persoz/adhésion)',
      'COMPUTED_NEUTRALITY',
      noCriterionCategory && noInfiperfAlert && noDelayCompliance,
      'Aucune clé criterionCategory / infiperfAlert / delayCompliance dans COMPUTED',
      `color:${colorKeys.join(',')} gloss:${glossKeys.join(',')} persoz:${persozKeys.join(',')} adh:${adhKeys.join(',')}`
    );
  }

  // ----------------------------------------------------------------------------
  // T2 — BRILLANCE : rétention calculée dans COMPUTED, seuil évalué en S3
  // ----------------------------------------------------------------------------
  {
    const refRaw = mkGlossRaw([44.1, 44.3, 43.9, 44.2]);
    const full = calculateGloss(refRaw, glossConfig, ruleSet, { referenceRaw: refRaw });
    const retentionFull = full.computed.retentionRatePercent;
    const retentionComputable = retentionFull !== null && retentionFull !== undefined;

    // Donnée valide avec rétention < seuil : le moteur CALCULE, la couche S3 évalue.
    const below = calculateGloss(
      mkGlossRaw([20.8, 20.9, 21.0, 20.9]),
      glossConfig,
      ruleSet,
      { referenceRaw: refRaw }
    );
    const retentionBelow = below.computed.retentionRatePercent;
    const s3 = evaluateGlossRetentionCriterion(retentionBelow, ruleSet);

    const thresholdFromRuleSet = getGlossRetentionThreshold(ruleSet);
    const complementaryClassification =
      s3.origin === 'INFIPERF / FCBA' &&
      s3.isComplementaryCriterion === true &&
      s3.isNormativeRequirement === false &&
      s3.message.includes('distinct de toute exigence');

    record(
      2,
      'T2 Brillance — rétention calculée par COMPUTED ; seuil read depuis ruleSet et évalué en S3 (critère complémentaire)',
      'CRITERE_SEPARATION',
      retentionComputable &&
        retentionFull === 100 &&
        retentionBelow !== null &&
        retentionBelow !== undefined &&
        retentionBelow < 50 &&
        s3.verdict === 'DEFAVORABLE' &&
        thresholdFromRuleSet === 50 &&
        complementaryClassification,
      `COMPUTED: retentionFull=100, retentionBelow=${String(retentionBelow)} ; S3: verdict=DEFAVORABLE, seuil=${thresholdFromRuleSet}, complémentaire`,
      `COMPUTED: ${String(retentionFull)} / ${String(retentionBelow)} ; S3: ${s3.verdict}, seuil=${s3.thresholdPercent}, origine=${s3.origin}`
    );
  }

  // ----------------------------------------------------------------------------
  // T3 — QUALITÉ / CRITÈRE DÉCOUPLÉS : rétention < 50 % ≠ donnée invalide
  // ----------------------------------------------------------------------------
  {
    const refRaw = mkGlossRaw([44.1, 44.3, 43.9, 44.2]);
    const below = calculateGloss(
      mkGlossRaw([20.8, 20.9, 21.0, 20.9]),
      glossConfig,
      ruleSet,
      { referenceRaw: refRaw }
    );
    const alerts = below.alerts;

    const noInfiperfAlert =
      !alerts.some((a) => a.id === 'alert-gloss-infiperf-50' || a.id.includes('infiperf'));
    // La qualité de la donnée (4/4 mesures valides) reste GOOD : le critère
    // défavorable n'est JAMAIS une dégradation qualité.
    const qualityPreserved = below.computed.qualityAssessment.status === 'GOOD';
    const s3 = evaluateGlossRetentionCriterion(below.computed.retentionRatePercent, ruleSet);
    const flaggedDefavorableAtS3 = s3.verdict === 'DEFAVORABLE';

    record(
      3,
      'T3 Qualité/critère découplés — brillance 47,4 % = donnée valide GOOD, critère S3 défavorable (aucune alerte qualité)',
      'QUALITY_DECOUPLING',
      noInfiperfAlert && qualityPreserved && flaggedDefavorableAtS3,
      '0 alerte qualityEngine, status GOOD, S3 DEFAVORABLE',
      `alertes infiperf: ${alerts.filter((a) => a.id.includes('infiperf')).length}, status=${below.computed.qualityAssessment.status}, S3=${s3.verdict}`
    );
  }

  // ----------------------------------------------------------------------------
  // T4 — ADHÉSION : verdict de délai S3 strictement identique à la logique
  //      scientifique existante (aucune 2e règle)
  // ----------------------------------------------------------------------------
  {
    const measurementDate = '2026-10-24T00:00:00Z';
    const app84Days = '2026-08-01T00:00:00Z'; // 2016 h → CONFORME
    const app4Days = '2026-10-20T00:00:00Z'; // 96 h → NON_CONFORME

    const conforme = evaluateAdhesionDelayCriterion({
      applicationDateTime: app84Days,
      measurementDateTime: measurementDate,
      requiredMinimumDelayHours: 168
    });
    const nonConforme = evaluateAdhesionDelayCriterion({
      applicationDateTime: app4Days,
      measurementDateTime: measurementDate,
      requiredMinimumDelayHours: 168
    });
    const missing = evaluateAdhesionDelayCriterion({
      measurementDateTime: measurementDate,
      requiredMinimumDelayHours: 168
    });
    const invalide = evaluateAdhesionDelayCriterion({
      applicationDateTime: 'date-invalide',
      measurementDateTime: measurementDate,
      requiredMinimumDelayHours: 168
    });

    // Cross-check : la projection S3 doit reproduire exactement le mapping
    // historique (calculateDelayCompliance → CONFORME / NON_CONFORME / NON_EVALUE).
    const refConforme = calculateDelayCompliance(app84Days, measurementDate);
    const refNonConforme = calculateDelayCompliance(app4Days, measurementDate);
    const mappingIdentique =
      conforme.verdict === (refConforme.status === 'CONFORME' ? 'CONFORME' : 'NON_EVALUE') &&
      nonConforme.verdict === (refNonConforme.status === 'INSUFFICIENT_DELAY' ? 'NON_CONFORME' : 'NON_EVALUE');

    record(
      4,
      'T4 Adhésion — délai S3 identique à calculateDelayCompliance (CONFORME/NON_CONFORME/NON_EVALUE)',
      'CRITERE_ADHESION',
      conforme.verdict === 'CONFORME' &&
        conforme.status === 'CONFORME' &&
        nonConforme.verdict === 'NON_CONFORME' &&
        nonConforme.status === 'INSUFFICIENT_DELAY' &&
        missing.verdict === 'NON_EVALUE' &&
        missing.status === 'MISSING_APPLICATION_DATE' &&
        invalide.verdict === 'NON_EVALUE' &&
        invalide.status === 'INVALID_DATE' &&
        mappingIdentique &&
        conforme.normativeReference === 'NF EN ISO 2409:2020',
      'CONFORME(2016 h) / NON_CONFORME(96 h) / NON_EVALUE(manquante) / NON_EVALUE(invalide), mapping = logique moteur',
      `conforme=${conforme.verdict}(${conforme.status}), nonConforme=${nonConforme.verdict}(${nonConforme.status}), missing=${missing.verdict}(${missing.status}), invalide=${invalide.verdict}(${invalide.status})`
    );
  }

  // ----------------------------------------------------------------------------
  // T5 — MultiSystemComparator : initialMeanGloss consommé quand disponible,
  //      repli historiquement équivalent sinon
  // ----------------------------------------------------------------------------
  {
    const modern = createComparatorTrial('MODERN');
    seedGlossAcq(modern, 'st-2016', 'p1', {
      meanGloss: 27.9,
      deltaGloss: -16.2,
      initialMeanGloss: 44.1,
      retentionRatePercent: 63.3
    });
    seedGlossAcq(modern, 'st-2016', 'p2', {
      meanGloss: 27.9,
      deltaGloss: -16.2,
      initialMeanGloss: 44.1,
      retentionRatePercent: 63.3
    });
    const modernRes = compareSystemsAtStage(modern, 'st-2016', ruleSet, ['b1']);

    // Calcul historique persisté (v1.1.0) : pas d'initialMeanGloss, repli dérivé.
    const legacy = createComparatorTrial('LEGACY');
    seedGlossAcq(legacy, 'st-2016', 'p1', {
      meanGloss: 27.9,
      deltaGloss: -16.2,
      retentionRatePercent: 63.3
    });
    seedGlossAcq(legacy, 'st-2016', 'p2', {
      meanGloss: 27.9,
      deltaGloss: -16.2,
      retentionRatePercent: 63.3
    });
    const legacyRes = compareSystemsAtStage(legacy, 'st-2016', ruleSet, ['b1']);

    const modernInitial = modernRes.items[0]?.gloss?.meanInitialGU ?? null;
    const legacyInitial = legacyRes.items[0]?.gloss?.meanInitialGU ?? null;

    record(
      5,
      'T5 MultiSystemComparator — initialMeanGloss utilisé ; repli historique idem (meanInitialGU 44,1)',
      'COMPARATOR',
      modernInitial === 44.1 && legacyInitial === 44.1 && modernInitial === legacyInitial,
      'meanInitialGU = 44,1 (moderne ET hérité), résultats identiques',
      `moderne=${String(modernInitial)}, legacy=${String(legacyInitial)}`
    );
  }

  // ----------------------------------------------------------------------------
  // T6 — CRITÈRE BRILLANCE : seuil absent du RuleSet → aucun verdict conforme
  //      (aucun repli 50 en dur)
  // ----------------------------------------------------------------------------
  {
    const noThresholdRuleSet = {
      ...ruleSet,
      statisticalRules: { ...ruleSet.statisticalRules }
    } as ScientificRuleSet & { statisticalRules: { retentionThresholdPercent?: number } };
    delete (noThresholdRuleSet.statisticalRules as { retentionThresholdPercent?: number })
      .retentionThresholdPercent;

    const threshold = getGlossRetentionThreshold(noThresholdRuleSet);
    const s3 = evaluateGlossRetentionCriterion(47.4, noThresholdRuleSet);

    const noVerdict =
      threshold === null && s3.verdict === 'NON_EVALUE' && s3.thresholdPercent === null;
    const messageExplicit = s3.message.includes('aucun seuil configuré dans le ScientificRuleSet');

    record(
      6,
      'T6 Brillance — seuil absent du RuleSet : aucun repli 50, verdict NON_EVALUE, aucun verdict de conformité',
      'CRITERE_SEPARATION',
      noVerdict && messageExplicit,
      'getGlossRetentionThreshold=null ; S3: NON_EVALUE, thresholdPercent=null, message explicite',
      `threshold=${String(threshold)}, verdict=${s3.verdict}, seuil=${String(s3.thresholdPercent)}, msg=${s3.message}`
    );
  }

  // ----------------------------------------------------------------------------
  // T7 — ADHÉSION : délai = paramètre protocolaire OPTIONNEL. Sans configuration
  //      explicite → vérification contournée (NON_EVALUE, DELAY_CHECK_SKIPPED).
  //      Avec 168 h explicite → verdict normal.
  // ----------------------------------------------------------------------------
  {
    const dates = {
      applicationDateTime: '2026-08-01T00:00:00Z', // 2016 h → CONFORME avec 168 h
      measurementDateTime: '2026-10-24T00:00:00Z'
    };
    const skipped = evaluateAdhesionDelayCriterion(dates);
    const explicit = evaluateAdhesionDelayCriterion({ ...dates, requiredMinimumDelayHours: 168 });

    const passed =
      skipped.verdict === 'NON_EVALUE' &&
      skipped.status === 'DELAY_CHECK_SKIPPED' &&
      skipped.requiredMinimumDelayHours === null &&
      skipped.message.includes('paramètre protocolaire optionnel') &&
      explicit.verdict === 'CONFORME';

    record(
      7,
      'T7 Adhésion — seuil optionnel : sans config → NON_EVALUE (skip), avec 168 h → CONFORME',
      'CRITERE_ADHESION',
      passed,
      'sans seuil: NON_EVALUE/DELAY_CHECK_SKIPPED ; avec 168: CONFORME',
      `sans=${skipped.verdict}(${skipped.status}), avec=${explicit.verdict}(${explicit.status})`
    );
  }

  return {
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length
    }
  };
}