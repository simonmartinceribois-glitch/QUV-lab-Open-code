/**
 * QUV-Lab — Moteur Scientifique Adhérence au Quadrillage (NF EN ISO 2409:2020)
 * Déterministe, pure, conserve RAW intact et génère COMPUTED + alertes métrologiques.
 */

import {
  AdhesionRawData,
  AdhesionComputedData,
  AdhesionClassRating,
  AdhesionIndividualResult,
  MeasurementAlert,
  QualityAssessment,
  ProtocolComplianceStatus,
  MeasurementCountConfiguration,
  ScientificRuleSet,
  UUID
} from '../types/scientific';

export const ADHESION_CALCULATION_VERSION = '1.2.0';
export const ADHESION_NORM_REFERENCE = 'NF EN ISO 2409:2020';

/**
 * Définition officielle des 6 classes d'adhérence selon la NF EN ISO 2409:2020
 */
export const ISO2409_CLASSES: Record<
  number,
  {
    rating: AdhesionClassRating;
    shortLabel: string;
    description: string;
    affectedAreaPercent: string;
    appearance: string;
  }
> = {
  0: {
    rating: 0,
    shortLabel: 'Classe 0 (0 % décollement)',
    description: 'Les bords des incisions sont parfaitement lisses ; aucun des carrés du quadrillage ne s\'est détaché.',
    affectedAreaPercent: '0 %',
    appearance: 'Bords parfaitement nets et lisses'
  },
  1: {
    rating: 1,
    shortLabel: 'Classe 1 (≤ 5 % décollement)',
    description: 'Détachement de petits éclats de revêtement aux intersections des incisions. Au plus 5 % de la surface du quadrillage est affectée.',
    affectedAreaPercent: '≤ 5 %',
    appearance: 'Petits éclats aux intersections'
  },
  2: {
    rating: 2,
    shortLabel: 'Classe 2 (5 % à 15 % décollement)',
    description: 'Le revêtement s\'est écaillé le long des bords et/ou aux intersections des incisions. Plus de 5 % mais pas plus de 15 % de la surface est affectée.',
    affectedAreaPercent: '> 5 % et ≤ 15 %',
    appearance: 'Écaillage le long des bords / intersections'
  },
  3: {
    rating: 3,
    shortLabel: 'Classe 3 (15 % à 35 % décollement)',
    description: 'Le revêtement s\'est écaillé le long des bords des incisions en larges bandes et/ou des carrés se sont détachés en tout ou partie. Plus de 15 % mais pas plus de 35 % de la surface est affectée.',
    affectedAreaPercent: '> 15 % et ≤ 35 %',
    appearance: 'Larges bandes écaillées et/ou carrés partiels'
  },
  4: {
    rating: 4,
    shortLabel: 'Classe 4 (35 % à 65 % décollement)',
    description: 'Le revêtement s\'est écaillé le long des bords des incisions en larges bandes et/ou plusieurs carrés se sont détachés en tout ou partie. Plus de 35 % mais pas plus de 65 % de la surface est affectée.',
    affectedAreaPercent: '> 35 % et ≤ 65 %',
    appearance: 'Importants décollements en larges bandes'
  },
  5: {
    rating: 5,
    shortLabel: 'Classe 5 (> 65 % décollement)',
    description: 'Tout degré d\'écaillage qui ne peut même pas être classé en classe 4 (décollement supérieur à 65 %).',
    affectedAreaPercent: '> 65 %',
    appearance: 'Décollement quasi-total ou total'
  }
};

/**
 * Détermination de l'espacement de quadrillage applicable selon NF EN ISO 2409:2020
 * Sur support bois (support tendre / anisotrope) :
 * - Épaisseur ≤ 60 µm : 2 mm (ou 1 mm sur support dur, 2 mm recommandé pour bois)
 * - Épaisseur 61 à 120 µm : 2 mm
 * - Épaisseur 121 à 250 µm : 3 mm
 * - Épaisseur > 250 µm : ≥ 3 mm ou Méthode par incision en X (ISO 16276-2)
 */
export function getApplicableGridSpacing(
  coatingThicknessMicrons?: number | null,
  isWoodOrSoftSubstrate: boolean = true
): {
  gridSpacingMm: number;
  cutsCount: number;
  thicknessCategory: string;
  rationale: string;
} {
  const thickness = coatingThicknessMicrons ?? 60; // Valeur par défaut si non spécifié

  if (thickness <= 60) {
    if (isWoodOrSoftSubstrate) {
      return {
        gridSpacingMm: 2,
        cutsCount: 6,
        thicknessCategory: '≤ 60 µm (Support Bois / Tendre)',
        rationale: 'NF EN ISO 2409 §5.2.2 : Espacement de 2 mm recommandé pour supports bois et tendres ≤ 60 µm (6 incisions dans chaque direction).'
      };
    } else {
      return {
        gridSpacingMm: 1,
        cutsCount: 6,
        thicknessCategory: '≤ 60 µm (Support Rigide)',
        rationale: 'NF EN ISO 2409 §5.2.2 : Espacement de 1 mm pour revêtements durs ≤ 60 µm.'
      };
    }
  } else if (thickness <= 120) {
    return {
      gridSpacingMm: 2,
      cutsCount: 6,
      thicknessCategory: '61 µm à 120 µm',
      rationale: 'NF EN ISO 2409 §5.2.2 : Espacement de 2 mm pour revêtements de 61 µm à 120 µm (tous supports).'
    };
  } else if (thickness <= 250) {
    return {
      gridSpacingMm: 3,
      cutsCount: 6,
      thicknessCategory: '121 µm à 250 µm',
      rationale: 'NF EN ISO 2409 §5.2.2 : Espacement de 3 mm pour revêtements de 121 µm à 250 µm.'
    };
  } else {
    return {
      gridSpacingMm: 3,
      cutsCount: 6,
      thicknessCategory: '> 250 µm (Forte épaisseur)',
      rationale: 'NF EN ISO 2409 §5.2.2 : Pour épaisseurs > 250 µm, espacement spécial ≥ 3 mm ou méthode d\'incision en croix X (ISO 16276-2).'
    };
  }
}

/**
 * Calcul et vérification automatique du délai entre application et mesure
 */
export function calculateDelayCompliance(
  applicationDateStr?: string,
  measurementDateStr?: string,
  requiredMinimumHours: number = 168
): {
  elapsedTimeHours: number | null;
  formattedElapsedTime: string;
  status: 'CONFORME' | 'INSUFFICIENT_DELAY' | 'INVALID_DATE' | 'MISSING_APPLICATION_DATE';
  complianceText: 'CONFORME' | 'DÉLAI INSUFFISANT' | 'DATE INVALIDE' | 'DATE NON RENSEIGNÉE';
  message: string;
} {
  if (!applicationDateStr || applicationDateStr.trim() === '') {
    return {
      elapsedTimeHours: null,
      formattedElapsedTime: 'Non déterminée',
      status: 'MISSING_APPLICATION_DATE',
      complianceText: 'DATE NON RENSEIGNÉE',
      message: 'Date d\'application du lot non renseignée. Veuillez renseigner la date d\'application dans la définition du lot.'
    };
  }

  const appTime = new Date(applicationDateStr).getTime();
  if (isNaN(appTime)) {
    return {
      elapsedTimeHours: null,
      formattedElapsedTime: 'Date invalide',
      status: 'INVALID_DATE',
      complianceText: 'DATE INVALIDE',
      message: 'Format de la date d\'application invalide.'
    };
  }

  const measureTime = measurementDateStr ? new Date(measurementDateStr).getTime() : Date.now();
  if (isNaN(measureTime)) {
    return {
      elapsedTimeHours: null,
      formattedElapsedTime: 'Date invalide',
      status: 'INVALID_DATE',
      complianceText: 'DATE INVALIDE',
      message: 'Format de la date de mesure invalide.'
    };
  }

  const diffMs = measureTime - appTime;
  if (diffMs < 0) {
    return {
      elapsedTimeHours: null,
      formattedElapsedTime: 'Antérieure à application',
      status: 'INVALID_DATE',
      complianceText: 'DATE INVALIDE',
      message: 'La date de mesure ne peut pas être antérieure à la date d\'application de la finition.'
    };
  }

  const elapsedHours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(elapsedHours / 24);
  const remainingHours = Math.floor(elapsedHours % 24);
  const minutes = Math.floor((elapsedHours * 60) % 60);

  const formattedElapsedTime =
    days > 0
      ? `${days} j ${remainingHours} h ${minutes > 0 ? minutes + ' min' : ''}`.trim()
      : `${Math.floor(elapsedHours)} h ${minutes} min`;

  if (elapsedHours < requiredMinimumHours) {
    return {
      elapsedTimeHours: Math.round(elapsedHours * 10) / 10,
      formattedElapsedTime,
      status: 'INSUFFICIENT_DELAY',
      complianceText: 'DÉLAI INSUFFISANT',
      message: `Délai de séchage/conditionnement insuffisant (${formattedElapsedTime} écoulés vs ${requiredMinimumHours} h requis par le protocole).`
    };
  }

  return {
    elapsedTimeHours: Math.round(elapsedHours * 10) / 10,
    formattedElapsedTime,
    status: 'CONFORME',
    complianceText: 'CONFORME',
    message: `Délai respecté (${formattedElapsedTime} écoulés pour un minimum requis de ${requiredMinimumHours} h).`
  };
}

export interface AdhesionCalculationOptions {
  referenceRaw?: AdhesionRawData | null;
  referenceStageId?: UUID | null;
  panelId?: UUID;
  stageId?: UUID;
  calculationVersion?: string;
}

/**
 * Normalisation en lecture seule (Gate 57) : le RAW historique scalaire
 * (`adhesionClass`) est lu comme une mesure unique ; le RAW multi-mesures utilise
 * `measurements`. Le RAW n'est jamais réécrit ni complété artificiellement.
 */
export interface NormalizedAdhesionMeasurement {
  measurementIndex: number;
  adhesionClass: number | null;
  observation?: string;
}

export function normalizeAdhesionMeasurements(raw: AdhesionRawData): NormalizedAdhesionMeasurement[] {
  // Chaîne vide historique = mesure manquante (comportement d'origine conservé), jamais classe 0.
  const cleanValue = (v: unknown): number | null =>
    v === '' ? null : ((v ?? null) as number | null);
  if (Array.isArray(raw.measurements) && raw.measurements.length > 0) {
    return raw.measurements.map((m, i) => ({
      measurementIndex: m.measurementIndex ?? i + 1,
      adhesionClass: cleanValue(m.adhesionClass),
      observation: typeof m.observation === 'string' ? m.observation : undefined
    }));
  }
  return [{
    measurementIndex: 1,
    adhesionClass: cleanValue(raw.adhesionClass),
    observation: typeof raw.observation === 'string' ? raw.observation : undefined
  }];
}

function isValidAdhesionClass(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

/**
 * Résout la configuration de comptage ADHESION effective SANS modifier le stocké.
 *
 * Compatibilité historique D4 (Gate 57) : les essais créés avant le Gate 57 ne
 * possèdent AUCUN `countConfig` ADHESION enregistré (seul `enabled` était persisté).
 * Ces configurations sont interprétées comme le protocole historique
 * (1 mesure attendue, standard 1) et NON comme 1/2 au regard du nouveau standard.
 * Le référentiel live ne rétrograde jamais un essai historique en WARNING.
 */
export function resolveAdhesionCountConfig(
  stored: MeasurementCountConfiguration | undefined
): MeasurementCountConfiguration {
  if (stored) return stored;
  return {
    familyId: 'ADHESION',
    mode: 'STANDARD_DEFAULT',
    origin: 'NORMATIVE_REQUIREMENT',
    standardReference: 'NF EN ISO 2409:2020',
    clause: '§5 & §6 (Essai de quadrillage)',
    rationale: 'Configuration historique implicite (pré-Gate 57) : 1 mesure par panneau.',
    standardRecommendedCount: 1,
    configuredCount: 1,
    deviationFromStandard: false,
    configuredBy: 'SYSTEM',
    configuredAt: '2026-08-30T00:00:00Z',
    ruleSource: 'NORMATIVE_REQUIREMENT'
  };
}

/**
 * Moteur de calcul et d'évaluation métrologique pour l'Adhérence au quadrillage
 */
export function calculateAdhesion(
  raw: AdhesionRawData,
  countConfig: MeasurementCountConfiguration | undefined,
  ruleSet: ScientificRuleSet,
  options?: AdhesionCalculationOptions
): {
  computed: AdhesionComputedData;
  alerts: MeasurementAlert[];
} {
  const alerts: MeasurementAlert[] = [];
  const version = options?.calculationVersion || ADHESION_CALCULATION_VERSION;

  // 1. Mesures individuelles (Gate 57) : 2 standard, 1 si adaptation justifiée.
  // Le nombre attendu vient du protocole ; défaut 2 quand aucune configuration.
  // Compatibilité historique D4 : un RAW scalaire legacy (sans `measurements`) est
  // TOUJOURS interprété comme 1 mesure attendue (1/1), quelle que soit la
  // configuration live — jamais de 1/2 WARNING rétroactif sur l'historique.
  const isLegacyScalar = !Array.isArray(raw.measurements) || raw.measurements.length === 0;
  const expectedCount = isLegacyScalar ? 1 : (countConfig?.configuredCount ?? 2);
  const measurements = normalizeAdhesionMeasurements(raw);

  // Référence T0 (Gate 5.6 : témoin) normalisée une seule fois, en lecture seule.
  // Appariement strict par `measurementIndex` : C12 mesure N ↔ T0 témoin mesure N.
  // Aucune mesure inventée : sans référence valide de même index, pas de delta.
  const refMeasurements = options?.referenceRaw
    ? normalizeAdhesionMeasurements(options.referenceRaw)
    : [];
  const refByIndex = new Map<number, number>();
  refMeasurements.forEach((m) => {
    if (isValidAdhesionClass(m.adhesionClass) && !refByIndex.has(m.measurementIndex)) {
      refByIndex.set(m.measurementIndex, m.adhesionClass);
    }
  });

  const individualResults: AdhesionIndividualResult[] = [];
  const validClasses: number[] = [];
  measurements.forEach((m) => {
    if (m.adhesionClass === null || m.adhesionClass === undefined) {
      individualResults.push({ measurementIndex: m.measurementIndex, adhesionClass: null, deltaAdhesionClass: null });
      return;
    }
    const parsed = Number(m.adhesionClass);
    if (!isNaN(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= 5) {
      const refClass = refByIndex.get(m.measurementIndex);
      individualResults.push({
        measurementIndex: m.measurementIndex,
        adhesionClass: parsed,
        deltaAdhesionClass: refClass !== undefined ? Math.round((parsed - refClass) * 10) / 10 : null
      });
      validClasses.push(parsed);
    } else {
      individualResults.push({ measurementIndex: m.measurementIndex, adhesionClass: m.adhesionClass, deltaAdhesionClass: null });
      alerts.push({
        id: `alert-adh-invalid-${options?.stageId || ''}-${options?.panelId || ''}-${m.measurementIndex}`,
        severity: 'BLOCKING',
        code: 'PHYSICAL_BOUNDS_EXCEEDED',
        message: `Classe d'adhérence ISO 2409 invalide (mesure n°${m.measurementIndex}) : "${m.adhesionClass}". La classe doit être un entier strict entre 0 et 5.`,
        familyId: 'ADHESION',
        stageId: options?.stageId,
        panelId: options?.panelId
      });
    }
  });

  // Classe unique (mono-mesure ou RAW historique scalaire) : valeur directe, comportement
  // historique strictement préservé. Multi-mesures : null, la moyenne fait foi (D-10 GO).
  const isSingle = individualResults.length <= 1;
  const adhesionClass: number | null = isSingle
    ? (validClasses.length === 1 ? validClasses[0] : null)
    : null;
  const panelMean: number | null =
    validClasses.length > 0
      ? Math.round((validClasses.reduce((a, b) => a + b, 0) / validClasses.length) * 10) / 10
      : null;
  // ISO 2409 = classification en 6 classes, PAS une mesure quantitative.
  // Une moyenne numérique (panelMean) ne doit JAMAIS être reconvertie en classe
  // (ni description ISO) par arrondi : elle reste un indicateur décimal.
  const classDescription =
    adhesionClass !== null
      ? ISO2409_CLASSES[adhesionClass]?.description || `Classe ${adhesionClass}`
      : panelMean !== null
        ? `Moyenne panneau : ${panelMean} — indicateur numérique complémentaire (hors classification ISO 2409)`
        : 'Non mesurée';

  // 2. Contrôle du délai d'application
  const delayCheck = calculateDelayCompliance(
    raw.applicationDateTime,
    raw.measurementDateTime,
    raw.requiredMinimumDelayHours || 168
  );

  if (delayCheck.status === 'INVALID_DATE') {
    alerts.push({
      id: `alert-adh-date-${options?.stageId || ''}-${options?.panelId || ''}`,
      severity: 'BLOCKING',
      code: 'MEASUREMENT_INVALID',
      message: delayCheck.message,
      familyId: 'ADHESION',
      stageId: options?.stageId,
      panelId: options?.panelId
    });
  } else if (delayCheck.status === 'INSUFFICIENT_DELAY') {
    alerts.push({
      id: `alert-adh-delay-${options?.stageId || ''}-${options?.panelId || ''}`,
      severity: 'WARNING',
      code: 'PROTOCOL_ADAPTED',
      message: delayCheck.message,
      familyId: 'ADHESION',
      stageId: options?.stageId,
      panelId: options?.panelId
    });
  } else if (delayCheck.status === 'MISSING_APPLICATION_DATE') {
    alerts.push({
      id: `alert-adh-missing-appdate-${options?.stageId || ''}-${options?.panelId || ''}`,
      severity: 'WARNING',
      code: 'MEASUREMENT_MISSING',
      message: delayCheck.message,
      familyId: 'ADHESION',
      stageId: options?.stageId,
      panelId: options?.panelId
    });
  }

  // 3. Référence T0 & Évolution (Gate 5.6 : T0 du témoin ; Gate 57 : moyennes de panneau).
  // La référence est normalisée comme une mesure (scalaire historique = mesure unique),
  // puis moyennée : initialPanelMean = moyenne des classes T0 témoin valides.
  let initialAdhesionClass: number | null = null;
  let initialPanelMean: number | null = null;
  let deltaAdhesionClass: number | null = null;

  if (options?.referenceRaw) {
    const refValid = refMeasurements
      .map((m) => m.adhesionClass)
      .filter((v): v is number => isValidAdhesionClass(v));
    if (refValid.length > 0) {
      initialPanelMean = Math.round((refValid.reduce((a, b) => a + b, 0) / refValid.length) * 10) / 10;
      // Compatibilité historique : scalaire de référence conservé tel quel (mono-mesure).
      if (refMeasurements.length <= 1) {
        initialAdhesionClass = initialPanelMean;
      }
      if (panelMean !== null) {
        deltaAdhesionClass = Math.round((panelMean - initialPanelMean) * 10) / 10;
      }
    }
  }

  // 4. Évaluation Qualité (Gate 57) : le nombre attendu vient du protocole
  // (standard 2, 1 si adaptation), jamais en dur. Une seule mesure sur 2 attendues
  // = 50 % et incomplet (WARNING), jamais complet.
  const actualCount = individualResults.filter(
    (m) => m.adhesionClass !== null && m.adhesionClass !== undefined
  ).length;
  const validCount = validClasses.length;
  const providedInvalidCount = individualResults.filter(
    (m) => m.adhesionClass !== null && m.adhesionClass !== undefined && !isValidAdhesionClass(m.adhesionClass)
  ).length;
  const missingCount = Math.max(0, expectedCount - actualCount);
  const completenessPercent =
    expectedCount > 0 ? Math.round((validCount / expectedCount) * 100) : 0;

  // Gate 57 : mesure(s) manquante(s) sur protocole multi-mesures → alerte WARNING
  // explicite MEASUREMENT_MISSING. Jamais sur RAW legacy (toujours 1/1).
  if (!isLegacyScalar && missingCount > 0) {
    alerts.push({
      id: `alert-adh-missing-${options?.stageId || ''}-${options?.panelId || ''}`,
      severity: 'WARNING',
      code: 'MEASUREMENT_MISSING',
      message: `Mesure(s) d'adhérence manquante(s) : ${validCount}/${expectedCount} mesure(s) valide(s). Saisissez les ${missingCount} mesure(s) restante(s) (classes 0 à 5).`,
      familyId: 'ADHESION',
      stageId: options?.stageId,
      panelId: options?.panelId
    });
  }

  const isInvalid = alerts.some((a) => a.severity === 'BLOCKING');
  const hasWarning = alerts.some((a) => a.severity === 'WARNING');
  const isComplete = validCount >= expectedCount && expectedCount > 0 && !isInvalid;

  const qualityAssessment: QualityAssessment = {
    expectedCount,
    actualCount,
    validCount,
    suspectCount: 0,
    invalidCount: isInvalid ? Math.max(1, providedInvalidCount) : 0,
    missingCount,
    completenessPercent,
    status: isInvalid
      ? 'INVALID'
      : actualCount === 0
        ? 'INVALID'
        : !isComplete
          ? 'WARNING'
          : hasWarning
            ? 'WARNING'
            : 'GOOD',
    warnings: alerts.map((a) => a.message)
  };

  const protocolStatus: ProtocolComplianceStatus = countConfig?.deviationFromStandard
    ? countConfig.justification?.trim()
      ? 'ADAPTED_JUSTIFIED'
      : 'ADAPTED_UNJUSTIFIED'
    : 'STANDARD';

  const computed: AdhesionComputedData = {
    adhesionClass,
    classDescription,
    individualResults,
    panelMean,
    initialAdhesionClass,
    initialPanelMean,
    deltaAdhesionClass,
    elapsedTimeHours: delayCheck.elapsedTimeHours,
    delayCompliance:
      delayCheck.status === 'CONFORME'
        ? 'CONFORME'
        : delayCheck.status === 'INSUFFICIENT_DELAY'
        ? 'NON_CONFORME'
        : 'NON_EVALUE',
    gridSpacingUsedMm: raw.gridSpacingMm || 2,
    criterionCategory: adhesionClass !== null ? `Classe ${adhesionClass} (ISO 2409)` : undefined,
    qualityAssessment,
    protocolStatus,
    computation: {
      calculationVersion: version,
      calculatedAt: new Date().toISOString()
    }
  };

  return { computed, alerts };
}
