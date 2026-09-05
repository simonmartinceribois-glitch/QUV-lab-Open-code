/**
 * QUV-Lab — Évaluation de la Qualité Multi-Niveaux & Séparation des 5 Notions
 * Règle d'or : Ne jamais confondre Qualité des données, Conformité Protocolaire et Conclusion Normative.
 */

import {
  Trial,
  PanelAcquisitionRecord
} from '../types/trial';
import {
  QualityStatus,
  ProtocolComplianceStatus,
  NormativeComplianceEvaluation,
  StageQualityAssessment,
  TrialQualityAssessment,
  ScientificRuleSet,
  UUID
} from '../types/scientific';
import { getActiveFamiliesForStage, isAdhesionEligiblePanel } from './panelUtils';

export const QUALITY_ASSESSMENT_VERSION = '1.2.0';

/**
 * Évalue la qualité globale au niveau d'une étape d'exposition
 */
export function assessStageQuality(
  stageId: UUID,
  trial: Trial,
  ruleSet: ScientificRuleSet
): StageQualityAssessment {
  const stage = trial.stages.find((s) => s.id === stageId);

  // Gate 54 (D-3) : Un stage exclu du plan de mesurage (INACTIVE) ne doit jamais
  // être évalué comme incomplet, ACCEPTABLE, ou INVALID.
  if (!stage || stage.status === 'INACTIVE') {
    return {
      stageId,
      panelsEvaluated: 0,
      panelsComplete: 0,
      panelsWithWarnings: 0,
      panelsInvalid: 0,
      familyAssessments: {} as Record<string, QualityStatus>,
      globalStatus: 'GOOD',
      calculationVersion: QUALITY_ASSESSMENT_VERSION
    };
  }

  const scheduledFamilies = stage
    ? getActiveFamiliesForStage(trial.config.activeFamilies, stage)
    : trial.config.activeFamilies;

  const stageAcquisitions = Object.values(trial.acquisitions).filter((a) => a.stageId === stageId);
  const activePanels = trial.batches.flatMap((b) => b.panels.filter((p) => p.status === 'ACTIVE'));

  let panelsComplete = 0;
  let panelsWithWarnings = 0;
  let panelsInvalid = 0;

  const familyAssessments: Record<string, QualityStatus> = {};

  for (const familyId of scheduledFamilies) {
    const familyAcqs = stageAcquisitions.filter((a) => a.familyId === familyId);
    let famHasInvalid = false;
    let famHasWarning = false;

    for (const acq of familyAcqs) {
      if (acq.alerts?.some((alert) => alert.severity === 'BLOCKING')) {
        famHasInvalid = true;
      } else if (acq.alerts?.some((alert) => alert.severity === 'WARNING')) {
        famHasWarning = true;
      }
    }

    // Complétude ADHÉSION (matrice T0/T, C12/E1-E3) : seuls les panneaux
    // éligibles au jalon comptent — ni les absences normales (E à T0, T à C12),
    // ni les acquisitions interdites historiques ne satisfont la couverture.
    // Autres familles : comportement inchangé (tous les panneaux actifs).
    let expectedCount = activePanels.length;
    let coveredCount = familyAcqs.length;
    if (familyId === 'ADHESION' && stage) {
      const eligibleIds = new Set(
        activePanels.filter((p) => isAdhesionEligiblePanel(p, stage)).map((p) => p.id)
      );
      expectedCount = eligibleIds.size;
      coveredCount = familyAcqs.filter((a) => eligibleIds.has(a.panelId)).length;
    }

    if (famHasInvalid) {
      familyAssessments[familyId] = 'INVALID';
    } else if (famHasWarning) {
      familyAssessments[familyId] = 'WARNING';
    } else if (expectedCount > 0 && coveredCount >= expectedCount) {
      familyAssessments[familyId] = 'GOOD';
    } else if (expectedCount === 0) {
      familyAssessments[familyId] = 'GOOD';
    } else {
      familyAssessments[familyId] = 'ACCEPTABLE';
    }
  }

  let panelsEvaluated = 0;
  for (const panel of activePanels) {
    // Attentes applicables au panneau : ADHÉSION uniquement si le panneau est
    // éligible au jalon (T0/T, C12/E1-E3). Un panneau sans attente applicable
    // (ex. E à T0 en campagne ADHÉSION seule) est hors compteur — ni complet,
    // ni en anomalie. Autres familles : comportement inchangé.
    const expectedFamilies = scheduledFamilies.filter(
      (fam) => fam !== 'ADHESION' || (stage && isAdhesionEligiblePanel(panel, stage))
    );
    if (expectedFamilies.length === 0) continue;
    panelsEvaluated++;
    const panelAcqs = stageAcquisitions.filter((a) => a.panelId === panel.id && scheduledFamilies.includes(a.familyId));
    const eligibleAcqs = panelAcqs.filter(
      (a) => a.familyId !== 'ADHESION' || (stage && isAdhesionEligiblePanel(panel, stage))
    );
    const hasBlocking = panelAcqs.some((a) => a.alerts?.some((al) => al.severity === 'BLOCKING'));
    const hasWarning = panelAcqs.some((a) => a.alerts?.some((al) => al.severity === 'WARNING'));
    const isComplete = eligibleAcqs.length === expectedFamilies.length;

    if (hasBlocking) {
      panelsInvalid++;
    } else if (hasWarning || !isComplete) {
      panelsWithWarnings++;
    } else {
      panelsComplete++;
    }
  }

  let globalStatus: QualityStatus = 'GOOD';
  if (panelsInvalid > 0) {
    globalStatus = 'INVALID';
  } else if (panelsWithWarnings > 0) {
    globalStatus = 'WARNING';
  } else if (panelsComplete === panelsEvaluated) {
    globalStatus = 'GOOD';
  } else {
    globalStatus = 'ACCEPTABLE';
  }

  return {
    stageId,
    panelsEvaluated,
    panelsComplete,
    panelsWithWarnings,
    panelsInvalid,
    familyAssessments,
    globalStatus,
    calculationVersion: QUALITY_ASSESSMENT_VERSION
  };
}

/**
 * Évalue la qualité et conformité globale au niveau de l'Essai (Trial)
 * STRICTEMENT : NormativeConclusion reste 'NON_EVALUEE' tant que le module de conformité finale n'est pas invoqué.
 */
export function assessTrialQuality(
  trial: Trial,
  ruleSet: ScientificRuleSet
): TrialQualityAssessment {
  let blockingAlertsCount = 0;
  let warningAlertsCount = 0;

  // 1. Décompte des alertes sur toutes les acquisitions
  Object.values(trial.acquisitions).forEach((acq) => {
    acq.alerts.forEach((alert) => {
      if (alert.severity === 'BLOCKING') blockingAlertsCount++;
      if (alert.severity === 'WARNING') warningAlertsCount++;
    });
  });

  // 2. Évaluation de la conformité du protocole global
  let protocolCompliance: ProtocolComplianceStatus = 'STANDARD';

  for (const familyId of trial.config.activeFamilies) {
    const famConfig = trial.config.familyConfigs[familyId];
    if (famConfig?.countConfig) {
      if (famConfig.countConfig.mode === 'CUSTOM_JUSTIFIED') {
        if (!famConfig.countConfig.justification?.trim()) {
          protocolCompliance = 'ADAPTED_UNJUSTIFIED';
          break;
        } else {
          protocolCompliance = 'ADAPTED_JUSTIFIED';
        }
      }
    }
    if (famConfig?.seriesConfig) {
      if (famConfig.seriesConfig.mode === 'CUSTOM_JUSTIFIED') {
        if (!famConfig.seriesConfig.justification?.trim()) {
          protocolCompliance = 'ADAPTED_UNJUSTIFIED';
          break;
        } else {
          protocolCompliance = 'ADAPTED_JUSTIFIED';
        }
      }
    }
  }

  // 3. Statut de Qualité des Données
  let globalQuality: QualityStatus = 'GOOD';
  if (blockingAlertsCount > 0) {
    globalQuality = 'INVALID';
  } else if (warningAlertsCount > 0) {
    globalQuality = 'WARNING';
  }

  // 4. Conclusion Normative formelle
  const normativeConclusion: NormativeComplianceEvaluation = 'NON_EVALUEE';

  return {
    trialId: trial.id,
    stagesEvaluated: trial.stages.length,
    protocolCompliance,
    globalQuality,
    blockingAlertsCount,
    warningAlertsCount,
    normativeConclusion,
    calculatedAt: new Date().toISOString(),
    calculationVersion: QUALITY_ASSESSMENT_VERSION
  };
}
