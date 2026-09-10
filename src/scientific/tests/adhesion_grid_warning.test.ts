/**
 * QUV-Lab — Correction d'affichage ADHÉSION : quadrillage non-applicable > 250 µm
 *
 * Correction d'INTERFACE uniquement : au-delà de 250 µm (strictement), l'interface
 * affiche « ⚠️ Quadrillage non-applicable » (rouge / WARNING) au lieu de tout message
 * laissant croire à une non-conformité de l'épaisseur. La règle d'espacement scientifique
 * (getApplicableGridSpacing) n'est PAS modifiée ; la donnée RAW reste intouchée.
 *
 * Frontières testées : 195 / 250 / 250,1 / 251 / 300 µm + régression du moteur.
 */

import { getAdhesionGridDisplay } from '../../components/bench/BenchAdhesionForm';
import { getApplicableGridSpacing } from '../../scientific/adhesionEngine';

export interface AdhesionGridWarningResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runAdhesionGridWarningTests(): {
  results: AdhesionGridWarningResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionGridWarningResult[] = [];
  const record = (
    id: string,
    name: string,
    passed: boolean,
    expected: string,
    actual: string
  ) => {
    results.push({ id, name, passed, expected, actual });
  };

  // Test 1 — 250 µm : quadrillage applicable, espacement 3 mm, AUCUN message d'avertissement.
  {
    const d = getAdhesionGridDisplay(250);
    const e = getApplicableGridSpacing(250);
    const passed =
      d.isApplicable === true &&
      d.warningMessage === null &&
      d.gridSpacingMm === 3 &&
      e.gridSpacingMm === 3 &&
      e.thicknessCategory.includes('121 µm à 250 µm');

    record(
      'GRID-WARN-01',
      '250 µm → quadrillage applicable, espacement 3 mm, message « Quadrillage non-applicable » absent',
      passed,
      'isApplicable true, gridSpacingMm 3, warningMessage null',
      `isApplicable=${d.isApplicable}, mm=${d.gridSpacingMm}, warning=${String(d.warningMessage)}`
    );
  }

  // Test 2 — > 250 µm (strict) : message « ⚠️ Quadrillage non-applicable », moteur inchangé.
  {
    const d251 = getAdhesionGridDisplay(251);
    const d2501 = getAdhesionGridDisplay(250.1);
    const e251 = getApplicableGridSpacing(251);
    const passed =
      d251.isApplicable === false &&
      d251.warningMessage === '⚠️ Quadrillage non-applicable' &&
      d2501.isApplicable === false &&
      d2501.warningMessage === '⚠️ Quadrillage non-applicable' &&
      e251.gridSpacingMm === 3 &&
      e251.thicknessCategory.includes('> 250 µm');

    record(
      'GRID-WARN-02',
      '251 µm et 250,1 µm → « ⚠️ Quadrillage non-applicable » ; moteur d\'espacement inchangé (3 mm, catégorie > 250 µm)',
      passed,
      'isApplicable false, warningMessage « ⚠️ Quadrillage non-applicable », engine 3mm',
      `251:${String(d251.warningMessage)}, 250,1:${String(d2501.warningMessage)}, engine251=${e251.gridSpacingMm}mm`
    );
  }

  // Test 3 — valeur intermédiaire 195 µm : quadrillage applicable, même règle qu'actuellement (3 mm).
  {
    const d = getAdhesionGridDisplay(195);
    const e = getApplicableGridSpacing(195);
    const passed =
      d.isApplicable === true &&
      d.warningMessage === null &&
      d.gridSpacingMm === 3 &&
      e.gridSpacingMm === 3;

    record(
      'GRID-WARN-03',
      '195 µm → quadrillage applicable, espacement 3 mm (règle existante conservée)',
      passed,
      'isApplicable true, warningMessage null, gridSpacingMm 3',
      `isApplicable=${d.isApplicable}, mm=${d.gridSpacingMm}, engine195=${e.gridSpacingMm}mm`
    );
  }

  // Test 4 — régression : getApplicableGridSpacing n'est pas modifié (bornes normatives complètes).
  {
    const cases: Array<{ t?: number; wood?: boolean; mm: number; cat: string }> = [
      { t: 45, wood: true, mm: 2, cat: '≤ 60 µm (Support Bois / Tendre)' },
      { t: 45, wood: false, mm: 1, cat: '≤ 60 µm (Support Rigide)' },
      { t: 60, mm: 2, cat: '≤ 60 µm' },
      { t: 61, mm: 2, cat: '61 µm à 120 µm' },
      { t: 120, mm: 2, cat: '61 µm à 120 µm' },
      { t: 121, mm: 3, cat: '121 µm à 250 µm' },
      { t: 250, mm: 3, cat: '121 µm à 250 µm' },
      { t: 251, mm: 3, cat: '> 250 µm' },
      { t: 300, mm: 3, cat: '> 250 µm' },
      { t: undefined, mm: 2, cat: '≤ 60 µm' }
    ];
    const passed = cases.every((c) => {
      const r = getApplicableGridSpacing(c.t as number | undefined, c.wood ?? true);
      return r.gridSpacingMm === c.mm && r.thicknessCategory.includes(c.cat);
    });

    record(
      'GRID-WARN-04',
      'Régression : getApplicableGridSpacing inchangé (45/60/61/120/121/250/251/300 µm + défaut 60 µm)',
      passed,
      'toutes bornes : 2/2/2/2/3/3/3/3 mm et catégories d\'origine',
      passed ? '10/10 bornes conformes' : 'au moins une borne modifiée'
    );

    const gravity = getAdhesionGridDisplay(300);
    record(
      'GRID-WARN-05',
      '300 µm → « ⚠️ Quadrillage non-applicable » sans invalidation (display pur, RAW non touché)',
      gravity.isApplicable === false && gravity.warningMessage === '⚠️ Quadrillage non-applicable',
      'isApplicable false, warningMessage « ⚠️ Quadrillage non-applicable »',
      `300µm → ${String(gravity.warningMessage)}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}