/**
 * QUV-Lab — Badge quadrillage ISO 2409 (Tab02LotsPanels) — correction d'affichage > 250 µm.
 * Règle d'affichage : ≤ 250 µm → « Peigne X mm » (X issu de getApplicableGridSpacing) ;
 * > 250 µm → « ⚠️ Quadrillage non-applicable ». Épaisseur absente → aucun espacement inventé.
 */

import { getISO2409GridBadge } from '../../components/trial-tabs/Tab02LotsPanels';
import { getApplicableGridSpacing } from '../../scientific/adhesionEngine';

export interface AdhesionGridBadgeResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runAdhesionGridBadgeTests(): {
  results: AdhesionGridBadgeResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AdhesionGridBadgeResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // GRID-BADGE-01 : 195 µm → « Peigne 3 mm », message d'avertissement absent.
  {
    const badge = getISO2409GridBadge(195);
    const noWarning = !badge?.includes('Quadrillage non-applicable');
    const passed = badge === 'Peigne 3 mm' && noWarning === true;
    record(
      'GRID-BADGE-01',
      '195 µm → « Peigne 3 mm », absence de « Quadrillage non-applicable »',
      passed,
      'Peigne 3 mm',
      badge === null ? 'null' : badge
    );
  }

  // GRID-BADGE-02 : 250 µm → « Peigne 3 mm », message d'avertissement absent.
  {
    const badge = getISO2409GridBadge(250);
    const noWarning = !badge?.includes('Quadrillage non-applicable');
    const passed = badge === 'Peigne 3 mm' && noWarning === true;
    record(
      'GRID-BADGE-02',
      '250 µm → « Peigne 3 mm », absence de « Quadrillage non-applicable »',
      passed,
      'Peigne 3 mm',
      badge === null ? 'null' : badge
    );
  }

  // GRID-BADGE-03 : 250,1 µm → « ⚠️ Quadrillage non-applicable ».
  {
    const badge = getISO2409GridBadge(250.1);
    const passed = badge === '⚠️ Quadrillage non-applicable';
    record(
      'GRID-BADGE-03',
      '250,1 µm → « ⚠️ Quadrillage non-applicable »',
      passed,
      '⚠️ Quadrillage non-applicable',
      badge === null ? 'null' : badge
    );
  }

  // GRID-BADGE-04 : 251 µm → « ⚠️ Quadrillage non-applicable ».
  {
    const badge = getISO2409GridBadge(251);
    const passed = badge === '⚠️ Quadrillage non-applicable';
    record(
      'GRID-BADGE-04',
      '251 µm → « ⚠️ Quadrillage non-applicable »',
      passed,
      '⚠️ Quadrillage non-applicable',
      badge === null ? 'null' : badge
    );
  }

  // GRID-BADGE-05 : 300 µm → « ⚠️ Quadrillage non-applicable ».
  {
    const badge = getISO2409GridBadge(300);
    const passed = badge === '⚠️ Quadrillage non-applicable';
    record(
      'GRID-BADGE-05',
      '300 µm → « ⚠️ Quadrillage non-applicable »',
      passed,
      '⚠️ Quadrillage non-applicable',
      badge === null ? 'null' : badge
    );
  }

  // GRID-BADGE-06 : non-régression — l'espacement ≤ 250 µm reste issu de la logique métier,
  // aucune épaisseur absente ne produit d'espacement inventé.
  {
    const check60 = getISO2409GridBadge(60) === `Peigne ${getApplicableGridSpacing(60).gridSpacingMm} mm`;
    const check61 = getISO2409GridBadge(61) === `Peigne ${getApplicableGridSpacing(61).gridSpacingMm} mm`;
    const check121 = getISO2409GridBadge(121) === `Peigne ${getApplicableGridSpacing(121).gridSpacingMm} mm`;
    const check199 = getISO2409GridBadge(199) === `Peigne ${getApplicableGridSpacing(199).gridSpacingMm} mm`;
    const missing = getISO2409GridBadge(undefined) === null && getISO2409GridBadge(null) === null;
    const passed = check60 && check61 && check121 && check199 && missing;
    record(
      'GRID-BADGE-06',
      'Non-régression : espacement ≤ 250 µm aligné sur getApplicableGridSpacing (60/61/121/199 µm) ; épaisseur absente → null, aucun « 0 » ni espacement inventé',
      passed,
      '60→Peigne 2 mm, 61→Peigne 2 mm, 121→Peigne 3 mm, 199→Peigne 3 mm, undefined/null→null',
      `60=${getISO2409GridBadge(60)}, 61=${getISO2409GridBadge(61)}, 121=${getISO2409GridBadge(121)}, undefined=${String(getISO2409GridBadge(undefined))}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}