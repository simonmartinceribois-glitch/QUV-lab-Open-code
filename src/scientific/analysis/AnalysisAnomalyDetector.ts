
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

    if (famConfig.countConfig && familyId !== 'GLOSS') {
      const standardCount = ruleSet.measurementConfigurations[familyId]?.standardRecommendedCount
        ?? famConfig.countConfig.standardRecommendedCount;
      if (standardCount === undefined) {
        addAnomaly(
          'CRITICAL',
          'PROTOCOL',
          'MEASUREMENT_REFERENCE_MISSING',
          `Référentiel de mesure manquant pour ${familyId}`,
          `Aucune configuration standard n'est disponible pour la famille ${familyId} ; l'évaluation de l'adaptation ne peut pas être référencée.`,
          true
        );
      } else {
        const configuredCount = famConfig.countConfig.configuredCount;
        if (configuredCount !== standardCount) {
          const label = familyId === 'COLOR' ? 'colorimétrique' : familyId === 'PERSOZ' ? 'Persoz' : familyId === 'ADHESION' ? "d'adhérence" : familyId;
          const sourceReference = famConfig.countConfig.standardReference || ruleSet.standardReference;
          if (famConfig.countConfig.deviationFromStandard && !famConfig.countConfig.justification) {
            addAnomaly(
              'CRITICAL',
              'PROTOCOL',
              `${familyId}_ADAPTATION_UNJUSTIFIED`,
              `Adaptation du plan ${label} non justifiée`,
              `Le plan de mesure de ${label} est configuré à ${configuredCount} relevé(s) au lieu de ${standardCount} de référence sans justification technique enregistrée.`,
              true,
              { sourceReference }
            );
          } else {
            addAnomaly(
              'INFO',
              'PROTOCOL',
              `${familyId}_ADAPTATION_JUSTIFIED`,
              `Plan de mesure ${label} adapté et justifié`,
              `Le plan de mesure de ${label} a été adapté à ${configuredCount} relevé(s) au lieu de ${standardCount} de référence. Motif enregistré : "${famConfig.countConfig.justification}".`,
              false,
              { sourceReference }
            );
          }
        }
      }
    }
    if (familyId === 'GLOSS' && famConfig.seriesConfig) {
      const std = ruleSet.seriesConfigurations?.GLOSS?.standardConfiguration;
      const cfg = famConfig.seriesConfig.configuredConfiguration;
      if (std && (cfg.seriesCount !== std.seriesCount || cfg.readingsPerSeries !== std.readingsPerSeries)) {
        if (famConfig.seriesConfig.deviationFromStandard && !famConfig.seriesConfig.justification) {
          addAnomaly(
            'CRITICAL',
            'PROTOCOL',
            'GLOSS_SERIES_ADAPTATION_UNJUSTIFIED',
            'Adaptation de la grille de brillance non justifiée',
            `La configuration brillance (${cfg.seriesCount} séries × ${cfg.readingsPerSeries} points) diffère de la norme (${std.seriesCount} × ${std.readingsPerSeries}) sans justification enregistrée.`,
            true,
            { sourceReference: 'NF EN 927-6 §6.3.3' }
          );
        } else {
          addAnomaly(
            'INFO',
            'PROTOCOL',
            'GLOSS_SERIES_ADAPTATION_JUSTIFIED',
            'Grille de brillance adaptée et justifiée',
            `La configuration brillance a été adaptée (${cfg.seriesCount} séries × ${cfg.readingsPerSeries} points). Motif : "${famConfig.seriesConfig.justification}".`,
            false,
            { sourceReference: 'NF EN 927-6 §6.3.3' }
          );
        }
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