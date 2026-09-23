/**
 * QUV-Lab — Détecteur Factuel d'Anomalies (PROMPT 8 - Section 12, 13, 27, 28)
 * Recherche exclusivement les anomalies factuelles dans les données RAW, COMPUTED et le protocole
 * sans recalculer de données et sans porter de jugement subjectif.
 */

import { Trial, ExposureStage, BatchDefinition } from '../../types/trial';
import { ScientificRuleSet, MeasurementFamilyId } from '../../types/scientific';
import { AnalysisAnomaly } from '../../types/analysis';
import { getActiveFamiliesForStage } from '../panelUtils';
import { parseObservationRating } from '../observationsEngine';
import { evaluateCountProtocolCompliance, evaluateSeriesProtocolCompliance } from '../protocolEngine';

export function detectTrialAnomalies(
  trial: Trial,
  ruleSet: ScientificRuleSet,
  scope?: {
    stageId?: string;
    batchIds?: string[];
    families?: MeasurementFamilyId[];
  }
): AnalysisAnomaly[] {
  const anomalies: AnalysisAnomaly[] = [];
  let anomalyCounter = 1;

  const addAnomaly = (
    severity: AnalysisAnomaly['severity'],
    category: AnalysisAnomaly['category'],
    code: string,
    title: string,
    factualDescription: string,
    blocking: boolean,
    details?: {
      sourceReference?: string;
      affectedLotId?: string;
      affectedPanelId?: string;
      affectedStageId?: string;
    }
  ) => {
    anomalies.push({
      id: `ANOM-${trial.metadata.reference}-${category}-${anomalyCounter++}`,
      severity,
      category,
      code,
      title,
      factualDescription,
      blocking,
      affectedTrialId: trial.id,
      ...details
    });
  };

  const selectedStages = scope?.stageId
    ? trial.stages.filter((s) => s.id === scope.stageId)
    : trial.stages;

  const selectedBatches = scope?.batchIds && scope.batchIds.length > 0
    ? trial.batches.filter((b) => scope.batchIds!.includes(b.id))
    : trial.batches;

  const activeFamilies: MeasurementFamilyId[] = scope?.families && scope.families.length > 0
    ? scope.families
    : trial.config.activeFamilies;

  // --------------------------------------------------------------------------
  // A. ANOMALIES TEMPORELLES & STRUCTURALES
  // --------------------------------------------------------------------------
  const stageT0 = trial.stages.find((s) => s.cycleIndex === 0);
  if (!stageT0) {
    addAnomaly(
      'CRITICAL',
      'TEMPORAL',
      'INITIAL_STAGE_MISSING',
      'Étape initiale T0 absente',
      'L\'essai ne dispose pas de l\'étape T0 (mesures initiales avant exposition), rendant impossible tout calcul de variation temporelle.',
      true
    );
  }

  const stage2016 = trial.stages.find((s) => s.cycleIndex === 12);
  if (!stage2016) {
    addAnomaly(
      'WARNING',
      'TEMPORAL',
      'FINAL_STAGE_MISSING',
      'Étape finale 2016 h absente du calendrier',
      'Le calendrier ne comporte pas d\'étape finale à 2016 h selon le cycle standard NF EN 927-6.',
      false
    );
  }

  // --------------------------------------------------------------------------
  // B. ANOMALIES DE PROTOCOLE & ADAPTATIONS
  // --------------------------------------------------------------------------
  for (const familyId of activeFamilies) {
    const famConfig = trial.config.familyConfigs[familyId];
    if (!famConfig || !famConfig.enabled) continue;

    if (familyId !== 'GLOSS' && famConfig.countConfig) {
      // Source de vérité unique : le moteur de conformité protocolaire.
      // Aucune logique d'adaptation n'est réimplémentée ici afin de garantir une
      // stricte cohérence (STANDARD, ADAPTED_JUSTIFIED, ADAPTED_UNJUSTIFIED,
      // INCOMPLETE, INVALID) avec evaluateCountProtocolCompliance().
      const result = evaluateCountProtocolCompliance(famConfig.countConfig, ruleSet);
      const label = familyId === 'COLOR' ? 'colorimétrique' : familyId === 'PERSOZ' ? 'Persoz' : familyId === 'ADHESION' ? "d'adhérence" : familyId;
      const sourceReference = ruleSet.measurementConfigurations[familyId]?.standardReference || ruleSet.standardReference;

      switch (result.status) {
        case 'INCOMPLETE':
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            'MEASUREMENT_REFERENCE_MISSING',
            `Référentiel de mesure manquant pour ${familyId}`,
            `Aucune configuration standard n'est disponible pour la famille ${familyId} ; l'évaluation de l'adaptation ne peut pas être référencée.`,
            true,
            { sourceReference }
          );
          break;
        case 'INVALID':
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            'MEASUREMENT_INVALID',
            `Configuration de mesures ${label} invalide`,
            `La configuration du plan de mesure de ${label} est invalide (${famConfig.countConfig.configuredCount} relevé(s)).`,
            true,
            { sourceReference }
          );
          break;
        case 'ADAPTED_JUSTIFIED':
          addAnomaly(
            'INFO',
            'PROTOCOL',
            `${familyId}_ADAPTATION_JUSTIFIED`,
            `Plan de mesure ${label} adapté et justifié`,
            result.deviationMessage || `Le plan de mesure de ${label} a été adapté à ${famConfig.countConfig.configuredCount} relevé(s).`,
            false,
            { sourceReference }
          );
          break;
        case 'ADAPTED_UNJUSTIFIED':
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            `${familyId}_ADAPTATION_UNJUSTIFIED`,
            `Adaptation du plan ${label} non justifiée`,
            `${result.deviationMessage || `Le plan de mesure de ${label} est configuré à ${famConfig.countConfig.configuredCount} relevé(s).`} Une justification obligatoire (8 caractères minimum) doit être enregistrée.`,
            true,
            { sourceReference }
          );
          break;
      }
    }
    if (familyId === 'GLOSS' && famConfig.seriesConfig) {
      // Source de vérité unique : evaluateSeriesProtocolCompliance().
      const result = evaluateSeriesProtocolCompliance(famConfig.seriesConfig, ruleSet);
      const cfg = famConfig.seriesConfig.configuredConfiguration;

      switch (result.status) {
        case 'INCOMPLETE':
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            'GLOSS_SERIES_REFERENCE_MISSING',
            'Référentiel de brillance manquant',
            `Aucune configuration standard de brillance n'est disponible ; l'évaluation de l'adaptation ne peut pas être référencée.`,
            true,
            { sourceReference: 'NF EN 927-6 §6.3.3' }
          );
          break;
        case 'ADAPTED_JUSTIFIED':
          addAnomaly(
            'INFO',
            'PROTOCOL',
            'GLOSS_SERIES_ADAPTATION_JUSTIFIED',
            'Grille de brillance adaptée et justifiée',
            `La configuration brillance a été adaptée (${cfg.seriesCount} séries × ${cfg.readingsPerSeries} points). Motif : "${famConfig.seriesConfig.justification}".`,
            false,
            { sourceReference: 'NF EN 927-6 §6.3.3' }
          );
          break;
        case 'ADAPTED_UNJUSTIFIED':
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED',
            'Adaptation de la grille de brillance non justifiée',
            `La configuration brillance (${cfg.seriesCount} séries × ${cfg.readingsPerSeries} points) diffère de la norme sans justification technique enregistrée (8 caractères minimum).`,
            true,
            { sourceReference: 'NF EN 927-6 §6.3.3' }
          );
          break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // C. ANOMALIES DE COMPLÉTUDE & MÉTROLOGIE PAR PANNEAU ET ÉTAPE
  // --------------------------------------------------------------------------
  for (const stage of selectedStages) {
    if (stage.status === 'INACTIVE') continue;
    const stageApplicableFamilies = getActiveFamiliesForStage(activeFamilies, stage);

    for (const batch of selectedBatches) {
      const activePanels = batch.panels.filter((p) => p.status === 'ACTIVE');

      for (const panel of activePanels) {
        for (const familyId of stageApplicableFamilies) {
          const acqKey = `${stage.id}__${panel.id}__${familyId}`;
          const acq = trial.acquisitions[acqKey];

          if (!acq) {
            // Uniquement si l'étape est entamée ou validée
            if (stage.status === 'IN_PROGRESS' || stage.status === 'VALIDATED') {
              addAnomaly(
                'WARNING',
                'DATA',
                'ACQUISITION_MISSING',
                `Acquisition manquante : ${familyId}`,
                `Aucune acquisition enregistrée pour le panneau ${panel.label} (${batch.reference}) à l'étape ${stage.name} pour la grandeur ${familyId}.`,
                false,
                {
                  affectedLotId: batch.id,
                  affectedPanelId: panel.id,
                  affectedStageId: stage.id
                }
              );
            }
            continue;
          }

          // Anomalies de statut d'acquisition
          if (acq.status === 'ERROR') {
            addAnomaly(
              'CRITICAL',
              'METROLOGY',
              'ACQUISITION_ERROR',
              `Données invalides : ${familyId} sur ${panel.label}`,
              `L'acquisition ${familyId} du panneau ${panel.label} à l'étape ${stage.name} comporte des erreurs bloquantes ou des valeurs invalides.`,
              true,
              {
                affectedLotId: batch.id,
                affectedPanelId: panel.id,
                affectedStageId: stage.id
              }
            );
          } else if (acq.status === 'PARTIAL') {
            addAnomaly(
              'WARNING',
              'DATA',
              'ACQUISITION_PARTIAL',
              `Série de mesures incomplète : ${familyId}`,
              `L'acquisition ${familyId} sur ${panel.label} (${stage.name}) ne comporte pas le nombre attendu de points de mesure.`,
              false,
              {
                affectedLotId: batch.id,
                affectedPanelId: panel.id,
                affectedStageId: stage.id
              }
            );
          }

          // Relayer les alertes du moteur scientifique
          if (acq.alerts && acq.alerts.length > 0) {
            for (const alert of acq.alerts) {
              addAnomaly(
                alert.severity === 'BLOCKING' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'WARNING' : 'INFO',
                'METROLOGY',
                typeof alert.code === 'string' ? alert.code : 'MEASUREMENT_ALERT',
                `Alerte métrologique : ${familyId} (${panel.label})`,
                alert.message,
                alert.severity === 'BLOCKING',
                {
                  affectedLotId: batch.id,
                  affectedPanelId: panel.id,
                  affectedStageId: stage.id
                }
              );
            }
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // D. CONTRADICTIONS ENTRE DONNÉES ET OBSERVATIONS (Section 28)
  // --------------------------------------------------------------------------
  for (const stage of selectedStages) {
    for (const batch of selectedBatches) {
      for (const panel of batch.panels) {
        const obsKey = `${stage.id}__${panel.id}__OBSERVATIONS`;
        const obsAcq = trial.acquisitions[obsKey];
        if (obsAcq && obsAcq.raw) {
          const rawObs = obsAcq.raw as { observations?: Array<{ category: string; rating: string | number | null | undefined; comment?: string }> };
          if (rawObs.observations) {
            for (const item of rawObs.observations) {
              // Validation par la source de vérité commune parseObservationRating :
              // seules les cotations réellement VALID et égales à 0 déclenchent le
              // contrôle de cohérence. Une cotation MISSING ou INVALID n'est jamais
              // transformée en 0 (pas de contradiction fabriquée par absence).
              const { validity, value } = parseObservationRating(item.rating);
              if (validity === 'VALID' && value === 0 && item.comment && /(important|sévère|marqué|fort|décollement)/i.test(item.comment)) {
                addAnomaly(
                  'CRITICAL',
                  'DATA',
                  'ANALYSIS_TEXT_CONTRADICTION',
                  `Contradiction observation / cotation (${panel.label})`,
                  `La cotation de ${item.category} est fixée à 0 (aucun défaut) alors que le commentaire textuel mentionne "${item.comment}".`,
                  true,
                  {
                    affectedLotId: batch.id,
                    affectedPanelId: panel.id,
                    affectedStageId: stage.id
                  }
                );
              }
            }
          }
        }
      }
    }
  }

  return anomalies;
}
