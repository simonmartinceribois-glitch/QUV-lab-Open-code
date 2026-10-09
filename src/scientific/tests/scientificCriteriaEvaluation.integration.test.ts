/**
 * QUV-Lab — TESTS D'INTÉGRATION DE LA COUCHE D'ÉVALUATION APPLICATIVE
 * NF EN 927-2:2014 (HISTORICAL_TRANSITIONAL) & INFIPERF / FCBA
 *
 * Vérifie la chaîne service → rapport → export → présentation SANS re-tester les
 * moteurs (déjà couverts par la suite 58) :
 *   - orchestration du service (mono/multi-lots, jalon C12, batchId inconnu) ;
 *   - classification 2014 relayée sans réimplémentation ;
 *   - INDÉPENDANCE NF/INFIPERF et absence de verdict global ;
 *   - immutabilité du Trial (RAW/COMPUTED inchangés) ;
 *   - sections de rapport additives (NF 2014 & INFIPERF) factuelles ;
 *   - export CSV additif sans déplacement de colonnes, RAW inchangé ;
 *   - garde-fous de présentation (vocabulaire interdit, distinction des statuts).
 *
 * Aucun accès en écriture : évaluations en lecture seule.
 */

import { getDefaultScientificRuleSet, createCountConfiguration, createSeriesConfiguration } from '../ruleSet';
import { Trial } from '../../types/trial';
import {
  evaluateScientificCriteria,
  evaluateScientificCriteriaPerBatch
} from '../../services/scientificCriteriaEvaluationService';
import {
  buildScientificCriteriaPresentation,
  checkForbiddenVocabulary
} from '../../components/results-subviews/scientificCriteriaPresentation';
import {
  buildScientificReport,
  exportReportToCsv,
  exportRawDataToCsv
} from '../../services/reportGenerator';
import { calculateAdhesion } from '../adhesionEngine';
import type { AdhesionRawData, MeasurementCountConfiguration } from '../../types/scientific';

export interface ScientificCriteriaIntegrationTestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runScientificCriteriaEvaluationTests(): {
  results: ScientificCriteriaIntegrationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ScientificCriteriaIntegrationTestResult[] = [];
  const ruleSet = getDefaultScientificRuleSet();
  const record = (
    id: number,
    name: string,
    category: string,
    passed: boolean,
    expected: string,
    actual: string
  ) => {
    results.push({ id, name, category, passed, expected, actual });
  };

  // --------------------------------------------------------------------------
  // Fixtures
  // --------------------------------------------------------------------------
  const C12_STAGE_ID = 'st-2016';
  const C11_STAGE_ID = 'st-1848';

  const P_E1 = { id: 'p-e1', batchId: 'b1', index: 1, label: 'E1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' } as const;
  const P_E2 = { id: 'p-e2', batchId: 'b1', index: 2, label: 'E2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' } as const;
  const P_E3 = { id: 'p-e3', batchId: 'b1', index: 3, label: 'E3', role: 'EXPOSED_3', roleCode: 'E3', status: 'ACTIVE' } as const;
  const P_T = { id: 'p-t', batchId: 'b1', index: 4, label: 'T', role: 'WITNESS', roleCode: 'T', status: 'ACTIVE' } as const;

  const P2_E1 = { id: 'p2-e1', batchId: 'b2', index: 1, label: 'E1', role: 'EXPOSED_1', roleCode: 'E1', status: 'ACTIVE' } as const;
  const P2_E2 = { id: 'p2-e2', batchId: 'b2', index: 2, label: 'E2', role: 'EXPOSED_2', roleCode: 'E2', status: 'ACTIVE' } as const;
  const P2_E3 = { id: 'p2-e3', batchId: 'b2', index: 3, label: 'E3', role: 'EXPOSED_3', roleCode: 'E3', status: 'ACTIVE' } as const;

  const baseBatch1 = (panels: Trial['batches'][number]['panels']) => ({
    id: 'b1',
    trialId: 'trial-integration',
    reference: 'LOT A',
    orderIndex: 1,
    coatingSystem: 'Lasure A',
    woodSpecies: 'Pin',
    productReference: 'PROD-01',
    panels
  });

  const createTrial = (overrides?: {
    stages?: Trial['stages'];
    acquisitions?: Trial['acquisitions'];
    batches?: Trial['batches'];
  }): Trial => ({
    id: 'trial-integration',
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { reference: 'INT-P5', title: 'Intégration critères', createdBy: 'TestRunner' },
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS', 'ADHESION'],
      familyConfigs: {
        COLOR: {
          familyId: 'COLOR',
          enabled: true,
          countConfig: createCountConfiguration('COLOR', ruleSet.measurementConfigurations.COLOR.standardRecommendedCount, ruleSet)
        },
        GLOSS: {
          familyId: 'GLOSS',
          enabled: true,
          seriesConfig: createSeriesConfiguration(
            'GLOSS',
            ruleSet.seriesConfigurations!.GLOSS.standardConfiguration.seriesCount,
            ruleSet.seriesConfigurations!.GLOSS.standardConfiguration.readingsPerSeries,
            ruleSet
          )
        },
        PERSOZ: {
          familyId: 'PERSOZ',
          enabled: true,
          countConfig: createCountConfiguration('PERSOZ', ruleSet.measurementConfigurations.PERSOZ.standardRecommendedCount, ruleSet)
        },
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: true },
        ADHESION: {
          familyId: 'ADHESION',
          enabled: true,
          countConfig: createCountConfiguration('ADHESION', ruleSet.measurementConfigurations.ADHESION.standardRecommendedCount, ruleSet)
        }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages: overrides?.stages ?? [
      { id: 'st-t0', trialId: 'trial-integration', cycleIndex: 0, stageType: 'INITIAL_PRE_EXPOSURE', name: 'T0', scheduledExposureHours: 0, status: 'IN_PROGRESS' },
      { id: C12_STAGE_ID, trialId: 'trial-integration', cycleIndex: 12, stageType: 'FINAL_POST_EXPOSURE', name: '2016 h', scheduledExposureHours: 2016, status: 'VALIDATED' }
    ],
    batches: overrides?.batches ?? [baseBatch1([P_T, P_E1, P_E2, P_E3])],
    acquisitions: overrides?.acquisitions ?? {
      // Garde T0 du rapport (fail-closed) : mesure réelle au jalon initial
      // requise pour générer. computed null : aucune valeur ajoutée, témoin T
      // exclu des agrégations exposées.
      [`${'st-t0'}__${P_T.id}__COLOR`]: {
        id: 'acq-t0',
        trialId: 'trial-integration',
        stageId: 'st-t0',
        batchId: P_T.batchId,
        panelId: P_T.id,
        familyId: 'COLOR',
        raw: {
          readings: [
            { pointIndex: 1, L: 60.1, a: 5.2, b: 20.3 },
            { pointIndex: 2, L: 60.2, a: 5.1, b: 20.4 }
          ]
        },
        computed: null,
        status: 'COMPLETE',
        alerts: [],
        trace: { createdBy: 'TestRunner', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
        mediaIds: []
      }
    },
    auditTrail: [],
    mediaReferences: []
  });

  const seedObservation = (
    trial: Trial,
    stageId: string,
    panelId: string,
    batchId: string,
    perCategoryMaxRating: Record<string, number>
  ) => {
    const key = `${stageId}__${panelId}__OBSERVATIONS`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId,
      panelId,
      familyId: 'OBSERVATIONS',
      raw: {},
      computed: { perCategoryMaxRating },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedGloss = (
    trial: Trial,
    stageId: string,
    panelId: string,
    batchId: string,
    retentionRatePercent: number | null
  ) => {
    const key = `${stageId}__${panelId}__GLOSS`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId,
      panelId,
      familyId: 'GLOSS',
      raw: {},
      computed: { retentionRatePercent },
      status: 'COMPLETE',
      alerts: [],
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedAdhesion = (
    trial: Trial,
    stageId: string,
    panelId: string,
    batchId: string,
    adhesionClasses: (number | null)[]
  ) => {
    const raw: AdhesionRawData = {
      measurements: adhesionClasses.map((c, i) => ({ measurementIndex: i + 1, adhesionClass: c })),
      measurementDateTime: '2026-09-10T08:00:00Z',
      applicationDateTime: '2026-09-01T08:00:00Z',
      gridSpacingMm: 2,
      normReference: 'NF EN ISO 2409:2020'
    };
    const countConfig: MeasurementCountConfiguration = {
      familyId: 'ADHESION',
      mode: adhesionClasses.length === 1 ? 'CUSTOM_JUSTIFIED' : 'STANDARD_DEFAULT',
      origin: 'NORMATIVE_REQUIREMENT',
      standardReference: 'NF EN ISO 2409:2020',
      clause: '§5 & §6 (Essai de quadrillage)',
      rationale: 'Test intégration',
      standardRecommendedCount: 2,
      configuredCount: adhesionClasses.length,
      deviationFromStandard: adhesionClasses.length === 1,
      justification: adhesionClasses.length === 1 ? 'Test : protocole à 1 mesure' : undefined,
      configuredBy: 'SYSTEM',
      configuredAt: '2026-09-01T00:00:00Z',
      ruleSource: 'NORMATIVE_REQUIREMENT'
    };
    const { computed, alerts } = calculateAdhesion(raw, countConfig, ruleSet, { stageId, panelId });
    const key = `${stageId}__${panelId}__ADHESION`;
    trial.acquisitions[key] = {
      id: `acq-${key}`,
      trialId: trial.id,
      stageId,
      batchId,
      panelId,
      familyId: 'ADHESION',
      raw,
      computed,
      status: alerts.some((a) => a.severity === 'BLOCKING') ? 'ERROR' : 'COMPLETE',
      alerts,
      trace: { createdBy: 'Tester', createdAt: new Date().toISOString(), source: 'MANUAL_KEYPAD' },
      mediaIds: []
    };
  };

  const seedDataset = (
    trial: Trial,
    data: { BLISTERING: number[]; CRACKING: number[]; FLAKING: number[]; ADHESION: number[] },
    batchId = 'b1',
    panels: { id: string }[] = [P_E1, P_E2, P_E3]
  ) => {
    for (let i = 0; i < 3; i += 1) {
      const panel = panels[i];
      seedObservation(trial, C12_STAGE_ID, panel.id, batchId, {
        BLISTERING: data.BLISTERING[i],
        CRACKING: data.CRACKING[i],
        FLAKING: data.FLAKING[i]
      });
      seedAdhesion(trial, C12_STAGE_ID, panel.id, batchId, [data.ADHESION[i]]);
    }
  };

  const STABLE_DATA = {
    BLISTERING: [0.1, 0.1, 0.1],
    CRACKING: [0.4, 0.0, 0.2],
    FLAKING: [0.1, 0.1, 0.1],
    ADHESION: [0, 0, 0]
  };
  const SEMI_DATA = {
    BLISTERING: [0.5, 0.5, 0.5],
    CRACKING: [1.3, 0.3, 0.3],
    FLAKING: [0.5, 0.5, 0.5],
    ADHESION: [0, 1, 1]
  };
  const NON_STABLE_DATA = {
    BLISTERING: [0.7, 0.7, 0.7],
    CRACKING: [3.0, 3.0, 3.0],
    FLAKING: [0.7, 0.7, 0.7],
    ADHESION: [0, 0, 0]
  };
  const NO_CATEGORY_DATA = {
    BLISTERING: [0.7, 0.7, 0.7],
    CRACKING: [0.0, 1.5, 1.5],
    FLAKING: [0.7, 0.7, 0.8],
    ADHESION: [3, 3, 3]
  };
  const INVALID_DATA = {
    BLISTERING: [0.5, 0.5, 0.5],
    CRACKING: [4.1, 0.2, 0.2],
    FLAKING: [0.5, 0.5, 0.5],
    ADHESION: [0, 1, 1]
  };

  const trialWithData = (data: typeof STABLE_DATA, withGlossRetention?: number) => {
    const trial = createTrial();
    seedDataset(trial, data);
    if (withGlossRetention !== undefined) {
      for (const p of [P_E1, P_E2, P_E3]) {
        seedGloss(trial, C12_STAGE_ID, p.id, 'b1', withGlossRetention);
      }
    }
    return trial;
  };

  const multiBatchTrial = () => {
    const trial = createTrial({
      batches: [baseBatch1([P_T, P_E1, P_E2, P_E3]), { ...baseBatch1([P2_E1, P2_E2, P2_E3]), id: 'b2', reference: 'LOT B', orderIndex: 2, coatingSystem: 'Lasure B', productReference: 'PROD-02' }]
    });
    seedDataset(trial, STABLE_DATA, 'b1', [P_E1, P_E2, P_E3]);
    seedDataset(trial, NON_STABLE_DATA, 'b2', [P2_E1, P2_E2, P2_E3]);
    return trial;
  };

  // --------------------------------------------------------------------------
  // 1 → 10 : SERVICE
  // --------------------------------------------------------------------------

  // 1 — Mono-lot sans sélection : lot unique résolu automatiquement.
  {
    const trial = trialWithData(STABLE_DATA);
    const e = evaluateScientificCriteria(trial, ruleSet);
    record(
      1,
      'Service mono-lot : lot unique résolu (batchId=b1), classification STABLE relayée',
      'SERVICE',
      e.batchId === 'b1' &&
        e.nf9272.testValidity === 'VALID' &&
        e.nf9272.classification === 'STABLE' &&
        e.nf9272.batchScoped.scopeBlockedReason === null,
      'batchId=b1, VALID, STABLE, scope non bloqué',
      `batchId=${String(e.batchId)}, validity=${e.nf9272.testValidity}, class=${String(e.nf9272.classification)}, reason=${String(e.nf9272.batchScoped.scopeBlockedReason)}`
    );
  }

  // 2 — Classification SEMI_STABLE.
  {
    const e = evaluateScientificCriteria(trialWithData(SEMI_DATA), ruleSet);
    record(
      2,
      'Service : classification SEMI_STABLE relayée sans réimplémentation',
      'SERVICE',
      e.nf9272.classification === 'SEMI_STABLE',
      'SEMI_STABLE',
      String(e.nf9272.classification)
    );
  }

  // 3 — Classification NON_STABLE (catégorie valide).
  {
    const e = evaluateScientificCriteria(trialWithData(NON_STABLE_DATA), ruleSet);
    record(
      3,
      'Service : classification NON_STABLE (catégorie valide, jamais un échec)',
      'SERVICE',
      e.nf9272.testValidity === 'VALID' && e.nf9272.classification === 'NON_STABLE',
      'VALID + NON_STABLE',
      `${e.nf9272.testValidity} + ${String(e.nf9272.classification)}`
    );
  }

  // 4 — NO_CATEGORY_MET (essai validé, aucune catégorie).
  {
    const e = evaluateScientificCriteria(trialWithData(NO_CATEGORY_DATA), ruleSet);
    record(
      4,
      'Service : NO_CATEGORY_MET distinct de INVALID_TEST/INSUFFICIENT_DATA',
      'SERVICE',
      e.nf9272.testValidity === 'VALID' && e.nf9272.classification === 'NO_CATEGORY_MET',
      'VALID + NO_CATEGORY_MET',
      `${e.nf9272.testValidity} + ${String(e.nf9272.classification)}`
    );
  }

  // 5 — INVALID_TEST (écart > 4).
  {
    const e = evaluateScientificCriteria(trialWithData(INVALID_DATA), ruleSet);
    record(
      5,
      'Service : INVALID_TEST → classification null (jamais confondu avec NO_CATEGORY_MET)',
      'SERVICE',
      e.nf9272.testValidity === 'INVALID_TEST' && e.nf9272.classification === null,
      'INVALID_TEST + classification=null',
      `${e.nf9272.testValidity} + ${String(e.nf9272.classification)}`
    );
  }

  // 6 — INSUFFICIENT_DATA sans jalon C12.
  {
    const trial = createTrial({
      stages: [
        { id: C11_STAGE_ID, trialId: 'trial-integration', cycleIndex: 11, stageType: 'INTERMEDIATE_DURING_EXPOSURE', name: '1848 h', scheduledExposureHours: 1848, status: 'VALIDATED' }
      ]
    });
    seedDataset(trial, STABLE_DATA);
    const e = evaluateScientificCriteria(trial, ruleSet);
    record(
      6,
      'Service : jalon C12 absent → INSUFFICIENT_DATA, aucun repli sur C11',
      'SERVICE',
      e.nf9272.testValidity === 'INSUFFICIENT_DATA' && e.nf9272.classification === null,
      'INSUFFICIENT_DATA + classification=null',
      `${e.nf9272.testValidity} + ${String(e.nf9272.classification)}`
    );
  }

  // 7 — Multi-lots sans batchId : refus de la portée.
  {
    const e = evaluateScientificCriteria(multiBatchTrial(), ruleSet);
    record(
      7,
      'Service multi-lots sans sélection : refus INSUFFICIENT_DATA + scopeBlockedReason, aucune moyenne inter-systèmes',
      'SERVICE_MULTI_LOTS',
      e.nf9272.testValidity === 'INSUFFICIENT_DATA' &&
        e.batchId === null &&
        typeof e.nf9272.batchScoped.scopeBlockedReason === 'string' &&
        e.nf9272.batchScoped.scopeBlockedReason.length > 0,
      'INSUFFICIENT_DATA, batchId=null, scopeBlockedReason non nul',
      `validity=${e.nf9272.testValidity}, batchId=${String(e.batchId)}, reason=${String(e.nf9272.batchScoped.scopeBlockedReason)}`
    );
  }

  // 8 — Multi-lots avec batchId : chaque lot indépendant.
  {
    const trial = multiBatchTrial();
    const eA = evaluateScientificCriteria(trial, ruleSet, { batchId: 'b1' });
    const eB = evaluateScientificCriteria(trial, ruleSet, { batchId: 'b2' });
    record(
      8,
      'Service multi-lots ciblé : lot A STABLE et lot B NON_STABLE, jamais mélangés',
      'SERVICE_MULTI_LOTS',
      eA.batchId === 'b1' &&
        eA.nf9272.classification === 'STABLE' &&
        eB.batchId === 'b2' &&
        eB.nf9272.classification === 'NON_STABLE',
      'b1=STABLE, b2=NON_STABLE',
      `b1=${String(eA.nf9272.classification)}, b2=${String(eB.nf9272.classification)}`
    );
  }

  // 9 — batchId inconnu : refus.
  {
    const e = evaluateScientificCriteria(multiBatchTrial(), ruleSet, { batchId: 'unknown' });
    record(
      9,
      'Service batchId inconnu : évaluation refusée (aucune moyenne fabriquée)',
      'SERVICE_MULTI_LOTS',
      e.nf9272.testValidity === 'INSUFFICIENT_DATA' &&
        /introuvable/i.test(String(e.nf9272.batchScoped.scopeBlockedReason)),
      'INSUFFICIENT_DATA + « introuvable »',
      `${e.nf9272.testValidity} + ${String(e.nf9272.batchScoped.scopeBlockedReason)}`
    );
  }

  // 10 — evaluateScientificCriteriaPerBatch : un résultat par lot, ordre conservé.
  {
    const batches = evaluateScientificCriteriaPerBatch(multiBatchTrial(), ruleSet);
    record(
      10,
      'Service par lot : un résultat par lot, ordre conservé, aucune agrégation',
      'SERVICE_MULTI_LOTS',
      batches.length === 2 &&
        batches[0].batchId === 'b1' &&
        batches[1].batchId === 'b2' &&
        batches[0].evaluation.nf9272.classification === 'STABLE' &&
        batches[1].evaluation.nf9272.classification === 'NON_STABLE',
      '2 lots [b1=STABLE, b2=NON_STABLE]',
      `${batches.length} lots [${batches.map((b) => `${b.batchId}=${String(b.evaluation.nf9272.classification)}`).join(', ')}]`
    );
  }

  // --------------------------------------------------------------------------
  // 11 → 15 : INFIPERF & INDÉPENDANCE
  // --------------------------------------------------------------------------

  // 11 — Rétention favorable (seuil 50 lus depuis le RuleSet).
  {
    const e = evaluateScientificCriteria(trialWithData(STABLE_DATA, 80), ruleSet);
    record(
      11,
      'INFIPERF rétention 80 % ≥ seuil 50 : FAVORABLE, seuil lu depuis le RuleSet',
      'INFIPERF',
      e.infiperf.results.GLOSS_RETENTION.status === 'FAVORABLE' &&
        e.infiperf.results.GLOSS_RETENTION.threshold === 50,
      'FAVORABLE, threshold=50',
      `${e.infiperf.results.GLOSS_RETENTION.status}, threshold=${String(e.infiperf.results.GLOSS_RETENTION.threshold)}`
    );
  }

  // 12 — Rétention défavorable.
  {
    const e = evaluateScientificCriteria(trialWithData(STABLE_DATA, 40), ruleSet);
    record(
      12,
      'INFIPERF rétention 40 % < seuil 50 : DEFAVORABLE (critère complémentaire)',
      'INFIPERF',
      e.infiperf.results.GLOSS_RETENTION.status === 'DEFAVORABLE',
      'DEFAVORABLE',
      e.infiperf.results.GLOSS_RETENTION.status
    );
  }

  // 13 — INDÉPENDANCE : NF STABLE + INFIPERF DEFAVORABLE simultanés, aucun verdict global.
  {
    const e = evaluateScientificCriteria(trialWithData(STABLE_DATA, 30), ruleSet);
    record(
      13,
      'Indépendance NF/INFIPERF : NF STABLE + INFIPERF DEFAVORABLE, aucun verdict global',
      'INDEPENDANCE',
      e.nf9272.classification === 'STABLE' &&
        e.infiperf.results.GLOSS_RETENTION.status === 'DEFAVORABLE' &&
        e.nf9272.hasGlobalVerdict === false &&
        e.infiperf.hasGlobalVerdict === false,
      'NF=STABLE + INF=DEFAVORABLE + hasGlobalVerdict=false',
      `NF=${String(e.nf9272.classification)}, INF=${e.infiperf.results.GLOSS_RETENTION.status}, nfVerdict=${String(e.nf9272.hasGlobalVerdict)}, infVerdict=${String(e.infiperf.hasGlobalVerdict)}`
    );
  }

  // 14 — INFIPERF sans données : chaque indicateur reste INSUFFICIENT_DATA/NOT_APPLICABLE.
  {
    const e = evaluateScientificCriteria(createTrial(), ruleSet);
    record(
      14,
      'INFIPERF sans données : statuts indépendants (jamais NON_EVALUE, aucun score global)',
      'INFIPERF',
      e.infiperf.results.GLOSS_RETENTION.status !== ('NON_EVALUE' as unknown as string) &&
        e.infiperf.results.PERSOZ.status !== ('NON_EVALUE' as unknown as string) &&
        e.infiperf.results.COLOR.status !== ('NON_EVALUE' as unknown as string) &&
        e.infiperf.results.GENERAL_APPEARANCE.status !== ('NON_EVALUE' as unknown as string),
      'aucun statut NON_EVALUE',
      `G=${e.infiperf.results.GLOSS_RETENTION.status}, P=${e.infiperf.results.PERSOZ.status}, C=${e.infiperf.results.COLOR.status}, A=${e.infiperf.results.GENERAL_APPEARANCE.status}`
    );
  }

  // 15 — INFIPERF : référence & édition exposées, mode COMPLEMENTARY.
  {
    const e = evaluateScientificCriteria(trialWithData(STABLE_DATA, 80), ruleSet);
    record(
      15,
      'INFIPERF : référence/édition exposées et mode COMPLEMENTARY explicite',
      'INFIPERF',
      typeof e.infiperf.reference === 'string' &&
        e.infiperf.reference.length > 0 &&
        e.infiperf.evaluationMode === 'COMPLEMENTARY' &&
        e.nf9272.evaluationMode === 'COMPLEMENTARY',
      'reference non vide, evaluationMode=COMPLEMENTARY (NF & INF)',
      `ref=${e.infiperf.reference}, infMode=${e.infiperf.evaluationMode}, nfMode=${e.nf9272.evaluationMode}`
    );
  }

  // --------------------------------------------------------------------------
  // 16 : IMMUTABILITÉ
  // --------------------------------------------------------------------------
  {
    const trial = trialWithData(STABLE_DATA, 80);
    const before = JSON.stringify(trial);
    evaluateScientificCriteria(trial, ruleSet);
    evaluateScientificCriteriaPerBatch(trial, ruleSet);
    buildScientificCriteriaPresentation(evaluateScientificCriteria(trial, ruleSet));
    const after = JSON.stringify(trial);
    record(
      16,
      'Immutabilité : le Trial (RAW/COMPUTED) est strictement inchangé après toutes les évaluations',
      'IMMUTABILITE',
      before === after,
      'JSON.stringify(trial) identique avant/après',
      before === after ? 'identiques' : 'DIVERGENCE détectée'
    );
  }

  // --------------------------------------------------------------------------
  // 17 → 19 : RAPPORT & EXPORTS
  // --------------------------------------------------------------------------

  // 17 — Sections de rapport additives présentes et factuelles.
  {
    const trial = trialWithData(STABLE_DATA, 40);
    const report = buildScientificReport(trial, ruleSet, { operatorId: 'Tester' });
    const nf = report.sections.nf9272CriteriaEvaluation ?? '';
    const inf = report.sections.infiperfCriteriaEvaluation ?? '';
    record(
      17,
      'Rapport : sections NF EN 927-2:2014 & INFIPERF présentes, complémentaires et factuelles',
      'RAPPORT',
      nf.includes('HISTORICAL_TRANSITIONAL') &&
        nf.includes('ÉVALUATION COMPLÉMENTAIRE') &&
        inf.includes('INFIPERF') &&
        inf.includes('ÉVALUATION COMPLÉMENTAIRE') &&
        !/produit conforme|conforme nf en 927-2:2022|ce conforme/i.test(`${nf} ${inf}`),
      'sections présentes, mention HISTORICAL_TRANSITIONAL, aucune déclaration de conformité',
      `nfLen=${nf.length}, infLen=${inf.length}, forbidden=${String(/produit conforme|conforme nf en 927-2:2022|ce conforme/i.test(`${nf} ${inf}`))}`
    );
  }

  // 18 — Rapport multi-lots : deux blocs, jamais fusionnés.
  {
    const report = buildScientificReport(multiBatchTrial(), ruleSet, { operatorId: 'Tester' });
    const nf = report.sections.nf9272CriteriaEvaluation ?? '';
    const occurrences = (nf.match(/=== NF EN 927-2:2014/g) ?? []).length;
    record(
      18,
      'Rapport multi-lots : un bloc d’évaluation par système, aucune fusion inter-lots',
      'RAPPORT',
      occurrences === 2 && nf.includes('LOT A') && nf.includes('LOT B'),
      '2 blocs (LOT A, LOT B)',
      `${occurrences} blocs, LOT A=${String(nf.includes('LOT A'))}, LOT B=${String(nf.includes('LOT B'))}`
    );
  }

  // 19 — Export CSV additif : clés présentes, RAW inchangé.
  {
    const trial = trialWithData(STABLE_DATA, 40);
    const report = buildScientificReport(trial, ruleSet, { operatorId: 'Tester' });
    const csv = exportReportToCsv(trial, report, ruleSet);
    const rawCsv = exportRawDataToCsv(trial);
    const hasAllKeys =
      csv.includes('NF9272_STATUS') &&
      csv.includes('NF9272_CLASSIFICATION') &&
      csv.includes('NF9272_BATCH_ID') &&
      csv.includes('INFIPERF_STATUS') &&
      csv.includes('INFIPERF_RESULT');
    const additive =
      csv.indexOf('NF9272_STATUS') > csv.indexOf('=== CONCLUSION FACTUELLE ===') &&
      rawCsv.includes('DONNÉES BRUTES ACQUISES') &&
      !rawCsv.includes('NF9272_STATUS');
    record(
      19,
      'Export CSV : 5 clés additives en fin d’export, CSV RAW strictement inchangé',
      'EXPORT',
      hasAllKeys && additive,
      '5 clés présentes après la conclusion ; RAW sans clé NF9272',
      `keys=${String(hasAllKeys)}, additive=${String(additive)}`
    );
  }

  // --------------------------------------------------------------------------
  // 20 → 24 : PRÉSENTATION (helpers purs)
  // --------------------------------------------------------------------------

  // 20 — dataStatusKind distingue les trois statuts.
  {
    const stable = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(STABLE_DATA), ruleSet));
    const invalid = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(INVALID_DATA), ruleSet));
    const insufficient = buildScientificCriteriaPresentation(evaluateScientificCriteria(createTrial(), ruleSet));
    record(
      20,
      'Présentation : dataStatusKind distingue VALID / INVALID_TEST / INSUFFICIENT_DATA',
      'PRESENTATION',
      stable.nf9272.dataStatusKind === 'VALID' &&
        invalid.nf9272.dataStatusKind === 'INVALID_TEST' &&
        insufficient.nf9272.dataStatusKind === 'INSUFFICIENT_DATA',
      'VALID / INVALID_TEST / INSUFFICIENT_DATA',
      `${stable.nf9272.dataStatusKind} / ${invalid.nf9272.dataStatusKind} / ${insufficient.nf9272.dataStatusKind}`
    );
  }

  // 21 — Vocabulaire interdit absent.
  {
    const presentation = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(NON_STABLE_DATA, 40), ruleSet));
    const guard = checkForbiddenVocabulary(presentation);
    record(
      21,
      'Présentation : garde-fou vocabulaire (aucune conformité 2022/CE/produit, NON_STABLE factuel)',
      'PRESENTATION',
      guard.absentConformite2022 &&
        guard.absentProduitConforme &&
        guard.absentCeConforme &&
        guard.nonStablePresenteFactuellement,
      '4 garde-fous à true',
      JSON.stringify(guard)
    );
  }

  // 22 — Classification NON_STABLE présentée comme catégorie valide (jamais échec).
  {
    const presentation = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(NON_STABLE_DATA), ruleSet));
    record(
      22,
      'Présentation : NON_STABLE relayé comme classification valide, jamais converti en échec',
      'PRESENTATION',
      presentation.nf9272.classification === 'NON_STABLE' &&
        presentation.nf9272.dataStatusKind === 'VALID' &&
        !/échec|echec/i.test(JSON.stringify(presentation)),
      'classification=NON_STABLE + VALID + aucun terme « échec »',
      `class=${String(presentation.nf9272.classification)}, kind=${presentation.nf9272.dataStatusKind}`
    );
  }

  // 23 — Présentation : critères et valeurs formatées (aucune valeur inventée).
  {
    const presentation = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(STABLE_DATA), ruleSet));
    const idsOk = presentation.nf9272.criteria.map((c) => c.criterionId).join(',') === 'BLISTERING,CRACKING,FLAKING,ADHESION';
    record(
      23,
      'Présentation : 4 critères ordonnés, valeurs formatées « — » lorsque absentes',
      'PRESENTATION',
      idsOk && presentation.nf9272.criteria.every((c) => typeof c.value === 'string'),
      'BLISTERING,CRACKING,FLAKING,ADHESION + valeurs string',
      presentation.nf9272.criteria.map((c) => `${c.criterionId}=${c.value}`).join(' | ')
    );
  }

  // 24 — Présentation : indicateurs INFIPERF indépendants et notice complémentaire exposée.
  {
    const presentation = buildScientificCriteriaPresentation(evaluateScientificCriteria(trialWithData(STABLE_DATA, 40), ruleSet));
    record(
      24,
      'Présentation INFIPERF : 4 indicateurs indépendants + notice complémentaire exposée',
      'PRESENTATION',
      presentation.infiperf.indicators.length === 4 &&
        presentation.infiperf.hasGlobalVerdict === false &&
        presentation.infiperf.complementaryNotice.length > 0,
      '4 indicateurs, hasGlobalVerdict=false, notice non vide',
      `${presentation.infiperf.indicators.length} indicateurs, verdict=${String(presentation.infiperf.hasGlobalVerdict)}`
    );
  }

  // 25 — Déterminisme : mêmes entrées => résultat applicatif strictement identique.
  {
    const trial = trialWithData(STABLE_DATA, 40);
    const first = evaluateScientificCriteria(trial, ruleSet, { batchId: 'b1' });
    const second = evaluateScientificCriteria(trial, ruleSet, { batchId: 'b1' });
    record(
      25,
      'Service : déterminisme strict — mêmes entrées, même résultat',
      'SERVICE_DETERMINISM',
      JSON.stringify(first) === JSON.stringify(second),
      'résultats strictement identiques',
      JSON.stringify(first) === JSON.stringify(second) ? 'identiques' : 'différents'
    );
  }

  // 26 — A1 : une entrée RAW à deux positions dont une seule est exploitable
  // ne doit jamais être interprétée comme un panelMean exploitable.
  {
    const trial = createTrial();
    const panels = [P_E1, P_E2, P_E3];
    panels.forEach((panel, i) => {
      seedObservation(trial, C12_STAGE_ID, panel.id, 'b1', {
        BLISTERING: 0,
        CRACKING: 0,
        FLAKING: 0
      });
      seedAdhesion(
        trial,
        C12_STAGE_ID,
        panel.id,
        'b1',
        i === 0 ? [0, null] : [0]
      );
    });

    const e = evaluateScientificCriteria(trial, ruleSet, { batchId: 'b1' });
    record(
      26,
      'A1 : mesure d’adhérence non exploitable non convertie artificiellement en panelMean',
      'ADHESION_A1',
      e.nf9272.testValidity === 'INSUFFICIENT_DATA' &&
        e.nf9272.classification === null,
      'INSUFFICIENT_DATA + classification=null',
      `${e.nf9272.testValidity} + ${String(e.nf9272.classification)}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    results,
    summary: { total: results.length, passed, failed: results.length - passed }
  };
}
