/**
 * QUV-Lab — NON-RÉGRESSION ORIENTATION GLOSS (post PR #106).
 *
 * PR #106 a livré la sémantique S0 : Série #1 = GRAIN_DIRECTION (faisceau
 * strictement parallèle au fil), Série #2 = OPPOSITE_GRAIN_DIRECTION
 * (instrument tourné de 180°, faisceau toujours parallèle au fil).
 * PERPENDICULAR_DIRECTION / « Perpendiculaire » n'existe plus dans le code
 * opérationnel moderne. Aucune géométrie moderne à 90° pour la série #2.
 *
 * Cette suite vérifie UNIQUEMENT le comportement déjà mergé — elle n'introduit
 * aucune logique métier, ne modifie ni glossEngine, ni ruleSet, ni l'UI.
 *
 * GLOSS-ORIENTATION-01 — Config standard : contient GRAIN_DIRECTION +
 *   OPPOSITE_GRAIN_DIRECTION, jamais PERPENDICULAR_DIRECTION (valeur réelle).
 * GLOSS-ORIENTATION-02 — Série #2 du modèle réel = OPPOSITE_GRAIN_DIRECTION.
 * GLOSS-ORIENTATION-03 — getGlossOrientationLabel() : source unique de
 *   traduction code → libellé « Sens opposé au fil » (notion 180°).
 * GLOSS-ORIENTATION-04 — Acquisition réelle (recordAcquisition) : RAW conserve
 *   les deux orientations modernes ; aucune acquisition moderne ne produit
 *   PERPENDICULAR_DIRECTION.
 * GLOSS-ORIENTATION-05 — Calcul gloss (calculateGloss) : les deux séries
 *   modernes exploitées normalement (moyenne, écart-type, rétention) ; jamais
 *   d'interprétation à 90°.
 * GLOSS-ORIENTATION-06 — Legacy VERBATIM : un RAW historique « Perpendiculaire »
 *   est préservé tel quel, aucune migration vers OPPOSITE_GRAIN_DIRECTION.
 */

import { getDefaultScientificRuleSet, createSeriesConfiguration } from '../ruleSet';
import { calculateGloss, getGlossOrientationLabel } from '../glossEngine';
import { generateStandardExposureStages, globalTrialStore } from '../../services/trialStore';
import { GlossRawData, GlossComputedData, ScientificRuleSet } from '../../types/scientific';
import { Trial, BatchDefinition, PanelDefinition } from '../../types/trial';

export interface GlossOrientationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runGlossOrientationTests(): {
  results: GlossOrientationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: GlossOrientationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const ruleSet: ScientificRuleSet = getDefaultScientificRuleSet();
  const glossConfig = createSeriesConfiguration('GLOSS', 2, 2, ruleSet);

  // ---------------------------------------------------------------------------
  // Helpers (réutilisés sans dupliquer les sources de vérité métier)
  // ---------------------------------------------------------------------------

  const modernGlossRaw = (values: number[]): GlossRawData => ({
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
    ],
    instrumentMetadata: { instrumentId: 'TRI-GLOSS-60-LAB', geometry: '60' }
  });

  const legacyGlossRaw = (values: number[]): GlossRawData => ({
    series: [
      {
        seriesIndex: 1,
        orientation: 'Sens du fil',
        readings: values.slice(0, 2).map((value, i) => ({ pointIndex: i + 1, value }))
      },
      {
        seriesIndex: 2,
        orientation: 'Perpendiculaire',
        readings: values.slice(2, 4).map((value, i) => ({ pointIndex: i + 1, value }))
      }
    ],
    instrumentMetadata: { instrumentId: 'TRI-GLOSS-60-LAB', geometry: '60' }
  });

  function buildGlossTrial(seq: string): Trial {
    const trialId = `trial-gloss-orientation-${seq}-${Date.now()}`;
    const stages = generateStandardExposureStages(trialId);
    const batchId = `${trialId}-batch-1`;
    const panels: PanelDefinition[] = [
      { id: `${batchId}-e1`, label: 'E1', roleCode: 'E1', role: 'EXPOSED_1', batchId, status: 'ACTIVE', index: 1 }
    ];
    const batches: BatchDefinition[] = [
      { id: batchId, trialId, orderIndex: 1, reference: `LOT-GO-${seq}`, panels }
    ];
    return {
      id: trialId,
      schemaVersion: '1.2.0',
      createdAt: '2026-09-11T00:00:00Z',
      updatedAt: '2026-09-11T00:00:00Z',
      metadata: { reference: `QUV-GLOSS-ORIENTATION-${seq}`, createdBy: 'TEST_OP' },
      status: 'IN_PROGRESS',
      configurationStatus: 'EDITABLE',
      config: {
        standardReference: 'NF EN 927-6',
        activeFamilies: ['GLOSS'],
        familyConfigs: {
          GLOSS: { familyId: 'GLOSS', enabled: true }
        }
      },
      scheduleConfig: {
        cycleDurationHours: 168,
        maxCycles: 12,
        initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
        intermediateCycles: [],
        finalCycle: { cycleIndex: 12, mandatory: true }
      },
      stages,
      batches,
      acquisitions: {},
      auditTrail: [],
      mediaReferences: []
    } as Trial;
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-01 — Configuration standard
  // ---------------------------------------------------------------------------
  {
    const standard = ruleSet.seriesConfigurations?.GLOSS?.standardConfiguration;
    const orientations = standard?.orientations ?? [];
    const containsModernPair =
      orientations.length === 2 &&
      orientations.includes('GRAIN_DIRECTION') &&
      orientations.includes('OPPOSITE_GRAIN_DIRECTION');
    const noForbidden = !orientations.includes('PERPENDICULAR_DIRECTION');
    const forbiddenFound = orientations.filter((o) => o.includes('PERPENDICULAR'));
    record(
      'GLOSS-ORIENTATION-01',
      'Config standard GLOSS : contient GRAIN_DIRECTION + OPPOSITE_GRAIN_DIRECTION, jamais PERPENDICULAR_DIRECTION',
      containsModernPair && noForbidden,
      `[GRAIN_DIRECTION, OPPOSITE_GRAIN_DIRECTION] sans PERPENDICULAR_DIRECTION (2 orientations)`,
      `orientations=${JSON.stringify(orientations)} (${orientations.length}) forbidden=${JSON.stringify(forbiddenFound)}`
    );
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-02 — Série #2 du modèle réellement utilisé
  // ---------------------------------------------------------------------------
  {
    const standard = ruleSet.seriesConfigurations?.GLOSS?.standardConfiguration.orientations ?? [];
    const configured = ruleSet.seriesConfigurations?.GLOSS?.configuredConfiguration.orientations ?? [];
    const second = (arr: readonly string[]) => (arr.length >= 2 ? arr[1] : undefined);
    const isModern =
      second(standard) === 'OPPOSITE_GRAIN_DIRECTION' &&
      second(configured) === 'OPPOSITE_GRAIN_DIRECTION' &&
      second(standard) !== 'PERPENDICULAR_DIRECTION' &&
      second(configured) !== 'PERPENDICULAR_DIRECTION';
    record(
      'GLOSS-ORIENTATION-02',
      "Série #2 du modèle réel (standard + configuré) = OPPOSITE_GRAIN_DIRECTION, pas PERPENDICULAR_DIRECTION",
      isModern,
      `second(standard) === second(configured) === 'OPPOSITE_GRAIN_DIRECTION'`,
      `standard#2=${JSON.stringify(second(standard))} configured#2=${JSON.stringify(second(configured))}`
    );
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-03 — Libellé via getGlossOrientationLabel (source unique)
  // ---------------------------------------------------------------------------
  {
    const labelOpposite = getGlossOrientationLabel('OPPOSITE_GRAIN_DIRECTION');
    const labelGrain = getGlossOrientationLabel('GRAIN_DIRECTION');
    const oppositeModern =
      labelOpposite.includes('Sens opposé au fil') && labelOpposite.includes('180');
    const grainModern = labelGrain === 'Sens du fil';
    record(
      'GLOSS-ORIENTATION-03',
      'getGlossOrientationLabel() traduit OPPOSITE_GRAIN_DIRECTION en « Sens opposé au fil » (notion 180°)',
      oppositeModern && grainModern,
      `label(OPPOSITE_GRAIN_DIRECTION) contient 'Sens opposé au fil' et '180' ; label(GRAIN_DIRECTION) = 'Sens du fil'`,
      `opposite=${JSON.stringify(labelOpposite)} grain=${JSON.stringify(labelGrain)}`
    );
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-04 — Acquisition réelle, RAW conservé en moderne
  // ---------------------------------------------------------------------------
  {
    const trial = buildGlossTrial('04');
    globalTrialStore.saveTrial(trial);
    const values = [44.5, 44.8, 43.2, 43.6];
    const raw = modernGlossRaw(values);
    const stageId = trial.stages[0].id;
    const batchId = trial.batches[0].id;
    const panelId = trial.batches[0].panels[0].id;

    let thrown: string | null = null;
    let storedRaw: GlossRawData | null = null;
    try {
      const recorded = globalTrialStore.recordAcquisition({
        trialId: trial.id,
        stageId,
        batchId,
        panelId,
        familyId: 'GLOSS',
        raw,
        operatorId: 'Tech Paillasse GO-04'
      });
      const rec = recorded.trial.acquisitions[`${stageId}__${panelId}__GLOSS`];
      storedRaw = rec?.raw as GlossRawData;
    } catch (e) {
      thrown = e instanceof Error ? e.message : String(e);
    }

    const orientations = storedRaw ? storedRaw.series.map((s) => s.orientation) : [];
    const rawPreserved = storedRaw !== null && JSON.stringify(storedRaw) === JSON.stringify(raw);
    const modernOnly =
      orientations.length === 2 &&
      orientations[0] === 'GRAIN_DIRECTION' &&
      orientations[1] === 'OPPOSITE_GRAIN_DIRECTION';
    const noForbidden = !orientations.some((o) => o.includes('PERPENDICULAR'));
    record(
      'GLOSS-ORIENTATION-04',
      'Acquisition gloss réelle : RAW conserve GRAIN_DIRECTION + OPPOSITE_GRAIN_DIRECTION, aucune moderne PERPENDICULAR',
      thrown === null && rawPreserved && modernOnly && noForbidden,
      `recordAcquisition sans rejet, RAW inchangé = [GRAIN_DIRECTION, OPPOSITE_GRAIN_DIRECTION]`,
      thrown !== null ? `rejeté: ${thrown}` : `orientations=${JSON.stringify(orientations)} preserved=${rawPreserved}`
    );
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-05 — Calcul gloss : deux séries modernes, aucune 90°
  // ---------------------------------------------------------------------------
  {
    const t0 = modernGlossRaw([44.5, 44.8, 43.2, 43.6]);
    const tt = modernGlossRaw([41.0, 41.2, 40.1, 40.3]);
    const res = calculateGloss(tt, glossConfig, ruleSet, { referenceRaw: t0 });

    const seriesStats = res.computed.seriesStats;
    const meanGloss = res.computed.meanGloss;
    const stdDevGloss = res.computed.stdDevGloss;
    const retention = res.computed.retentionRatePercent;

    const expectedMean = (41.0 + 41.2 + 40.1 + 40.3) / 4;
    const meanOk = meanGloss === Math.round(expectedMean * 100) / 100;
    const stdOk = stdDevGloss !== null && stdDevGloss !== undefined;
    const retentionOk = retention !== null && retention !== undefined && retention > 90 && retention < 93;
    const twoSeries = seriesStats.length === 2;
    const series2Label = seriesStats[1]?.orientation ?? '';
    const no90Interpretation =
      series2Label.includes('Sens opposé au fil') &&
      !series2Label.includes('90') &&
      !/perpendiculaire/i.test(series2Label) &&
      res.alerts.every((a) => !/90|perpendiculaire/i.test(a.message ?? ''));

    record(
      'GLOSS-ORIENTATION-05',
      'Calcul gloss : moyenne/écart-type/rétention inchangés sur les deux séries modernes, aucune interprétation à 90°',
      twoSeries && meanOk && stdOk && retentionOk && no90Interpretation,
      `mean=${expectedMean.toFixed(2)} + stdDev non nul + rétention ≈ 92.3% ; série #2 libellée 'Sens opposé au fil' sans 90°`,
      `mean=${JSON.stringify(meanGloss)} stdDev=${JSON.stringify(stdDevGloss)} retention=${JSON.stringify(retention)} series2=${JSON.stringify(series2Label)} alerts=${res.alerts.length}`
    );
  }

  // ---------------------------------------------------------------------------
  // GLOSS-ORIENTATION-06 — Legacy VERBATIM (aucune migration)
  // ---------------------------------------------------------------------------
  {
    const trial = buildGlossTrial('06');
    globalTrialStore.saveTrial(trial);
    const values = [44.5, 44.8, 43.2, 43.6];
    const raw = legacyGlossRaw(values);
    const stageId = trial.stages[0].id;
    const batchId = trial.batches[0].id;
    const panelId = trial.batches[0].panels[0].id;

    let thrown: string | null = null;
    let storedRaw: GlossRawData | null = null;
    let computedMean: number | null | undefined = null;
    try {
      const recorded = globalTrialStore.recordAcquisition({
        trialId: trial.id,
        stageId,
        batchId,
        panelId,
        familyId: 'GLOSS',
        raw,
        operatorId: 'Tech Paillasse GO-06'
      });
      const rec = recorded.trial.acquisitions[`${stageId}__${panelId}__GLOSS`];
      storedRaw = rec?.raw as GlossRawData;
      computedMean = (rec?.computed as GlossComputedData | null | undefined)?.meanGloss;
    } catch (e) {
      thrown = e instanceof Error ? e.message : String(e);
    }

    const rawPreserved = storedRaw !== null && JSON.stringify(storedRaw) === JSON.stringify(raw);
    const legacyVerbatim = storedRaw?.series[1]?.orientation === 'Perpendiculaire';
    const labelVerbatim = getGlossOrientationLabel('Perpendiculaire') === 'Perpendiculaire';
    const noMigration = !(storedRaw?.series ?? []).some((s) => s.orientation === 'OPPOSITE_GRAIN_DIRECTION');
    const engineStillWorks = computedMean !== null && computedMean !== undefined;

    record(
      'GLOSS-ORIENTATION-06',
      'Legacy VERBATIM : RAW historique « Perpendiculaire » préservé tel quel, aucune migration vers OPPOSITE_GRAIN_DIRECTION',
      thrown === null && rawPreserved && legacyVerbatim && labelVerbatim && noMigration && engineStillWorks,
      `RAW conservé verbatim, libellé renvoyé tel quel, pas d'OPPOSITE_GRAIN_DIRECTION introduit, calcul toujours opérant`,
      thrown !== null
        ? `rejeté: ${thrown}`
        : `verbatim=${legacyVerbatim} labelVerbatim=${labelVerbatim} migrated=${!noMigration} computedMean=${JSON.stringify(computedMean)}`
    );
  }

  const failed = results.filter((r) => !r.passed).length;
  return { results, summary: { total: results.length, passed: results.length - failed, failed } };
}