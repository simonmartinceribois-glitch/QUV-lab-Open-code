/**
 * QUV-Lab — G52-DATE : date de début d'exposition (T0) paramétrable + purification G52-CLEAN.
 * Le calendrier est calé sur la date T0 de l'essai (source unique) : Ck = T0 + k × 168 h.
 * Aucun contexte de campagne historique (2026-08-30) ne peut être câblé au générateur.
 */

import { generateStandardExposureStages } from '../../services/trialStages';
import { TrialStoreService } from '../../services/trialStoreService';
import { TrialMetadata } from '../../types/trial';
import { MeasurementFamilyId } from '../../types/scientific';

export interface G52DateTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runG52DateExposureStartTests(): {
  results: G52DateTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: G52DateTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const HOURS_MS = 3600 * 1000;
  const startMs = new Date('2025-03-10T08:00:00.000Z').getTime();

  // G52-DATE-01 : T0 = date fournie.
  {
    const stages = generateStandardExposureStages('trial-date-01', '2025-03-10T08:00:00.000Z');
    const t0 = stages.find((s) => s.cycleIndex === 0)!;
    const passed = new Date(t0.scheduledAt!).getTime() === startMs;
    record('G52-DATE-01', 'T0 planifié à la date de début fournie',
      passed, '2025-03-10T08:00:00.000Z', String(t0.scheduledAt));
  }

  // G52-DATE-02 : C1 = T0 + 168 h exactement.
  {
    const stages = generateStandardExposureStages('trial-date-02', '2025-03-10T08:00:00.000Z');
    const c1 = stages.find((s) => s.cycleIndex === 1)!;
    const passed = new Date(c1.scheduledAt!).getTime() === startMs + 168 * HOURS_MS;
    record('G52-DATE-02', 'C1 planifié à T0 + 168 h (durée scientifique 168 h)',
      passed, '2025-03-17T08:00:00.000Z', String(c1.scheduledAt));
  }

  // G52-DATE-03 : C12 = T0 + 2016 h (12 × 168 h).
  {
    const stages = generateStandardExposureStages('trial-date-03', '2025-03-10T08:00:00.000Z');
    const c12 = stages.find((s) => s.cycleIndex === 12)!;
    const passed =
      new Date(c12.scheduledAt!).getTime() === startMs + 2016 * HOURS_MS &&
      c12.scheduledExposureHours === 2016;
    record('G52-DATE-03', 'C12 planifié à T0 + 2016 h, 2016 h scientifiques inchangées',
      passed, '2025-06-02T08:00:00.000Z / 2016 h', `${String(c12.scheduledAt)} / ${c12.scheduledExposureHours} h`);
  }

  // G52-DATE-04 : changement de T0 → dates planifiées décalées, valeurs scientifiques identiques.
  {
    const a = generateStandardExposureStages('trial-date-04a', '2025-03-10T08:00:00.000Z');
    const b = generateStandardExposureStages('trial-date-04b', '2025-06-20T08:00:00.000Z');
    const hoursEqual = a.every((sa, i) => sa.scheduledExposureHours === b[i].scheduledExposureHours);
    const datesShifted =
      new Date(b[0].scheduledAt!).getTime() - new Date(a[0].scheduledAt!).getTime() ===
      new Date('2025-06-20T08:00:00.000Z').getTime() - startMs;
    const c12Hours = a[12].scheduledExposureHours === 2016 && b[12].scheduledExposureHours === 2016;
    const passed = hoursEqual && datesShifted && c12Hours;
    record('G52-DATE-04', "T0 décalé → C1…C12 décalés d'autant, durées scientifiques inchangées (0…2016 h)",
      passed, 'mêmes scheduledExposureHours, schedule décalé',
      `décalage=${new Date(b[0].scheduledAt!).getTime() - new Date(a[0].scheduledAt!).getTime()}ms, écartsHoraires=${hoursEqual}`);
  }

  // G52-DATE-05 : AUCUN contexte de campagne (2026-08-30) ne peut être câblé — défaut = dynamique.
  {
    const before = Date.now();
    const stages = generateStandardExposureStages('trial-date-05');
    const after = Date.now();
    const t0 = stages.find((s) => s.cycleIndex === 0)!;
    const c12 = stages.find((s) => s.cycleIndex === 12)!;
    const t0Ms = new Date(t0.scheduledAt!).getTime();
    const noCampaign = t0.scheduledAt !== '2026-08-30T08:00:00.000Z';
    const dynamic = !isNaN(t0Ms) && t0Ms >= before - 1000 && t0Ms <= after + 1000;
    const aligned = new Date(c12.scheduledAt!).getTime() === t0Ms + 2016 * HOURS_MS;
    const passed = noCampaign && dynamic && aligned;
    record('G52-DATE-05', 'Générateur : aucune date de campagne 2026-08-30, défaut dynamique aligné (C12 = T0 + 2016 h)',
      passed, 'T0 ≈ maintenant, C12 = T0+2016 h, aucun 2026-08-30',
      `t0=${String(t0.scheduledAt)}, c12=${String(c12.scheduledAt)}`);
  }

  // G52-DATE-06 : createTrial — date T0 paramétrable, persistée et alignée sur les jalons.
  {
    const store = TrialStoreService.createIsolatedStore();
    const meta: TrialMetadata = {
      reference: 'DATE-TEST-001',
      title: 'Essai date T0',
      createdBy: 'Auditeur Métrologie'
    };
    const baseBatches = [
      {
        reference: 'LOT-DATE-A',
        coatingSystem: 'Système témoin',
        woodSpecies: 'Pin sylvestre'
      }
    ] as const;
    const fams: MeasurementFamilyId[] = ['COLOR', 'GLOSS', 'PERSOZ', 'ADHESION', 'OBSERVATIONS'];

    const explicit = store.createTrial({
      metadata: meta,
      batches: baseBatches as unknown as { reference: string; coatingSystem?: string; woodSpecies?: string }[],
      activeFamilies: fams,
      startDate: '2025-03-10'
    });
    const t0Explicit = explicit.stages.find((s) => s.cycleIndex === 0)!;
    const c12Explicit = explicit.stages.find((s) => s.cycleIndex === 12)!;
    const explicitOk =
      !!explicit.startDate &&
      explicit.startDate === t0Explicit.scheduledAt &&
      new Date(explicit.startDate).getTime() === new Date('2025-03-10T08:00:00').getTime() &&
      new Date(c12Explicit.scheduledAt!).getTime() === new Date(explicit.startDate).getTime() + 2016 * HOURS_MS;

    const store2 = TrialStoreService.createIsolatedStore();
    const auto = store2.createTrial({
      metadata: meta,
      batches: baseBatches as unknown as { reference: string; coatingSystem?: string; woodSpecies?: string }[],
      activeFamilies: fams
    });
    const autoOk =
      !!auto.startDate &&
      !isNaN(new Date(auto.startDate).getTime()) &&
      auto.stages[0].scheduledAt === auto.startDate &&
      auto.stages.find((s) => s.cycleIndex === 12)!.scheduledExposureHours === 2016;

    const passed = explicitOk && autoOk;
    record('G52-DATE-06', 'createTrial : startDate explicite persistée (normalisée 08:00) + défaut dynamique, jalons alignés',
      passed, 'startDate = scheduledAt T0, C12 = +2016 h, défaut valide',
      `explicit=${String(explicit.startDate)}, auto=${String(auto.startDate)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}