/**
 * Préparation INFIPERF / FCBA — couche PREPARATION (mapping strict, aucun calcul).
 *
 * Extrait les rétentions de brillance (retentionRatePercent) des éprouvettes
 * exposées E1/E2/E3 d'un jalon donné. Le témoin T est exclu. Aucune moyenne,
 * aucun arrondi ici : tout traitement numérique appartient à
 * infiperfCalculations.ts.
 */

import type { Trial } from '../../../types/trial';
import { getActiveE1E2E3Panels } from '../../panelUtils';

export interface InfiperfSpecimenRetention {
  panelId: string;
  panelLabel: string;
  /** Rétention de brillance (%) de l'éprouvette, telle que produite par COMPUTED. */
  retentionRatePercent: number | null;
}

export interface InfiperfPreparedRetentionData {
  stageId: string | null;
  specimens: InfiperfSpecimenRetention[];
  /** Éprouvettes exposées REQUISES mais sans mesure exploitable. */
  missingSpecimens: { panelId: string; panelLabel: string }[];
  available: boolean;
}

/** Tatouage d'une acquisition de brillance : `${stage}__${panel}__GLOSS`. */
export function glossAcquisitionKey(stageId: string, panelId: string): string {
  return `${stageId}__${panelId}__GLOSS`;
}

function readRetention(trial: Trial, stageId: string, panelId: string): number | null {
  const acquisition = trial.acquisitions[glossAcquisitionKey(stageId, panelId)];
  const computed = acquisition?.computed as { retentionRatePercent?: unknown } | undefined;
  const retention = computed?.retentionRatePercent;
  return typeof retention === 'number' && Number.isFinite(retention) ? retention : null;
}

/**
 * Prépare les rétentions de brillance d'un jalon pour les éprouvettes E1/E2/E3.
 * Mapping pur : aucune agrégation n'est réalisée ici.
 */
export function prepareInfiperfRetentionData(trial: Trial, stageId: string): InfiperfPreparedRetentionData {
  const specimens: InfiperfSpecimenRetention[] = [];
  const missingSpecimens: InfiperfPreparedRetentionData['missingSpecimens'] = [];

  for (const panel of getActiveE1E2E3Panels(trial.batches.flatMap((b) => b.panels))) {
    const retention = readRetention(trial, stageId, panel.id);
    if (retention !== null) {
      specimens.push({ panelId: panel.id, panelLabel: panel.label, retentionRatePercent: retention });
    } else {
      missingSpecimens.push({ panelId: panel.id, panelLabel: panel.label });
    }
  }

  return {
    stageId,
    specimens,
    missingSpecimens,
    available: specimens.length > 0
  };
}