/**
 * QUV-Lab — Suite de Tests P5 : GESTION EXPLICITE DES PROTOCOLES ADAPTÉS.
 *
 * 1. §18 — Validation centrale : createCountConfiguration / createSeriesConfiguration
 *    rejettent 0, décimal (1.5), NaN, ±Infinity, négatifs ; ADHESION limité à 1|2.
 * 2. §19 — Évaluation par famille via protocolEngine : STANDARD / ADAPTED_JUSTIFIED /
 *    ADAPTED_UNJUSTIFIED pour COLOR (4 pts), GLOSS (2x2), PERSOZ (3 reps), ADHESION (2).
 *    L'adaptation n'est jamais une invalidation (1 mesure justifiée → ADAPTED_JUSTIFIED).
 * 3. §20 — Rapport P5-G : bloc PROTOCOLE DE MESURE préfixé aux sections famille,
 *    références issues du ruleSet, justification réelle ou NON RENSEIGNÉE (jamais inventée).
 */

import { generateStandardExposureStages } from '../../services/trialStore';
import { buildScientificReport } from '../../services/reportGenerator';
import { getDefaultScientificRuleSet, createCountConfiguration, createSeriesConfiguration } from '../ruleSet';
import { evaluateCountProtocolCompliance, evaluateSeriesProtocolCompliance } from '../protocolEngine';
import type { Trial, TrialProtocolConfig } from '../../types/trial';
import type { MeasurementCountConfiguration } from '../../types/scientific';

export interface ProtocolAdaptationsTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function buildProtocolTrial(seq: number, familyConfigs: Partial<TrialProtocolConfig['familyConfigs']>): Trial {
  const trialId = `trial-p5-${seq}`;
  const stages = generateStandardExposureStages(trialId);
  const batchId = `${trialId}-batch-1`;
  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: '2026-09-10T00:00:00Z',
    updatedAt: '2026-09-10T00:00:00Z',
    metadata: { reference: `QUV-P5-${seq}`, createdBy: 'TEST_OP' },
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION'],
      familyConfigs: familyConfigs as TrialProtocolConfig['familyConfigs']
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: [],
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches: [{ id: batchId, trialId, reference: `LOT P5-${seq}`, orderIndex: 1, panels: [] }],
    acquisitions: {},
    auditTrail: [],
    mediaReferences: []
  } as Trial;
}

export function runProtocolAdaptationsTests(): {
  results: ProtocolAdaptationsTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ProtocolAdaptationsTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const ruleSet = getDefaultScientificRuleSet();

  const throws = (fn: () => unknown): string | null => {
    try {
      fn();
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    return null;
  };

  // ===== §18 — VALIDATION CENTRALE (P5-A) =====
  {
    const assertRejected = (
      id: string,
      name: string,
      valueLabel: string,
      msg: string | null | undefined,
      expectedFragment = 'entier fini supérieur ou égal à 1'
    ): void => {
      const rejected = Boolean(msg);
      const ok = rejected && (msg as string).includes(expectedFragment);
      record(id, name, ok, `rejet avec « ${expectedFragment} »`, ok ? `rejeté (${valueLabel})` : `non rejeté ou message inattendu : ${msg}`);
    };

    assertRejected('P0-V-01', 'COLOR 0 → rejeté', '0', throws(() => createCountConfiguration('COLOR', 0, ruleSet)));
    assertRejected('P0-V-02', 'COLOR 1.5 (décimal) → rejeté', '1.5', throws(() => createCountConfiguration('COLOR', 1.5, ruleSet)));
    assertRejected('P0-V-03', 'COLOR NaN → rejeté', 'NaN', throws(() => createCountConfiguration('COLOR', Number.NaN, ruleSet)));
    assertRejected('P0-V-04', 'COLOR +Infinity → rejeté', 'Infinity', throws(() => createCountConfiguration('COLOR', Number.POSITIVE_INFINITY, ruleSet)));
    assertRejected('P0-V-05', 'COLOR -4 (négatif) → rejeté', '-4', throws(() => createCountConfiguration('COLOR', -4, ruleSet)));
    assertRejected('P0-V-06', 'GLOSS 0 série → rejeté', '0', throws(() => createSeriesConfiguration('GLOSS', 0, 2, ruleSet)));
    assertRejected('P0-V-07', 'GLOSS 0 relevé → rejeté', '0', throws(() => createSeriesConfiguration('GLOSS', 2, 0, ruleSet)));
    assertRejected('P0-V-08', 'GLOSS 1.5 série (décimal) → rejeté', '1.5', throws(() => createSeriesConfiguration('GLOSS', 1.5, 2, ruleSet)));
    assertRejected('P0-V-09', 'ADHESION 0 → rejeté', '0', throws(() => createCountConfiguration('ADHESION', 0, ruleSet)));
    assertRejected('P0-V-10', 'ADHESION 3 → rejeté (seul 1|2 autorisé)', '3', throws(() => createCountConfiguration('ADHESION', 3, ruleSet)), 'Seules 2 mesures/panneau');
    assertRejected('P0-V-14', 'PERSOZ 0 → rejeté', '0', throws(() => createCountConfiguration('PERSOZ', 0, ruleSet)));

    {
      const c1 = createCountConfiguration('ADHESION', 1, ruleSet, { justification: 'Éprouvette réduite, justification métrologique.', operatorId: 'TEST_OP' });
      const ok = c1.deviationFromStandard === true && c1.standardRecommendedCount === 2 && c1.configuredCount === 1 && c1.justification === 'Éprouvette réduite, justification métrologique.';
      record('P0-V-11', 'ADHESION 1 → accepté (adaptation justifiée, référence 2 conservée)',
        ok, 'deviation true, std 2, just conservée', `cfg=${c1.configuredCount}, std=${c1.standardRecommendedCount}, dev=${c1.deviationFromStandard}`);
    }
    {
      const c4 = createCountConfiguration('COLOR', 4, ruleSet);
      const ok = c4.deviationFromStandard === false && c4.configuredCount === 4 && c4.standardRecommendedCount === 4 && c4.justification === undefined && c4.mode === 'STANDARD_DEFAULT';
      record('P0-V-12', 'COLOR 4 → accepté STANDARD (sans justification)',
        ok, 'deviation false, mode STANDARD_DEFAULT', `mode=${c4.mode}, dev=${c4.deviationFromStandard}`);
    }
    {
      const g = createSeriesConfiguration('GLOSS', 2, 2, ruleSet);
      const ok = g.deviationFromStandard === false && g.configuredConfiguration.seriesCount === 2 && g.configuredConfiguration.readingsPerSeries === 2;
      record('P0-V-13', 'GLOSS 2×2 → accepté STANDARD',
        ok, 'deviation false, 2×2', `series=${g.configuredConfiguration.seriesCount}, readings=${g.configuredConfiguration.readingsPerSeries}, dev=${g.deviationFromStandard}`);
    }
  }

  // ===== §19 — ÉVALUATION PAR FAMILLE (protocolEngine, jamais invalidation) =====
  {
    const comp = (fc?: ReturnType<typeof createCountConfiguration>, sc?: ReturnType<typeof createSeriesConfiguration>) =>
      sc ? evaluateSeriesProtocolCompliance(sc, ruleSet).status : evaluateCountProtocolCompliance(fc as MeasurementCountConfiguration, ruleSet).status;

    {
      const s = comp(createCountConfiguration('COLOR', 4, ruleSet));
      record('P0-E-01', 'COLOR 4 → STANDARD', s === 'STANDARD', 'STANDARD', s);
    }
    {
      const s = comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: 'Éprouvettes étroites 80 mm' }));
      record('P0-E-02', 'COLOR 3 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('COLOR', 1, ruleSet, { justification: 'Ligne de colle inexploitable' }));
      record('P0-E-03', 'COLOR 1 justifié → ADAPTED_JUSTIFIED (adaptation ≠ invalidité)', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('COLOR', 3, ruleSet));
      record('P0-E-04', 'COLOR 3 sans justification → ADAPTED_UNJUSTIFIED', s === 'ADAPTED_UNJUSTIFIED', 'ADAPTED_UNJUSTIFIED', s);
    }
    {
      const s = comp(undefined, createSeriesConfiguration('GLOSS', 2, 2, ruleSet));
      record('P0-E-05', 'GLOSS 2×2 → STANDARD', s === 'STANDARD', 'STANDARD', s);
    }
    {
      const s = comp(undefined, createSeriesConfiguration('GLOSS', 1, 2, ruleSet, { justification: 'Mesure unidirectionnelle' }));
      record('P0-E-06', 'GLOSS 1×2 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(undefined, createSeriesConfiguration('GLOSS', 2, 1, ruleSet, { justification: 'Allègement plan de mesure' }));
      record('P0-E-07', 'GLOSS 2×1 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(undefined, createSeriesConfiguration('GLOSS', 1, 1, ruleSet));
      record('P0-E-08', 'GLOSS 1×1 sans justification → ADAPTED_UNJUSTIFIED', s === 'ADAPTED_UNJUSTIFIED', 'ADAPTED_UNJUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('PERSOZ', 3, ruleSet));
      record('P0-E-09', 'PERSOZ 3 → STANDARD', s === 'STANDARD', 'STANDARD', s);
    }
    {
      const s = comp(createCountConfiguration('PERSOZ', 2, ruleSet, { justification: 'Éprouvette étroite' }));
      record('P0-E-10', 'PERSOZ 2 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('PERSOZ', 1, ruleSet, { justification: 'Haute dureté, temps long' }));
      record('P0-E-11', 'PERSOZ 1 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('ADHESION', 2, ruleSet));
      record('P0-E-12', 'ADHESION 2 → STANDARD', s === 'STANDARD', 'STANDARD', s);
    }
    {
      const s = comp(createCountConfiguration('ADHESION', 1, ruleSet, { justification: 'Éprouvette réduite, justification métrologique.' }));
      record('P0-E-13', 'ADHESION 1 justifié → ADAPTED_JUSTIFIED', s === 'ADAPTED_JUSTIFIED', 'ADAPTED_JUSTIFIED', s);
    }
    {
      const s = comp(createCountConfiguration('ADHESION', 1, ruleSet));
      record('P0-E-14', 'ADHESION 1 sans justification → ADAPTED_UNJUSTIFIED', s === 'ADAPTED_UNJUSTIFIED', 'ADAPTED_UNJUSTIFIED', s);
    }
  }

  // ===== §20 — RAPPORT P5-G : BLOC PROTOCOLE DE MESURE =====
  {
    const stdFamilies: Partial<TrialProtocolConfig['familyConfigs']> = {
      COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 4, ruleSet) },
      GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet) },
      PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
      ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 2, ruleSet) }
    };
    const rStd = buildScientificReport(buildProtocolTrial(1, stdFamilies), ruleSet, { operatorId: 'TEST_OP' });

    {
      const ok = rStd.sections.colorResults.includes('PROTOCOLE DE MESURE — COULEUR L*a*b*') &&
        rStd.sections.colorResults.includes('Statut : PROTOCOLE STANDARD') &&
        rStd.sections.colorResults.includes('Configuration de référence : 4 point(s) par éprouvette') &&
        !rStd.sections.colorResults.includes('Justification');
      record('P0-R-01', 'Rapport COLOR standard : PROTOCOLE STANDARD, référence 4 pts, sans justification',
        ok, '4 pts / STANDARD', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rStd.sections.glossResults.includes('PROTOCOLE DE MESURE — BRILLANCE SPÉCULAIRE 60°') &&
        rStd.sections.glossResults.includes('2 séries × 2 relevés') &&
        rStd.sections.glossResults.includes('Statut : PROTOCOLE STANDARD');
      record('P0-R-02', 'Rapport GLOSS standard : 2×2 relevés, STANDARD', ok, '2×2 / STANDARD', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rStd.sections.persozResults.includes('PROTOCOLE DE MESURE — DURETÉ PERSOZ') &&
        rStd.sections.persozResults.includes('3 répétition(s) par éprouvette') &&
        rStd.sections.persozResults.includes('Statut : PROTOCOLE STANDARD');
      record('P0-R-03', 'Rapport PERSOZ standard : 3 répétitions, STANDARD', ok, '3 reps / STANDARD', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = (rStd.sections.adhesionResults ?? '').includes('PROTOCOLE DE MESURE — ADHÉRENCE PAR QUADRILLAGE (NF EN ISO 2409:2020)') &&
        (rStd.sections.adhesionResults ?? '').includes('2 mesure(s) par panneau') &&
        (rStd.sections.adhesionResults ?? '').includes('Statut : PROTOCOLE STANDARD');
      record('P0-R-04', 'Rapport ADHESION standard : 2 mesures/panneau, STANDARD', ok, '2/panneau / STANDARD', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = !rStd.sections.colorResults.includes('4 points normatifs');
      record('P0-R-13', 'Rapport standard : aucune valeur codée en dur « 4 points normatifs »', ok, 'non présent', String(ok));
    }

    const justFamilies: Partial<TrialProtocolConfig['familyConfigs']> = {
      COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 2, ruleSet, { justification: 'Largeur réduite (80 mm)', operatorId: 'TEST_OP' }) },
      GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 1, 2, ruleSet, { justification: 'Mesure unidirectionnelle', operatorId: 'TEST_OP' }) },
      PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 2, ruleSet, { justification: 'Éprouvette étroite', operatorId: 'TEST_OP' }) },
      ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 1, ruleSet, { justification: 'Éprouvette réduite, justification métrologique.', operatorId: 'TEST_OP' }) }
    };
    const rJust = buildScientificReport(buildProtocolTrial(2, justFamilies), ruleSet, { operatorId: 'TEST_OP' });

    {
      const ok = rJust.sections.colorResults.includes('Statut : PROTOCOLE ADAPTÉ') &&
        rJust.sections.colorResults.includes('Justification : Largeur réduite (80 mm)') &&
        rJust.sections.colorResults.includes('Configuration réalisée : 2 point(s) par éprouvette');
      record('P0-R-05', 'Rapport COLOR adapté justifié : ADAPTÉ + motif réel restitué', ok, 'ADAPTÉ + just', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rJust.sections.glossResults.includes('1 séries × 2 relevés') &&
        rJust.sections.glossResults.includes('Justification : Mesure unidirectionnelle');
      record('P0-R-06', 'Rapport GLOSS adapté justifié : 1×2 réalisé + motif', ok, '1×2 + just', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rJust.sections.persozResults.includes('Configuration réalisée : 2 répétition(s) par éprouvette') &&
        rJust.sections.persozResults.includes('Justification : Éprouvette étroite');
      record('P0-R-07', 'Rapport PERSOZ adapté justifié : 2 réalisées + motif', ok, '2 + just', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = (rJust.sections.adhesionResults ?? '').includes('Configuration réalisée : 1 mesure(s) par panneau') &&
        (rJust.sections.adhesionResults ?? '').includes('Justification : Éprouvette réduite, justification métrologique.');
      record('P0-R-08', 'Rapport ADHESION adapté justifié : 1 réalisée + motif', ok, '1 + just', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rJust.protocolStatus === 'ADAPTED_JUSTIFIED';
      record('P0-R-09', 'Statut global rapport adapté justifié = ADAPTED_JUSTIFIED', ok, `ADAPTED_JUSTIFIED (reçu ${rJust.protocolStatus})`, String(ok));
    }

    const unjustFamilies: Partial<TrialProtocolConfig['familyConfigs']> = {
      COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 3, ruleSet) },
      GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet) },
      PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
      ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 1, ruleSet) }
    };
    const rUnjust = buildScientificReport(buildProtocolTrial(3, unjustFamilies), ruleSet, { operatorId: 'TEST_OP' });

    {
      const ok = rUnjust.sections.colorResults.includes('Statut : PROTOCOLE ADAPTÉ') &&
        rUnjust.sections.colorResults.includes('Justification : NON RENSEIGNÉE');
      record('P0-R-10', 'Rapport COLOR adapté sans motif → NON RENSEIGNÉE explicite', ok, 'NON RENSEIGNÉE', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = (rUnjust.sections.adhesionResults ?? '').includes('Statut : PROTOCOLE ADAPTÉ') &&
        (rUnjust.sections.adhesionResults ?? '').includes('Justification : NON RENSEIGNÉE');
      record('P0-R-11', 'Rapport ADHESION adapté sans motif → NON RENSEIGNÉE explicite', ok, 'NON RENSEIGNÉE', ok ? 'OK' : 'BLOQUÉ');
    }
    {
      const ok = rUnjust.protocolStatus === 'ADAPTED_UNJUSTIFIED';
      record('P0-R-12', 'Statut global rapport adapté sans motif = ADAPTED_UNJUSTIFIED', ok, `ADAPTED_UNJUSTIFIED (reçu ${rUnjust.protocolStatus})`, String(ok));
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