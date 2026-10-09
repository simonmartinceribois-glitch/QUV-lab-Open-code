/**
 * QUV-Lab — Traçabilité des exports dans le journal d'audit (R-EXPORT-AUDIT).
 *
 * Avant ce correctif, l'export du dossier scientifique JSON était journalisé
 * comme un export `COMPUTED_DATA_CSV` : le journal d'audit ne permettait pas
 * de savoir qu'un JSON (et non un CSV) avait quitté l'application.
 */
import { TrialStoreService } from '../../services/trialStoreService';

export interface ExportAuditTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export function runExportAuditTraceTests(): {
  results: ExportAuditTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ExportAuditTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  const lastEntry = (store: TrialStoreService, trialId: string) => {
    const trail = store.getTrial(trialId)?.auditTrail ?? [];
    return trail[trail.length - 1];
  };

  // R-EXPORT-AUDIT-01 : export JSON → action et type dédiés.
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = store.resetToDemo();
    store.logReportExport(trial.id, trial.id, 'SCIENTIFIC_DOSSIER_JSON', 'OP');
    const entry = lastEntry(store, trial.id);
    const exportType = (entry?.details as { exportType?: string } | undefined)?.exportType;
    record(
      'R-EXPORT-AUDIT-01',
      'Export du dossier scientifique JSON → EXPORT_SCIENTIFIC_DOSSIER / SCIENTIFIC_DOSSIER_JSON',
      entry?.action === 'EXPORT_SCIENTIFIC_DOSSIER' && exportType === 'SCIENTIFIC_DOSSIER_JSON' && entry.operatorId === 'OP',
      'EXPORT_SCIENTIFIC_DOSSIER, SCIENTIFIC_DOSSIER_JSON, OP',
      `${entry?.action}, ${exportType}, ${entry?.operatorId}`
    );
  }

  // R-EXPORT-AUDIT-02 : les types d'export existants gardent leur action.
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = store.resetToDemo();
    const expected: Array<[Parameters<TrialStoreService['logReportExport']>[2], string]> = [
      ['REPORT_PDF', 'EXPORT_REPORT'],
      ['REPORT_CSV', 'EXPORT_REPORT'],
      ['RAW_DATA_CSV', 'EXPORT_RAW_DATA'],
      ['COMPUTED_DATA_CSV', 'EXPORT_COMPUTED_DATA']
    ];
    const actual = expected.map(([type]) => {
      store.logReportExport(trial.id, trial.id, type, 'OP');
      return lastEntry(store, trial.id)?.action;
    });
    const ok = expected.every(([, action], i) => actual[i] === action);
    record(
      'R-EXPORT-AUDIT-02',
      'Types d’export existants inchangés (PDF, REPORT CSV, RAW CSV, COMPUTED CSV)',
      ok,
      expected.map(([, a]) => a).join(', '),
      actual.join(', ')
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
