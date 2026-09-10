/**
 * QUV-Lab — Calendrier d'exposition standard NF EN 927-6 (T0 + 12x168h)
 * Issu du decoupage de trialStore.ts (refactor/split-trialstore). Code deplace a l'identique.
 * Le générateur produit UNIQUEMENT le calendrier/protocole : aucune acquisition fictive.
 * Les métadonnées d'acquisition (measuredAt, validatedBy, validatedAt, notes) restent
 * undefined tant qu'une opération métier réelle ne les renseigne (G52-CAL / étape 06).
 */
import { ExposureStage } from '../types/trial';
import { UUID } from '../types/scientific';

/**
 * Génère les 13 étapes d'exposition standard NF EN 927-6 (T0 + 12 cycles de 168h)
 * Si un plan de mesurage restreint est fourni, les cycles non mesurés restent présents
 * dans le modèle physique en tant que cycles d'exposition, avec le statut 'INACTIVE' (masqués de la paillasse).
 * T0 et C12 sont obligatoires et ne peuvent jamais être inactifs.
 *
 * À la création d'un essai réel, chaque jalon planifié démarre en 'NOT_STARTED' sans
 * aucune donnée d'acquisition fabriquée (status n'est jamais 'VALIDATED'/'IN_PROGRESS'
 * et measuredAt/validatedBy/validatedAt/notes restent undefined). Les données de
 * démonstration ne vivent que dans trialSeed.ts, jamais ici.
 */
export function generateStandardExposureStages(trialId: UUID, selectedMeasurementCycles?: number[]): ExposureStage[] {
  const stages: ExposureStage[] = [];
  const baseDate = new Date('2026-08-30T08:00:00Z');

  // Étape initiale T0 (0 h) — MESURES INITIALES AVANT EXPOSITION (Obligatoire)
  stages.push({
    id: `stage-${trialId}-0`,
    trialId,
    cycleIndex: 0,
    stageType: 'INITIAL_PRE_EXPOSURE',
    name: 'T0 — MESURES INITIALES AVANT EXPOSITION',
    scheduledExposureHours: 0,
    scheduledAt: baseDate.toISOString(),
    status: 'NOT_STARTED'
  });

  // 12 Cycles de 168h (168h à 2016h)
  for (let i = 1; i <= 12; i++) {
    const cycleHours = i * 168;
    const scheduledDate = new Date(baseDate.getTime() + i * 7 * 24 * 3600 * 1000);
    const isFinal = i === 12;

    // Détermination de l'inclusion dans le plan de mesurage
    // Par défaut (si non spécifié), tous les cycles sont mesurés.
    // T0 (0) et C12 (12) sont toujours inclus.
    const isPlannedForMeasurement = selectedMeasurementCycles ? (isFinal || selectedMeasurementCycles.includes(i)) : true;

    stages.push({
      id: `stage-${trialId}-${i}`,
      trialId,
      cycleIndex: i,
      stageType: isFinal ? 'FINAL_POST_EXPOSURE' : 'INTERMEDIATE_DURING_EXPOSURE',
      name: isFinal
        ? '2016 h — MESURES FINALES APRÈS EXPOSITION'
        : `${cycleHours} h — MESURES EN COURS D'EXPOSITION`,
      scheduledExposureHours: cycleHours,
      scheduledAt: scheduledDate.toISOString(),
      status: !isPlannedForMeasurement ? 'INACTIVE' : 'NOT_STARTED'
    });
  }

  return stages;
}
