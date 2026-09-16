import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { getDefaultScientificRuleSet } from './scientific/ruleSet';
import { globalTrialStore } from './services/trialStore';
import { mediaStorage } from './services/mediaStorageService';
import { runMediaMigration } from './services/mediaMigrationService';
import { Trial } from './types/trial';
import { TrialDashboard } from './components/TrialDashboard';
import { TrialDetailView } from './components/TrialDetailView';
import type { StorageErrorEvent } from './services/trialStore';

// perf/lazy-sections : sections secondaires chargées à la demande (TRIALS reste eager).
const CreateTrialWizardModal = lazy(() =>
  import('./components/CreateTrialWizardModal').then((m) => ({ default: m.CreateTrialWizardModal }))
);
const UXTestsSuite = lazy(() =>
  import('./components/UXTestsSuite').then((m) => ({ default: m.UXTestsSuite }))
);
const ScientificRuleSetView = lazy(() =>
  import('./components/ScientificRuleSetView').then((m) => ({ default: m.ScientificRuleSetView }))
);
const ScientificTestsViewer = lazy(() =>
  import('./components/ScientificTestsViewer').then((m) => ({ default: m.ScientificTestsViewer }))
);

function SectionFallback() {
  return (
    <div className="p-12 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl">
      Chargement de la section…
    </div>
  );
}
import {
  FlaskConical,
  BookOpen,
  CheckCircle2,
  Layers,
  ShieldCheck,
  LayoutDashboard,
  CheckSquare,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<
    'TRIALS' | 'UX_TESTS' | 'RULESET' | 'SCIENTIFIC_TESTS'
  >('TRIALS');

  const [trials, setTrials] = useState<Trial[]>(() => globalTrialStore.getAllTrials());
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [activeTrialTab, setActiveTrialTab] = useState<string>('06');
  const [showCreateWizard, setShowCreateWizard] = useState<boolean>(false);

  // État d'initialisation de la migration média (Base64 → IndexedDB)
  const [mediaMigration, setMediaMigration] = useState<'idle' | 'migrating' | 'success' | 'failed' | 'interrupted'>('idle');
  const [mediaMigrationSummary, setMediaMigrationSummary] = useState<{ migrated: number; remainingLegacy: number } | null>(null);
  const migrationStartedRef = useRef(false);
  const [storageWarning, setStorageWarning] = useState<StorageErrorEvent | null>(null);

  // Remonte à l'opérateur tout échec d'écriture des métadonnées localStorage
  // (résiduel depuis la migration IndexedDB des photos, PR #111) au lieu de le
  // laisser passer inaperçu.
  useEffect(() => {
    const unsubscribe = globalTrialStore.onStorageError((event) => {
      setStorageWarning(event);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (migrationStartedRef.current) return;
    migrationStartedRef.current = true;

    setMediaMigration('migrating');
    runMediaMigration({
      backend: mediaStorage,
      trials: globalTrialStore.getAllTrials(),
      saveTrial: (t) => globalTrialStore.saveTrial(t)
    })
      .then((summary) => {
        setMediaMigrationSummary({ migrated: summary.migrated, remainingLegacy: summary.remainingLegacy });
        setMediaMigration(summary.remainingLegacy > 0 ? 'interrupted' : 'success');
        refreshTrials();
      })
      .catch(() => {
        setMediaMigration('failed');
      });
  }, []);

  const ruleSet = getDefaultScientificRuleSet();

  const refreshTrials = () => {
    setTrials([...globalTrialStore.getAllTrials()]);
  };

  const currentTrial = selectedTrialId ? globalTrialStore.getTrial(selectedTrialId) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight">QUV-Lab</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  NF EN 927-6
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  v1.2.0 • PROMPT 6
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Suivi d'Essais UV, Mesures de Paillasse & Traçabilité Métrologique
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 overflow-x-auto">
            <button
              onClick={() => {
                setActiveSection('TRIALS');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeSection === 'TRIALS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Essais QUV
            </button>

            <button
              onClick={() => setActiveSection('UX_TESTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeSection === 'UX_TESTS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
              Tests UX (64)
            </button>

            <button
              onClick={() => setActiveSection('SCIENTIFIC_TESTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeSection === 'SCIENTIFIC_TESTS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Tests Calculs (44)
            </button>

            <button
              onClick={() => setActiveSection('RULESET')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeSection === 'RULESET'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Normes
            </button>
          </div>
        </div>

        {/* Bandeau d'initialisation de la migration média (Base64 → IndexedDB) */}
        {mediaMigration !== 'idle' && mediaMigration !== 'success' && (
          <div
            className={`px-4 py-1.5 text-[11px] font-semibold flex items-center gap-2 border-t ${
              mediaMigration === 'failed'
                ? 'bg-rose-900/60 text-rose-100 border-rose-700'
                : 'bg-blue-900/60 text-blue-100 border-blue-700'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            {mediaMigration === 'migrating' ? (
              <span>Initialisation de la photothèque : migration des clichés vers IndexedDB…</span>
            ) : mediaMigration === 'interrupted' ? (
              <span>
                Migration média partielle ({mediaMigrationSummary?.migrated ?? 0} clichés migrés,{' '}
                {(mediaMigrationSummary?.remainingLegacy ?? 0)} encore non migrés). Redémarrez
                l'application pour reprendre la migration de façon idempotente.
              </span>
            ) : (
              <span>Échec de l'initialisation de la migration média. Les clichés legacy restent non migrés.</span>
            )}
          </div>
        )}

        {/* Bandeau d'alerte : échec d'écriture des métadonnées localStorage */}
        {storageWarning && (
          <div className="px-4 py-1.5 text-[11px] font-semibold flex items-center justify-between gap-2 border-t bg-rose-900/60 text-rose-100 border-rose-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{storageWarning.message}</span>
            </div>
            <button
              onClick={() => setStorageWarning(null)}
              className="text-rose-100/80 hover:text-white text-[11px] font-semibold underline underline-offset-2 shrink-0"
            >
              Masquer
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeSection === 'TRIALS' && (
          <div>
            {!selectedTrialId || !currentTrial ? (
              <TrialDashboard
                trials={trials}
                onSelectTrial={(id) => {
                  setSelectedTrialId(id);
                  setActiveTrialTab('06');
                }}
                onOpenCreateWizard={() => setShowCreateWizard(true)}
              />
            ) : (
              <TrialDetailView
                trial={currentTrial}
                ruleSet={ruleSet}
                activeTab={activeTrialTab}
                onSelectTab={setActiveTrialTab}
                onBackToDashboard={() => setSelectedTrialId(null)}
                onTrialUpdated={refreshTrials}
              />
            )}
          </div>
        )}

        {activeSection === 'UX_TESTS' && (
          <Suspense fallback={<SectionFallback />}>
            <UXTestsSuite
              trial={currentTrial || trials[0]}
              ruleSet={ruleSet}
              onSelectTab={(tabId) => {
                setSelectedTrialId(trials[0]?.id || null);
                setActiveTrialTab(tabId);
                setActiveSection('TRIALS');
              }}
            />
          </Suspense>
        )}

        {activeSection === 'SCIENTIFIC_TESTS' && (
          <Suspense fallback={<SectionFallback />}>
            <ScientificTestsViewer />
          </Suspense>
        )}

        {activeSection === 'RULESET' && (
          <Suspense fallback={<SectionFallback />}>
            <ScientificRuleSetView ruleSet={ruleSet} />
          </Suspense>
        )}
      </main>

      {/* Wizard Modal */}
      {showCreateWizard && (
        <Suspense fallback={<SectionFallback />}>
          <CreateTrialWizardModal
            onClose={() => setShowCreateWizard(false)}
            onCreated={(newId) => {
              refreshTrials();
              setSelectedTrialId(newId);
              setActiveTrialTab('01');
            }}
          />
        </Suspense>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        QUV-Lab • Architecture 5 Niveaux • Découplage RAW / Validité / Qualité / Protocole / Normatif • NF EN 927-6
      </footer>
    </div>
  );
}

