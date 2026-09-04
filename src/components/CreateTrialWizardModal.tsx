/**
 * QUV-Lab — Assistant de Création d'Essai (PROMPT 6 v6.1 - 7 Étapes Métier)
 * 1. Identification & Métadonnées
 * 2. Caractéristiques communes
 * 3. Création des lots (indépendance des caractéristiques et nombre de panneaux)
 * 4. Identification des panneaux (génération du référentiel permanent)
 * 5. Familles & Plan de mesure (NF EN 927-6 vs Lab, déviations justifiées)
 * 6. Calendrier de l'essai (T0 + 12 cycles de 168 h)
 * 7. Récapitulatif & Validation
 */

import React, { useState } from 'react';
import {
  TrialMetadata,
  CommonCharacteristics,
  TrialProtocolConfig
} from '../types/trial';
import {
  MeasurementFamilyId,
  ScientificRuleSet
} from '../types/scientific';
import { globalTrialStore } from '../services/trialStore';
import { createCountConfiguration, createSeriesConfiguration } from '../scientific/ruleSet';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Layers,
  FlaskConical,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  Info,
  Sliders,
  FileText,
  Tag,
  Clock,
  Sparkles,
  Lock,
  CheckSquare,
  Square
} from 'lucide-react';

interface Props {
  ruleSet?: ScientificRuleSet;
  isOpen?: boolean;
  onClose: () => void;
  onCreated?: (trialId: string) => void;
}

export interface LotFormItem {
  id: string;
  reference: string;
  woodSpecies: string;
  productReference: string;
  manufacturerOrSupplier: string;
  coatingSystem: string;
  coatCount: number;
  substratePreparation: string;
  applicationMethod: string;
  applicationConditions: string;
  applicationDate: string;
  dryingOrConditioningTime: string;
  batchNotes: string;
  panelCount: number;
}

export function CreateTrialWizardModal({
  ruleSet: propRuleSet,
  isOpen = true,
  onClose,
  onCreated
}: Props) {
  const ruleSet = propRuleSet || globalTrialStore['ruleSet'];
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);

  // ==========================================
  // ÉTAPE 1 : Identification & Métadonnées
  // ==========================================
  const [reference, setReference] = useState(`QUV-2026-0${Math.floor(Math.random() * 80 + 20)}`);
  const [title, setTitle] = useState('');
  const [projectOrClient, setProjectOrClient] = useState('');
  const [createdBy, setCreatedBy] = useState('Simon Martin (Technicien Labo)');
  const [generalNotes, setGeneralNotes] = useState('');

  // ==========================================
  // ÉTAPE 2 : Caractéristiques communes de l'essai
  // ==========================================
  const [lengthMm, setLengthMm] = useState<number>(150);
  const [widthMm, setWidthMm] = useState<number>(75);
  const [thicknessMm, setThicknessMm] = useState<number>(15);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm'>('mm');
  const [substrateNature, setSubstrateNature] = useState<string>('Bois massif');
  const [materialType, setMaterialType] = useState<string>('Pin sylvestre standardisé (NF EN 927-6)');
  const [woodGrainOrientation, setWoodGrainOrientation] = useState<string>('Sur quartier (NF EN 927-6 §5)');
  const [preparationNotes, setPreparationNotes] = useState<string>('Ponçage mécanique P120, dépoussiérage soigné');
  const [conditioningNotes, setConditioningNotes] = useState<string>('Conditionnement 7 jours à 20±2°C et 65±5% HR jusqu\'à masse constante');
  const [commonProtocolNotes, setCommonProtocolNotes] = useState<string>('Éprouvettes usinées sans nœud ni défaut selon prescriptions de la norme.');

  // ==========================================
  // ÉTAPE 6 : Plan de mesurage & Calendrier
  // ==========================================
  const [selectedMeasurementCycles, setSelectedMeasurementCycles] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  ]);

  const toggleCycleMeasurement = (cycleIndex: number) => {
    if (cycleIndex === 0 || cycleIndex === 12) return; // T0 et C12 obligatoires
    setSelectedMeasurementCycles((prev) =>
      prev.includes(cycleIndex) ? prev.filter((c) => c !== cycleIndex) : [...prev, cycleIndex].sort((a, b) => a - b)
    );
  };

  const setPlanPreset = (preset: 'FULL' | 'QUARTERLY' | 'LIGHT') => {
    if (preset === 'FULL') {
      setSelectedMeasurementCycles([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    } else if (preset === 'QUARTERLY') {
      setSelectedMeasurementCycles([0, 3, 6, 9, 12]);
    } else if (preset === 'LIGHT') {
      setSelectedMeasurementCycles([0, 6, 12]);
    }
  };
  const [batches, setBatches] = useState<LotFormItem[]>([
    {
      id: '1',
      reference: 'LOT XX1C',
      woodSpecies: 'Pin sylvestre standardisé',
      productReference: 'LAS-STD-01',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatingSystem: 'Système Témoin Standard (3 couches)',
      coatCount: 3,
      substratePreparation: 'Ponçage grain P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: new Date().toISOString().slice(0, 10),
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Lot témoin sans stabilisant UV renforcé',
      panelCount: 4
    },
    {
      id: '2',
      reference: 'LOT XX2C',
      woodSpecies: 'Pin sylvestre standardisé',
      productReference: 'LAS-UV15-02',
      manufacturerOrSupplier: 'Fournisseur Alpha',
      coatingSystem: 'Système Anti-UV HALS 1.5%',
      coatCount: 3,
      substratePreparation: 'Ponçage grain P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: new Date().toISOString().slice(0, 10),
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Formulation avec absorbeurs UV organiques',
      panelCount: 4
    },
    {
      id: '3',
      reference: 'LOT XX3C',
      woodSpecies: 'Pin sylvestre standardisé',
      productReference: 'LAS-NANO-03',
      manufacturerOrSupplier: 'Fournisseur Bêta',
      coatingSystem: 'Système Hybride Nano-TiO2',
      coatCount: 3,
      substratePreparation: 'Ponçage grain P120',
      applicationMethod: 'Pinceau',
      applicationConditions: '21°C, 55% HR',
      applicationDate: new Date().toISOString().slice(0, 10),
      dryingOrConditioningTime: '7 jours à 20°C/65% HR',
      batchNotes: 'Formulation avec nano-charges minérales',
      panelCount: 4
    }
  ]);

  // ==========================================
  // ÉTAPE 5 : Familles actives & Plan de mesure
  // ==========================================
  const [activeFamilies, setActiveFamilies] = useState<MeasurementFamilyId[]>([
    'COLOR',
    'GLOSS',
    'PERSOZ',
    'ADHESION',
    'OBSERVATIONS'
  ]);

  const [colorPoints, setColorPoints] = useState<number>(4);
  const [colorJustification, setColorJustification] = useState<string>('');

  const [glossSeriesCount, setGlossSeriesCount] = useState<number>(2);
  const [glossReadingsPerSeries, setGlossReadingsPerSeries] = useState<number>(2);
  const [glossJustification, setGlossJustification] = useState<string>('');

  const [persozReps, setPersozReps] = useState<number>(3);
  const [persozJustification, setPersozJustification] = useState<string>('');

  // Gestion des familles
  const toggleFamily = (fam: MeasurementFamilyId) => {
    if (activeFamilies.includes(fam)) {
      setActiveFamilies(activeFamilies.filter((f) => f !== fam));
    } else {
      setActiveFamilies([...activeFamilies, fam]);
    }
  };

  const addBatchRow = () => {
    const nextIdx = batches.length + 1;
    setBatches([
      ...batches,
      {
        id: Date.now().toString(),
        reference: `LOT XX${nextIdx}C`,
        woodSpecies: materialType || 'Pin sylvestre standardisé',
        productReference: `PROD-0${nextIdx}`,
        manufacturerOrSupplier: 'Laboratoire / Fabricant',
        coatingSystem: `Système Expérimental #${nextIdx}`,
        coatCount: 3,
        substratePreparation: 'Ponçage P120',
        applicationMethod: 'Pinceau',
        applicationConditions: '20°C, 60% HR',
        applicationDate: new Date().toISOString().slice(0, 10),
        dryingOrConditioningTime: '7 jours à 20°C/65% HR',
        batchNotes: '',
        panelCount: 4
      }
    ]);
  };

  const updateBatch = (id: string, field: keyof LotFormItem, value: any) => {
    setBatches(batches.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBatchRow = (id: string) => {
    if (batches.length <= 1) return;
    setBatches(batches.filter((b) => b.id !== id));
  };

  // Validations adaptations
  const isColorAdapted = colorPoints !== 4;
  const isColorAdaptationInvalid = isColorAdapted && colorJustification.trim().length === 0;

  const isGlossAdapted = glossSeriesCount !== 2 || glossReadingsPerSeries !== 2;
  const isGlossAdaptationInvalid = isGlossAdapted && glossJustification.trim().length === 0;

  const isPersozAdapted = persozReps !== 3;
  const isPersozAdaptationInvalid = isPersozAdapted && persozJustification.trim().length === 0;

  const isStep1Valid = Boolean(reference.trim() && createdBy.trim());
  const isStep5Valid = !isColorAdaptationInvalid && !isGlossAdaptationInvalid && !isPersozAdaptationInvalid;
  const isFinalStepValid = Boolean(createdBy.trim());

  // Calcul du nombre total de panneaux
  const totalPanelsCount = batches.reduce((sum, b) => sum + (Number(b.panelCount) || 1), 0);

  // Soumission finale
  const handleFinalCreate = () => {
    const trimmedCreatedBy = createdBy.trim();
    if (!trimmedCreatedBy) {
      return;
    }

    const metadata: TrialMetadata = {
      reference: reference.trim(),
      title: title.trim() || 'Essai de vieillissement accéléré UV (NF EN 927-6)',
      projectOrClient: projectOrClient.trim() || 'Projet Interne',
      coatingSystemDescription: batches.map((b) => `${b.reference}: ${b.coatingSystem}`).join(' | '),
      substrateDescription: `${substrateNature} — ${materialType} (${lengthMm}×${widthMm}×${thicknessMm} ${dimUnit})`,
      createdBy: trimmedCreatedBy,
      generalNotes: generalNotes.trim()
    };

    const commonCharacteristics: CommonCharacteristics = {
      dimensions: {
        lengthMm,
        widthMm,
        thicknessMm,
        unit: dimUnit
      },
      substrateNature,
      materialType,
      woodGrainOrientation,
      preparationNotes,
      conditioningNotes,
      generalProtocolNotes: commonProtocolNotes
    };

    const colorConfig = isColorAdapted
      ? createCountConfiguration('COLOR', colorPoints, ruleSet, { justification: colorJustification, operatorId: trimmedCreatedBy })
      : createCountConfiguration('COLOR', 4, ruleSet);

    const glossConfig = isGlossAdapted
      ? createSeriesConfiguration('GLOSS', glossSeriesCount, glossReadingsPerSeries, ruleSet, {
          justification: glossJustification,
          operatorId: trimmedCreatedBy
        })
      : createSeriesConfiguration('GLOSS', 2, 2, ruleSet);

    const persozConfig = isPersozAdapted
      ? createCountConfiguration('PERSOZ', persozReps, ruleSet, { justification: persozJustification, operatorId: trimmedCreatedBy })
      : createCountConfiguration('PERSOZ', 3, ruleSet);

    const createdTrial = globalTrialStore.createTrial({
      metadata,
      commonCharacteristics,
      batches: batches.map((b) => ({
        reference: b.reference.trim(),
        coatingSystem: b.coatingSystem.trim(),
        woodSpecies: b.woodSpecies.trim(),
        productReference: b.productReference.trim(),
        manufacturerOrSupplier: b.manufacturerOrSupplier.trim(),
        coatCount: Number(b.coatCount) || 3,
        substratePreparation: b.substratePreparation.trim(),
        applicationMethod: b.applicationMethod.trim(),
        applicationConditions: b.applicationConditions.trim(),
        applicationDate: b.applicationDate,
        dryingOrConditioningTime: b.dryingOrConditioningTime.trim(),
        batchNotes: b.batchNotes.trim(),
        panelCount: Number(b.panelCount) || 4
      })),
      activeFamilies,
      familyConfigs: {
        COLOR: { familyId: 'COLOR', enabled: activeFamilies.includes('COLOR'), countConfig: colorConfig },
        GLOSS: { familyId: 'GLOSS', enabled: activeFamilies.includes('GLOSS'), seriesConfig: glossConfig },
        PERSOZ: { familyId: 'PERSOZ', enabled: activeFamilies.includes('PERSOZ'), countConfig: persozConfig },
        ADHESION: { familyId: 'ADHESION', enabled: activeFamilies.includes('ADHESION') },
        OBSERVATIONS: { familyId: 'OBSERVATIONS', enabled: activeFamilies.includes('OBSERVATIONS') }
      },
      selectedMeasurementCycles
    });

    if (onCreated) onCreated(createdTrial.id);
    onClose();
  };

  const stepsList = [
    { num: 1, label: '01 Identification' },
    { num: 2, label: '02 Caractéristiques' },
    { num: 3, label: '03 Lots' },
    { num: 4, label: '04 Panneaux' },
    { num: 5, label: '05 Plan de Mesure' },
    { num: 6, label: '06 Calendrier' },
    { num: 7, label: '07 Validation' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Assistant de Création d'un Nouvel Essai</h2>
              <p className="text-xs text-slate-400">Flux Métier Laboratoire • NF EN 927-6 • Référentiel Permanent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper (7 étapes) */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs overflow-x-auto gap-2">
          {stepsList.map((s) => (
            <div
              key={s.num}
              onClick={() => {
                // Navigation vers étapes antérieures toujours permise
                if (s.num < step) setStep(s.num as any);
              }}
              className={`flex items-center gap-2 font-medium shrink-0 ${
                s.num < step ? 'cursor-pointer hover:opacity-80' : ''
              } ${
                step === s.num
                  ? 'text-blue-700 font-bold'
                  : step > s.num
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step === s.num
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="hidden md:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================ */}
          {/* STEP 1 : Identification & Métadonnées                        */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Ces informations identifient l'essai et son contexte administratif. La référence doit être unique pour assurer la traçabilité.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Référence Essai (Unique) *
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold ${
                      !reference.trim() ? 'border-rose-300 bg-rose-50/20' : 'border-slate-300'
                    }`}
                    placeholder="Ex: QUV-2026-042"
                  />
                  {!reference.trim() && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      La référence unique est obligatoire pour la traçabilité.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Titre descriptif de l'essai
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Évaluation durabilité finitions lasures sur chêne"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Projet / Client / Demandeur
                  </label>
                  <input
                    type="text"
                    value={projectOrClient}
                    onChange={(e) => setProjectOrClient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Ceribois - Programme Recherche R&D"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Opérateur Responsable / Créateur *
                  </label>
                  <input
                    type="text"
                    value={createdBy}
                    onChange={(e) => setCreatedBy(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium ${
                      !createdBy.trim() ? 'border-rose-300 bg-rose-50/20' : 'border-slate-300'
                    }`}
                    placeholder="Ex: Simon Martin (Technicien)"
                  />
                  {!createdBy.trim() && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      L'opérateur responsable est requis pour la traçabilité réglementaire de l'essai.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes générales de l'essai
                </label>
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Objectif de l'étude, particularités de mise en œuvre, consignes spéciales..."
                />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2 : Caractéristiques communes de l'essai               */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Caractéristiques communes du substrat et de préparation</p>
                  <p>
                    Ces caractéristiques s'appliquent par défaut à l'ensemble des éprouvettes de l'essai selon les exigences de la norme NF EN 927-6 §5.
                  </p>
                </div>
              </div>

              {/* Dimensions */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Dimensions normalisées des éprouvettes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Longueur</label>
                    <input
                      type="number"
                      value={lengthMm}
                      onChange={(e) => setLengthMm(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Largeur</label>
                    <input
                      type="number"
                      value={widthMm}
                      onChange={(e) => setWidthMm(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Épaisseur</label>
                    <input
                      type="number"
                      value={thicknessMm}
                      onChange={(e) => setThicknessMm(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Unité</label>
                    <select
                      value={dimUnit}
                      onChange={(e) => setDimUnit(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="mm">Millimètres (mm)</option>
                      <option value="cm">Centimètres (cm)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Matériau & Substrat */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nature du support
                  </label>
                  <input
                    type="text"
                    value={substrateNature}
                    onChange={(e) => setSubstrateNature(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Bois massif"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type de matériau / Essence de référence
                  </label>
                  <input
                    type="text"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Pin sylvestre (Pinus sylvestris)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Orientation du fil du bois
                  </label>
                  <input
                    type="text"
                    value={woodGrainOrientation}
                    onChange={(e) => setWoodGrainOrientation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Sur quartier (NF EN 927-6)"
                  />
                </div>
              </div>

              {/* Préparation & Conditionnement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Informations de préparation du support
                  </label>
                  <textarea
                    rows={2}
                    value={preparationNotes}
                    onChange={(e) => setPreparationNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ponçage, dépoussiérage, état de surface..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Informations de conditionnement
                  </label>
                  <textarea
                    rows={2}
                    value={conditioningNotes}
                    onChange={(e) => setConditioningNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Température, hygrométrie, durée de stabilisation..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Paramètres communs au protocole de l'essai
                </label>
                <input
                  type="text"
                  value={commonProtocolNotes}
                  onChange={(e) => setCommonProtocolNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notes communes..."
                />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3 : Création des lots                                   */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Définition des Lots Expérimentaux ({batches.length} lots configurés)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chaque lot possède ses propres paramètres d'application et son propre nombre de panneaux.
                  </p>
                </div>
                <button
                  onClick={addBatchRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un Lot
                </button>
              </div>

              <div className="space-y-4">
                {batches.map((batch, idx) => (
                  <div
                    key={batch.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-900 text-white font-mono">
                          Lot #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={batch.reference}
                          onChange={(e) => updateBatch(batch.id, 'reference', e.target.value)}
                          className="px-2 py-1 text-sm font-bold border border-slate-300 rounded font-mono text-blue-900 w-32"
                          placeholder="Ex: LOT XX1C"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <span>Nombre de panneaux :</span>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={batch.panelCount}
                            onChange={(e) => updateBatch(batch.id, 'panelCount', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold bg-blue-50 text-blue-900"
                          />
                        </div>
                        {batches.length > 1 && (
                          <button
                            onClick={() => removeBatchRow(batch.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer ce lot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Essence de bois</label>
                        <input
                          type="text"
                          value={batch.woodSpecies}
                          onChange={(e) => updateBatch(batch.id, 'woodSpecies', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: Chêne, Pin..."
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Produit appliqué (Réf.)</label>
                        <input
                          type="text"
                          value={batch.productReference}
                          onChange={(e) => updateBatch(batch.id, 'productReference', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: LAS-STD-01"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Fabricant / Fournisseur</label>
                        <input
                          type="text"
                          value={batch.manufacturerOrSupplier}
                          onChange={(e) => updateBatch(batch.id, 'manufacturerOrSupplier', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: Fournisseur Alpha"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 font-medium mb-1">Système de finition / Revêtement</label>
                        <input
                          type="text"
                          value={batch.coatingSystem}
                          onChange={(e) => updateBatch(batch.id, 'coatingSystem', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-medium"
                          placeholder="Ex: Lasure solvantée 3 couches"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Nombre de couches</label>
                        <input
                          type="number"
                          value={batch.coatCount}
                          onChange={(e) => updateBatch(batch.id, 'coatCount', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Méthode d'application</label>
                        <input
                          type="text"
                          value={batch.applicationMethod}
                          onChange={(e) => updateBatch(batch.id, 'applicationMethod', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: Pinceau, Pistolet..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Conditions d'application</label>
                        <input
                          type="text"
                          value={batch.applicationConditions}
                          onChange={(e) => updateBatch(batch.id, 'applicationConditions', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: 21°C, 55% HR"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Date d'application</label>
                        <input
                          type="date"
                          value={batch.applicationDate}
                          onChange={(e) => updateBatch(batch.id, 'applicationDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Temps de séchage / Stabilisation</label>
                        <input
                          type="text"
                          value={batch.dryingOrConditioningTime}
                          onChange={(e) => updateBatch(batch.id, 'dryingOrConditioningTime', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          placeholder="Ex: 7 jours à 20°C"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1 text-xs">Observations / Notes du lot</label>
                      <input
                        type="text"
                        value={batch.batchNotes}
                        onChange={(e) => updateBatch(batch.id, 'batchNotes', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                        placeholder="Remarques particulières..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 4 : Identification des panneaux (Référentiel Permanent) */}
          {/* ============================================================ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Référentiel Permanent des Éprouvettes ({totalPanelsCount} panneaux)</p>
                  <p>
                    Chaque éprouvette est identifiée de manière stable et pérenne. Ces identifiants restent constants tout au long des 13 étapes d'exposition.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {batches.map((batch, bIdx) => (
                  <div key={batch.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-blue-900">{batch.reference}</span>
                        <span className="text-xs text-slate-500">• {batch.coatingSystem}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {batch.panelCount} éprouvettes
                      </span>
                    </div>

                    {/* Grille des panneaux générés */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {Array.from({ length: batch.panelCount }).map((_, pIdx) => {
                        const pNum = pIdx + 1;
                        const label = `P0${pNum}`.slice(-3);
                        return (
                          <div
                            key={pIdx}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-blue-300 transition-colors"
                          >
                            <span className="text-xs font-mono font-bold text-slate-900">
                              {batch.reference}-{label}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Éprouvette #{pNum}</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ACTIVE
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 5 : Familles & Plan de mesure                           */}
          {/* ============================================================ */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Distinction normative rigoureuse (NF EN 927-6 vs Recommandation Labo)</p>
                  <p>
                    La Couleur L*a*b* et la Brillance 60° sont des exigences normatives strictes de la NF EN 927-6. La dureté Pendule Persoz est une recommandation du laboratoire.
                  </p>
                </div>
              </div>

              {/* Familles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'COLOR' as MeasurementFamilyId,
                    name: 'Colorimétrie CIELAB L*a*b*',
                    norme: 'NF EN 927-6 §6.3.2',
                    status: 'NORMATIVE_REQUIREMENT',
                    badge: 'Exigence Normative'
                  },
                  {
                    id: 'GLOSS' as MeasurementFamilyId,
                    name: 'Brillance Spéculaire 60°',
                    norme: 'NF EN 927-6 §6.3.3',
                    status: 'NORMATIVE_REQUIREMENT',
                    badge: 'Exigence Normative'
                  },
                  {
                    id: 'PERSOZ' as MeasurementFamilyId,
                    name: 'Dureté Pendule Persoz',
                    norme: 'ISO 1522 / NF EN 927-6',
                    status: 'LAB_RECOMMENDATION',
                    badge: 'Recommandation Laboratoire'
                  },
                  {
                    id: 'ADHESION' as MeasurementFamilyId,
                    name: 'Adhérence au Quadrillage',
                    norme: 'NF EN ISO 2409:2020',
                    status: 'NORMATIVE_REQUIREMENT',
                    badge: 'Méthode Qualitative'
                  },
                  {
                    id: 'OBSERVATIONS' as MeasurementFamilyId,
                    name: 'Observations Visuelles ISO',
                    norme: 'ISO 4628 (1 à 6) & ISO 2409',
                    status: 'NORMATIVE_REQUIREMENT',
                    badge: 'Exigence Normative'
                  }
                ].map((fam) => {
                  const isActive = activeFamilies.includes(fam.id);
                  return (
                    <div
                      key={fam.id}
                      onClick={() => toggleFamily(fam.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                          : 'border-slate-200 bg-white opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900">{fam.name}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            fam.status === 'NORMATIVE_REQUIREMENT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {fam.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">{fam.norme}</p>
                    </div>
                  );
                })}
              </div>

              {/* Configurations de mesure */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Configuration métrologique par grandeur
                </h4>

                {/* Couleur */}
                {activeFamilies.includes('COLOR') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Points de mesure Couleur L*a*b*</span>
                      <span className="text-xs text-slate-500 font-mono">Standard : 4 points / éprouvette</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-700">Nombre de points par éprouvette :</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={colorPoints}
                        onChange={(e) => setColorPoints(Number(e.target.value))}
                        className="w-20 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold"
                      />
                      {isColorAdapted && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Adaptation du protocole
                        </span>
                      )}
                    </div>
                    {isColorAdapted && (
                      <div>
                        <label className="block text-xs font-bold text-red-700 mb-1">
                          Justification obligatoire de l'écart métrologique *
                        </label>
                        <input
                          type="text"
                          value={colorJustification}
                          onChange={(e) => setColorJustification(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-red-300 rounded-lg bg-red-50/20"
                          placeholder="Motif technique de l'adaptation..."
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Brillance */}
                {activeFamilies.includes('GLOSS') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Séries de Brillance Spéculaire 60°</span>
                      <span className="text-xs text-slate-500 font-mono">Standard : 2 séries de 2 relevés (Sens du fil + Perpendiculaire)</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span>Séries :</span>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={glossSeriesCount}
                          onChange={(e) => setGlossSeriesCount(Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-bold"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Relevés par série :</span>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={glossReadingsPerSeries}
                          onChange={(e) => setGlossReadingsPerSeries(Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-bold"
                        />
                      </div>
                      {isGlossAdapted && (
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Adaptation du protocole
                        </span>
                      )}
                    </div>
                    {isGlossAdapted && (
                      <div>
                        <label className="block text-xs font-bold text-red-700 mb-1">
                          Justification obligatoire de l'écart métrologique *
                        </label>
                        <input
                          type="text"
                          value={glossJustification}
                          onChange={(e) => setGlossJustification(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-red-300 rounded-lg bg-red-50/20"
                          placeholder="Motif technique de l'adaptation..."
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Persoz */}
                {activeFamilies.includes('PERSOZ') && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Répétitions Dureté Persoz</span>
                      <span className="text-xs text-slate-500 font-mono">Standard Labo : 3 répétitions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-700">Nombre de répétitions par éprouvette :</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={persozReps}
                        onChange={(e) => setPersozReps(Number(e.target.value))}
                        className="w-20 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold"
                      />
                      {isPersozAdapted && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Adaptation Recommandation
                        </span>
                      )}
                    </div>
                    {isPersozAdapted && (
                      <div>
                        <label className="block text-xs font-bold text-red-700 mb-1">
                          Justification obligatoire de l'écart métrologique *
                        </label>
                        <input
                          type="text"
                          value={persozJustification}
                          onChange={(e) => setPersozJustification(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-red-300 rounded-lg bg-red-50/20"
                          placeholder="Motif de l'adaptation..."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 6 : Calendrier de l'essai & Plan de mesurage           */}
          {/* ============================================================ */}
          {step === 6 && (
            <div className="space-y-4">
              {/* En-tête explicatif & Statut du plan */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-slate-900">Calendrier d'Exposition UV & Plan de Mesurage (NF EN 927-6)</p>
                      <p className="mt-0.5 text-slate-700 leading-relaxed">
                        Définissez les moments où les mesures seront réellement réalisées. Les 12 cycles physiques d'exposition de 168 h (2016 h cumulées) restent présents indépendamment du plan de mesurage.
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    PLAN MODIFIABLE
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pl-8 italic">
                  Le plan sera automatiquement verrouillé (LOCKED) après la première acquisition scientifique saisie sur paillasse.
                </p>
              </div>

              {/* Règle spécifique ADHESION (si la famille est sélectionnée) */}
              {activeFamilies.includes('ADHESION') && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 flex items-center gap-2">
                      <span>RÈGLE SPÉCIFIQUE — ADHÉRENCE AU QUADRILLAGE (NF EN ISO 2409)</span>
                      <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">T0 + C12 uniquement</span>
                    </p>
                    <p className="mt-1 text-amber-900/90 text-[11px] leading-relaxed">
                      L'adhérence est un essai mécanique destructif réalisé exclusivement <strong>avant exposition (T0, 0 h)</strong> et au terme des 2016 h <strong>(C12, 2016 h)</strong>. Elle n'est jamais mesurée aux jalons intermédiaires C1 à C11, quel que soit le plan de mesurage sélectionné ci-dessous.
                    </p>
                  </div>
                </div>
              )}

              {/* Présélections rapides & Compteur */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 mr-1">Préréglages :</span>
                    <button
                      type="button"
                      onClick={() => setPlanPreset('FULL')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedMeasurementCycles.length === 13
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Standard Complet (13 jalons)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanPreset('QUARTERLY')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedMeasurementCycles.length === 5 && selectedMeasurementCycles.includes(3) && selectedMeasurementCycles.includes(6)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Jalons Clés / Trimestriels (5 jalons)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanPreset('LIGHT')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedMeasurementCycles.length === 3 && selectedMeasurementCycles.includes(6)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Protocole Allégé (3 jalons)
                    </button>
                    {selectedMeasurementCycles.length !== 13 &&
                      !(selectedMeasurementCycles.length === 5 && selectedMeasurementCycles.includes(3) && selectedMeasurementCycles.includes(6)) &&
                      !(selectedMeasurementCycles.length === 3 && selectedMeasurementCycles.includes(6)) && (
                        <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
                          Plan Personnalisé
                        </span>
                      )}
                  </div>

                  {/* Compteur de mesurage */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Jalons de mesurage :</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                      <strong className="text-blue-700">{selectedMeasurementCycles.length}</strong> / 13
                    </span>
                  </div>
                </div>

                {/* Résumé des mesures prévues */}
                <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-600">Mesures prévues :</span>
                    <div className="flex flex-wrap gap-1 font-mono font-bold text-xs">
                      {selectedMeasurementCycles.map((c) => (
                        <span
                          key={c}
                          className={`px-2 py-0.5 rounded border text-[11px] ${
                            c === 0
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : c === 12
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          {c === 0 ? 'T0' : `C${c}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {13 - selectedMeasurementCycles.length > 0 ? (
                      <span>
                        <strong>{13 - selectedMeasurementCycles.length}</strong> cycle(s) en <em>exposition continue seule</em> sans arrêt paillasse
                      </span>
                    ) : (
                      <span>Campagne de mesurage prévue à chaque cycle</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Grille des 13 cycles physiques d'exposition (sans scroll interne artificiel) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {[
                  { cycle: 0, hours: 0, label: 'T0 — MESURES INITIALES AVANT EXPOSITION', type: 'INITIAL' },
                  ...Array.from({ length: 11 }, (_, i) => ({
                    cycle: i + 1,
                    hours: (i + 1) * 168,
                    label: `C${i + 1} (${(i + 1) * 168} h) — MESURES EN COURS D'EXPOSITION`,
                    type: 'INTERMEDIATE'
                  })),
                  { cycle: 12, hours: 2016, label: 'C12 (2016 h) — MESURES FINALES APRÈS EXPOSITION', type: 'FINAL' }
                ].map((st) => {
                  const isMandatory = st.cycle === 0 || st.cycle === 12;
                  const isSelected = selectedMeasurementCycles.includes(st.cycle);

                  return (
                    <div
                      key={st.cycle}
                      onClick={() => !isMandatory && toggleCycleMeasurement(st.cycle)}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                        isMandatory
                          ? st.cycle === 0
                            ? 'border-blue-300 bg-blue-50/70 ring-1 ring-blue-400/30 cursor-default'
                            : 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-400/30 cursor-default'
                          : isSelected
                          ? 'border-blue-400 bg-blue-50/40 shadow-xs ring-1 ring-blue-400/20 cursor-pointer hover:border-blue-500'
                          : 'border-slate-200 bg-slate-50/90 hover:bg-slate-100/70 cursor-pointer hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                            st.cycle === 0
                              ? 'bg-blue-600 text-white'
                              : st.cycle === 12
                              ? 'bg-emerald-600 text-white'
                              : isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{st.cycle === 0 ? 'T0' : `C${st.cycle}`}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {st.cycle === 0 ? 'T0 (0 h)' : `C${st.cycle} — ${st.hours} h`}
                            </p>
                            {isMandatory && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-200 text-slate-800">
                                <Lock className="w-2.5 h-2.5" />
                                Obligatoire
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {st.cycle === 0 ? 'Mesures initiales' : st.cycle === 12 ? 'Mesures finales' : 'Étape intermédiaire'}
                          </p>
                        </div>
                      </div>

                      {/* Indicateur d'état mesurage vs exposition */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        {isMandatory ? (
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-500" />
                            Mesure obligatoire
                          </span>
                        ) : isSelected ? (
                          <span className="font-bold text-blue-700 flex items-center gap-1">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            Mesuré
                          </span>
                        ) : (
                          <span className="font-medium text-slate-500 flex items-center gap-1">
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            Exposition seule
                          </span>
                        )}

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isMandatory
                              ? 'bg-slate-200 text-slate-800'
                              : isSelected
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isMandatory ? 'Inviolable' : isSelected ? 'Campagne active' : 'Sans arrêt'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 7 : Récapitulatif et Validation                        */}
          {/* ============================================================ */}
          {step === 7 && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-950">Vérification finale avant création de l'essai</p>
                  <p>
                    L'essai sera initialisé avec le statut de configuration <strong>EDITABLE</strong>. Dès la première saisie scientifique sur paillasse, la configuration sera automatiquement verrouillée (<strong>LOCKED</strong>).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Identification */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b pb-1.5">
                    1. Identification
                  </h4>
                  <div className="space-y-1">
                    <p><span className="text-slate-500">Référence :</span> <strong className="font-mono">{reference}</strong></p>
                    <p><span className="text-slate-500">Titre :</span> {title || '—'}</p>
                    <p><span className="text-slate-500">Demandeur :</span> {projectOrClient || '—'}</p>
                    <p>
                      <span className="text-slate-500">Opérateur :</span>{' '}
                      {createdBy.trim() ? (
                        <strong className="text-slate-900">{createdBy.trim()}</strong>
                      ) : (
                        <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Non renseigné (bloquant pour la création)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Substrat commun */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b pb-1.5">
                    2. Caractéristiques Communes
                  </h4>
                  <div className="space-y-1">
                    <p><span className="text-slate-500">Support :</span> {substrateNature} — {materialType}</p>
                    <p><span className="text-slate-500">Dimensions :</span> {lengthMm}×{widthMm}×{thicknessMm} {dimUnit}</p>
                    <p><span className="text-slate-500">Fil :</span> {woodGrainOrientation}</p>
                  </div>
                </div>
              </div>

              {/* Lots & Panneaux */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                  <span>3. Lots & Référentiel ({batches.length} lots • {totalPanelsCount} éprouvettes)</span>
                  <span className="font-mono text-blue-700">Total : {totalPanelsCount} panneaux</span>
                </h4>
                <div className="space-y-2">
                  {batches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{b.reference}</span>
                        <span className="text-slate-500 ml-2">({b.coatingSystem})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-mono">
                        {b.panelCount} panneaux
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan de Mesure (Familles) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b pb-1.5">
                  4. Grandeurs & Caractérisations ({activeFamilies.length} familles actives)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeFamilies.map((f) => (
                    <div key={f} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 font-medium text-xs">
                      {f === 'COLOR' && `Couleur (${colorPoints} pts / face)`}
                      {f === 'GLOSS' && `Brillance (${glossSeriesCount}×${glossReadingsPerSeries} mes)`}
                      {f === 'PERSOZ' && `Persoz (${persozReps} reps)`}
                      {f === 'OBSERVATIONS' && 'Observations ISO'}
                      {f === 'ADHESION' && (
                        <div className="text-amber-900 font-semibold">
                          <span>Adhérence ISO 2409</span>
                          <span className="block text-[10px] text-amber-700 font-normal">T0 + C12 uniquement</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendrier & Plan de Mesurage */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                  <span>5. Calendrier & Plan de Mesurage ({selectedMeasurementCycles.length} jalons mesurés / 13)</span>
                  <span className="font-mono text-emerald-700 font-bold">2016 h cumulées (12 cycles)</span>
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 font-medium">Jalons mesurés prévus :</span>
                    <div className="flex flex-wrap gap-1 font-mono font-bold">
                      {selectedMeasurementCycles.map((c) => (
                        <span
                          key={c}
                          className={`px-2 py-0.5 rounded border text-[11px] ${
                            c === 0
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : c === 12
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          {c === 0 ? 'T0 (0 h)' : `C${c} (${c * 168} h)`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Les 12 cycles physiques d'exposition de 168 h sont maintenus dans le modèle. {13 - selectedMeasurementCycles.length > 0 ? `${13 - selectedMeasurementCycles.length} cycle(s) seront en exposition continue seule sans arrêt paillasse.` : 'Tous les cycles feront l\'objet d\'une campagne de caractérisation.'}
                  </p>
                  {activeFamilies.includes('ADHESION') && (
                    <div className="text-amber-900 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 text-[11px] flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Règle normative Adhérence (NF EN ISO 2409) :</strong> Mesurée exclusivement à T0 (0 h) et C12 (2016 h). Aucun essai d'adhérence aux jalons intermédiaires C1 à C11.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
            >
              Annuler
            </button>

            {step < 7 ? (
              <button
                onClick={() => {
                  if (step === 1 && !isStep1Valid) return;
                  if (step === 5 && !isStep5Valid) return;
                  setStep((step + 1) as any);
                }}
                disabled={(step === 1 && !isStep1Valid) || (step === 5 && !isStep5Valid)}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {!createdBy.trim() && (
                  <span className="text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    Créateur de l'essai obligatoire pour finaliser la création
                  </span>
                )}
                <button
                  id="btn-create-trial-final"
                  onClick={handleFinalCreate}
                  disabled={!createdBy.trim()}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Créer l'Essai et Ouvrir la Campagne
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Règle de validation du bouton final de création (GATE 53)
 * Vérifie que la création ne peut jamais aboutir si le créateur est absent ou constitué d'espaces blancs.
 */
export function isFinalCreateAllowed(step: number, createdBy: string): boolean {
  if (step === 7) {
    return Boolean(createdBy && createdBy.trim().length > 0);
  }
  return true;
}
