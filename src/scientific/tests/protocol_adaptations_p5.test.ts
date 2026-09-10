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
 * 4. §21 — Justification minimale (8 caractères après trim, prédicat centralisé) :
 *    acceptation/refus, évaluation par famille, rapport NON RENSEIGNÉE, garde de service
 *    adaptProtocolConfig, ADHESION 1|2 conservé et rejets numériques inchangés.
 */

import { generateStandardExposureStages, globalTrialStore } from '../../services/trialStore';
import { buildScientificReport } from '../../services/reportGenerator';
import {
  getDefaultScientificRuleSet,
  createCountConfiguration,
  createSeriesConfiguration,
  isAdaptationJustificationValid
} from '../ruleSet';
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

  // ===== §21 — JUSTIFICATION MINIMALE 8 CARACTÈRES (prédicat centralisé) =====
  {
    const boolRecord = (id: string, name: string, got: boolean, expected: boolean) =>
      record(id, name, got === expected, String(expected), String(got));

    // Prédicat : aucune règle sémantique, uniquement présence + trim ≥ 8.
    boolRecord('P0-J-01', 'Prédicat « 12345678 » → valide', isAdaptationJustificationValid('12345678'), true);
    boolRecord('P0-J-02', 'Prédicat « Éprouvette étroite » → valide', isAdaptationJustificationValid('Éprouvette étroite'), true);
    boolRecord('P0-J-03', 'Prédicat «        12345678        » (trim) → valide', isAdaptationJustificationValid('       12345678       '), true);
    boolRecord('P0-J-04', 'Prédicat « » (vide) → invalide', isAdaptationJustificationValid(''), false);
    boolRecord('P0-J-05', 'Prédicat « test » (4) → invalide', isAdaptationJustificationValid('test'), false);
    boolRecord('P0-J-06', 'Prédicat « 1234567 » (7) → invalide', isAdaptationJustificationValid('1234567'), false);
    boolRecord('P0-J-07', 'Prédicat «        1234567        » (7 après trim) → invalide', isAdaptationJustificationValid('       1234567       '), false);
    boolRecord('P0-J-08', 'Prédicat undefined (historique/import) → invalide', isAdaptationJustificationValid(undefined), false);

    const comp = (fc?: ReturnType<typeof createCountConfiguration>, sc?: ReturnType<typeof createSeriesConfiguration>) =>
      sc ? evaluateSeriesProtocolCompliance(sc, ruleSet).status : evaluateCountProtocolCompliance(fc as MeasurementCountConfiguration, ruleSet).status;

    const expectStatus = (id: string, name: string, status: string, expected: string) =>
      record(id, name, status === expected, expected, status);

    expectStatus('P0-J-11', 'COLOR 3 + 8 chars → ADAPTED_JUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: '12345678' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-12', 'COLOR 3 + « Éprouvette étroite » → ADAPTED_JUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: 'Éprouvette étroite' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-13', 'COLOR 3 + 7 chars → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: '1234567' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-14', 'COLOR 3 + 7 chars (pad, trim) → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: '       1234567       ' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-15', 'COLOR 3 + « test » → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: 'test' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-16', 'COLOR 3 + vide → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('COLOR', 3, ruleSet, { justification: '' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-17', 'GLOSS 1×2 + 8 chars → ADAPTED_JUSTIFIED',
      comp(undefined, createSeriesConfiguration('GLOSS', 1, 2, ruleSet, { justification: '12345678' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-18', 'GLOSS 1×2 + 7 chars → ADAPTED_UNJUSTIFIED',
      comp(undefined, createSeriesConfiguration('GLOSS', 1, 2, ruleSet, { justification: '1234567' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-19', 'PERSOZ 2 + 8 chars → ADAPTED_JUSTIFIED',
      comp(createCountConfiguration('PERSOZ', 2, ruleSet, { justification: '12345678' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-21', 'PERSOZ 2 + 7 chars → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('PERSOZ', 2, ruleSet, { justification: '1234567' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-22', 'ADHESION 1 + 8 chars → ADAPTED_JUSTIFIED',
      comp(createCountConfiguration('ADHESION', 1, ruleSet, { justification: '12345678' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-23', 'ADHESION 1 + 7 chars → ADAPTED_UNJUSTIFIED',
      comp(createCountConfiguration('ADHESION', 1, ruleSet, { justification: '1234567' })), 'ADAPTED_UNJUSTIFIED');
    expectStatus('P0-J-24', 'ADHESION 1 + « Éprouvette étroite » → ADAPTED_JUSTIFIED',
      comp(createCountConfiguration('ADHESION', 1, ruleSet, { justification: 'Éprouvette étroite' })), 'ADAPTED_JUSTIFIED');
    expectStatus('P0-J-25', 'ADHESION 2 (+ justification courte) → STANDARD (std prioritaire)',
      comp(createCountConfiguration('ADHESION', 2, ruleSet, { justification: 'test' })), 'STANDARD');
    record('P0-J-26', 'ADHESION 3 → toujours rejeté (1|2 préservé)',
      Boolean(throws(() => createCountConfiguration('ADHESION', 3, ruleSet, { justification: '12345678' }))),
      'rejeté', 'la validation numérique est conservée');
    record('P0-J-27', 'COLOR 0 → toujours rejeté (validation numérique inchangée)',
      Boolean(throws(() => createCountConfiguration('COLOR', 0, ruleSet, { justification: '12345678' }))),
      'rejeté', 'la validation numérique est conservée');

    // Rapport P5-G : insuffisante → NON RENSEIGNÉE ; suffisante (trim) → motif réel.
    {
      const shortJust: Partial<TrialProtocolConfig['familyConfigs']> = {
        COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 3, ruleSet, { justification: '1234567', operatorId: 'TEST_OP' }) },
        GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet) },
        PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
        ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 2, ruleSet) }
      };
      const rShort = buildScientificReport(buildProtocolTrial(21, shortJust), ruleSet, { operatorId: 'TEST_OP' });
      const okShort = rShort.sections.colorResults.includes('Statut : PROTOCOLE ADAPTÉ') &&
        rShort.sections.colorResults.includes('Justification : NON RENSEIGNÉE');
      record('P0-J-30', 'Rapport adapté JUSTIFICATION < 8 chars → NON RENSEIGNÉE (jamais inventée)',
        okShort, 'NON RENSEIGNÉE', okShort ? 'OK' : 'BLOQUÉ');
      record('P0-J-31', 'Statut global rapport = ADAPTED_UNJUSTIFIED', rShort.protocolStatus === 'ADAPTED_UNJUSTIFIED',
        'ADAPTED_UNJUSTIFIED', `reçu ${rShort.protocolStatus}`);
    }
    {
      const trimJust: Partial<TrialProtocolConfig['familyConfigs']> = {
        COLOR: { familyId: 'COLOR', enabled: true, countConfig: createCountConfiguration('COLOR', 3, ruleSet, { justification: '       12345678       ', operatorId: 'TEST_OP' }) },
        GLOSS: { familyId: 'GLOSS', enabled: true, seriesConfig: createSeriesConfiguration('GLOSS', 2, 2, ruleSet) },
        PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
        ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 2, ruleSet) }
      };
      const rTrim = buildScientificReport(buildProtocolTrial(22, trimJust), ruleSet, { operatorId: 'TEST_OP' });
      const okTrim = rTrim.sections.colorResults.includes('Justification : 12345678');
      record('P0-J-32', 'Rapport adapté JUSTIFICATION ≥ 8 (pad) → motif réel restitué (trim)',
        okTrim, 'Justification : 12345678', okTrim ? 'OK' : 'BLOQUÉ');
      record('P0-J-33', 'Statut global rapport = ADAPTED_JUSTIFIED', rTrim.protocolStatus === 'ADAPTED_JUSTIFIED',
        'ADAPTED_JUSTIFIED', `reçu ${rTrim.protocolStatus}`);
    }

    // Garde de service adaptProtocolConfig (nouvelle configuration via le chemin normal)
    {
      const pact = (seq: number): Trial => {
        const base = buildProtocolTrial(seq, {
          PERSOZ: { familyId: 'PERSOZ', enabled: true, countConfig: createCountConfiguration('PERSOZ', 3, ruleSet) },
          ADHESION: { familyId: 'ADHESION', enabled: true, countConfig: createCountConfiguration('ADHESION', 2, ruleSet) }
        });
        const t = { ...base, id: `MOCK_TEST_P5_JUST_${seq}` };
        globalTrialStore.saveTrial(t);
        return t;
      };

      const t1 = pact(31);
      const msg31 = throws(() => globalTrialStore.adaptProtocolConfig(t1.id, 'PERSOZ', 2, 'court', 'TEST_OP'));
      record('P0-J-40', 'Service adaptProtocolConfig PERSOZ 2 + « court » → rejeté (8 min)',
        Boolean(msg31) && (msg31 as string).includes('8 caractères minimum'), `rejet avec « 8 caractères minimum » (${msg31})`, String(msg31));

      const t2 = pact(32);
      const rt2 = globalTrialStore.adaptProtocolConfig(t2.id, 'PERSOZ', 2, '       12345678       ', 'TEST_OP');
      const ok32 = rt2.config.familyConfigs.PERSOZ?.countConfig?.configuredCount === 2 &&
        rt2.config.familyConfigs.PERSOZ?.countConfig?.deviationFromStandard === true &&
        rt2.config.familyConfigs.PERSOZ?.countConfig?.justification === '12345678';
      record('P0-J-41', 'Service adaptProtocolConfig PERSOZ 2 + « 12345678 » (pad) → accepté (trim normalisé)',
        ok32, 'deviation true, 2 répétitions, justification persistée (trim)', ok32 ? 'OK' : 'BLOQUÉ');
      record('P0-J-42', 'Service : ADHESION 3 (même justifiée) → rejeté « Seules 2 mesures/panneau »',
        throws(() => globalTrialStore.adaptProtocolConfig(t2.id, 'ADHESION', 3, '12345678', 'TEST_OP')) !== null,
        'rejeté', 'ADHESION reste 1|2');
      {
        const t3 = pact(33);
        const rt3 = globalTrialStore.adaptProtocolConfig(t3.id, 'ADHESION', 1, '12345678', 'TEST_OP');
        const ok33 = rt3.config.familyConfigs.ADHESION?.countConfig?.configuredCount === 1 &&
          rt3.config.familyConfigs.ADHESION?.countConfig?.deviationFromStandard === true;
        record('P0-J-43', 'Service : ADHESION 1 + 8 chars → accepté (adaptation préservée)',
          ok33, 'deviation true, 1 mesure', ok33 ? 'OK' : 'BLOQUÉ');
      }
      {
        const t4 = pact(34);
        const rt4 = globalTrialStore.adaptProtocolConfig(t4.id, 'COLOR', 4, 'test', 'TEST_OP');
        const ok34 = rt4.config.familyConfigs.COLOR?.countConfig?.deviationFromStandard === false;
        record('P0-J-44', 'Service : COLOR 4 standard + justification courte → accepté STANDARD',
          ok34, 'deviation false (standard sans justification requise)', ok34 ? 'OK' : 'BLOQUÉ');
      }
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