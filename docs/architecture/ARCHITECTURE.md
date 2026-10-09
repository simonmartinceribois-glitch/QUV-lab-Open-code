# QUV-Lab — ARCHITECTURE (v2, état `develop` post-PR #136 — 2026-09-24)

> Régénéré le 2026-09-24 (F06) : remplace la v1 (audit initial, pré-tickets).
> Source de vérité : origin GitHub `simonmartinceribois-glitch/QUV-lab-Open-code`, branche `develop`
> (PR #136 `feat/freeze-scientific-context` mergée — gel du contexte scientifique).
> Preuves : `tsc --strict` 0 erreur, `npm test` 1039/1039 (exécution réelle 2026-09-24),
> `vite build` OK (0 warning circulaire).

## 1. Vue d'ensemble

- **Stack** : React 19 + Vite 6 + TypeScript 5.8 (`strict:true`) + Tailwind 4.
- **Objet** : suivi d'essais de vieillissement accéléré UV selon NF EN 927-6 (Cycle A : T0 + 12 × 168 h = 2016 h).
- **Scripts** (`package.json`) : `dev` (port 3000), `build` (`tsc --noEmit && vite build`),
  `test` (`tsx run_tests.ts`, 1039 tests validés), `typecheck`/`lint` (`tsc --noEmit`), `clean` (cross-platform, `dist/` seul), `preview`.
- **Dépendances** : react, vite, tailwind, recharts, motion, lucide (+ `@types/*`).
  `express`/`dotenv`/`@google/genai` purgés (PR #8). 100 % local, sans backend ni clé API.
- Plus gros fichiers restants (mesures réelles 2026-09-24) : `UXTestsSuite.tsx` (1530 l, tests UI),
  `trialStoreService.ts` (1640 l), `trialSeed.ts` (1187 l), `CreateTrialWizardModal.tsx` (643 l).
  God files C8 tous découpés.

## 2. Architecture React (lazy par section depuis perf/lazy-sections)

```text
src/main.tsx → src/App.tsx — TRIALS eager, 3 sections + wizard en React.lazy (entrée 7,8 kB)
  TRIALS → TrialDashboard → TrialDetailView (9 onglets, 07 supprimé : PR #28)
    01 Identification / 02 Lots & Échantillons / 03 Protocole / 04 Calendrier /
    05 Étapes / 06 Mesures (bench/ : topbar, grille, calculs, 5 formulaires) /
    PHOTO Photothèque (phototheque/ : 7 vues, jalons actifs uniquement) /
    08 Résultats (7 sous-vues) / 09 Journal d'audit
  UX_TESTS → UXTestsSuite.tsx (tests UI, dynamique)
  SCIENTIFIC_TESTS → ScientificTestsViewer.tsx (tests scientifiques, dynamique)
  RULESET → ScientificRuleSetView.tsx
  Wizard → CreateTrialWizardModal.tsx + wizard/ (10 fichiers :
    WizardStep1..7 + wizardSteps.ts + wizardTypes.ts + measurementApplicability.ts ;
    04 masquée : flux 01-02-03-05-06-07)
```

- État : `useState` local + singleton `globalTrialStore` (façade `services/trialStore.ts`).
- Pas de routeur, pas de librairie d'état externe, pas de backend.

## 3. Services (façade, depuis refactor/split-trialstore)

```text
services/trialStore.ts (façade, 12 l — API stable à 8 symboles, point d'import unique)
  ├── trialIds.ts — generateUUID
  ├── trialIntegrity.ts — IntegrityViolationError + gardes Gate 3.1
  ├── trialStages.ts — generateStandardExposureStages (T0 + 12×168 h)
  ├── trialSeed.ts — createDemoTrial + createValidationTrial + seed
  └── trialStoreService.ts — TrialStoreService (persistance localStorage, CRUD, photos, rapports)
services/reportGenerator.ts + exportService.ts (inchangés)
```

Cycle historique `reportGenerator ↔ trialStore` cassé (`reportGenerator` → `trialIds`).

## 4. Modèle de données

- `src/types/trial.ts` : `Trial { metadata, commonCharacteristics, status, configurationStatus,
  config, scheduleConfig, stages[], batches[], acquisitions{}, auditTrail[], mediaReferences[], reports?, scientificContext? }`.
- Lots → 4 `PanelDefinition` (T + E1/E2/E3). `INACTIVE` = cycle conservé, exclu du plan.
- `WoodGrainOrientation` / `ExposureFace` : listes contrôlées strictes (plus de `| string`) ;
  wizard : whitelist à la frontière (`CreateTrialWizardModal`, fix/scripts-typing).
- `src/types/scientific.ts` (5 niveaux), `src/types/analysis.ts` (6 niveaux, `NON_EVALUEE` par défaut).

## 5. Moteurs scientifiques & gel du contexte (ScientificContext)

Couleur CIE 1976 (6.3.2), Brillance 2×2 60° + rétention (6.3.3/ISO 2813), Persoz (ISO 1522),
Adhérence 0-5 + délai 168 h (ISO 2409:2020), Observations (ISO 4628) ; socle `statistics.ts`
(n-1 par défaut), `validity.ts` (SUSPECT conservé), `recalculator.ts` (RAW→COMPUTED, réf T0),
`ruleSet.ts` (origines NORMATIVE/LAB/METRO/ADAPTATION). Règles : ADHESION T0+C12,
`getActiveStages` (INACTIVE exclu, aussi appliqué à photothèque/chronologie/matrice/modal),
T exclu des moyennes.

### 5.1 Contexte scientifique gelé (PR #136)

- `ScientificContextStatus = 'FROZEN' | 'NOT_FROZEN'` (statut écrit dans le Trial).
- État dérivé de validation (`trialStoreService.ts`) : `NOT_FROZEN` (contexte absent) |
  `FROZEN` (contexte complet et cohérent) | `INVALID` (contexte incohérent — jamais écrit,
  état fail-closed : aucune réparation, aucune conversion).
- Snapshot **par valeur** : `scientificRuleSetSnapshot` copié au gel (jamais de référence live
  vers le RuleSet courant) ; le RuleSet live n'est plus utilisé pour le calcul d'un essai
  dont le contexte scientifique est gelé.
- Déclencheur : première acquisition (`frozenTrigger: 'FIRST_ACQUISITION'`) ; traçabilité
  `frozenAt` / `frozenBy` / version du référentiel gelé.
- Résolution fail-closed : `resolveScientificRuleSetForTrial` utilise **uniquement le snapshot**
  quand le contexte est `FROZEN` ; contexte `INVALID` → `IntegrityViolationError` (arrêt) ;
  pas de fallback silencieux, pas de reconfiguration de 2016 h.
- **Essais legacy (verrouillés avant le gel)** : un essai `configurationStatus === 'LOCKED'`
  créé avant l'introduction de `scientificContext` conserve `scientificContext === undefined`
  et reste donc dans l'état `NOT_FROZEN`. Aucune migration automatique ni injection
  rétroactive de snapshot n'est effectuée : une acquisition ultérieure peut utiliser le
  RuleSet live. Ces essais ne bénéficient pas de la garantie de reproductibilité par snapshot
  propre aux essais `FROZEN`. Comportement assumé et couvert par le test G34-CONTEXT-07.
- Constante protocolaire : **2016 h = 12 × 168 h**, non paramétrable (pas de réglage utilisateur).
- Adaptations de protocole (traçabilité) : `standardRecommendedCount` (référence norme) vs
  `configuredCount` (adaptation justifiée) + `configuredBy` / `configuredAt` / `ruleSource` /
  `configuredReason` — jamais de hardcode silencieux ; toute adaptation reste documentée.

### 5.2 Dates

- Dates civiles : représentation locale (`toLocaleDateString('en-CA')` dans `dateUtils.ts`) —
  **jamais** `toISOString().slice(0, 10)` pour une date civile.
- Instants techniques : timestamps complets pour la traçabilité d'audit.

## 6. Persistance, exports

- `localStorage` clé `quv_lab_trials_v2_2` (choix assumé, `07_KNOWN_LIMITATIONS.md`) ;
  seed démo + validation ; photos démo SVG vs consigne prod serveur.
- **Atomicité mémoire ↔ persistance : non garantie (risque connu et accepté).**
  `saveTrial` met à jour l'état mémoire *avant* l'écriture dans le stockage : en cas d'échec
  d'écriture, l'état mémoire conserve la modification alors que le stockage conserve l'état
  antérieur. L'échec est détecté et signalé (`persistenceHealthy`, `StorageErrorEvent`), ce qui
  ne constitue pas une atomicité transactionnelle. Aucun rollback automatique n'est mis en œuvre ;
  la visibilité de l'erreur côté utilisateur dépend de la couche UI.
- Exports : Blob texte/JSON + `window.print()` (pas de CSV/XLSX/PDF réel).

## 7. Tests & CI

- `run_tests.ts` : **1039 tests validés** (exécution réelle `npm test` 2026-09-24,
  sortie « 🎉 TOUS LES TESTS SONT AU VERT ! Total : 1039 tests validés »).
  Suites de test déclarées : `suite1..suite59` + `suite10b` (décompte par suite non recopié).
- CI (`.github/workflows/ci.yml`) : `npm ci` + `tsc` + `npm test` + `vite build`, branches
  `main/develop/*`, protections PR + checks sur `main` et `develop`.
- Labels UI dynamiques (suites de tests UI pour vues UX/scientifiques).
  `test-results.txt` sorti du versionnement (la CI fait foi).

## 8. Build (chunks, sans cycle depuis fix N1)

Entrée ~8 kB ; vendors (react, charts…) et applicatif lazy par section
(`quv-tabs`, `quv-shell`, `quv-results`, `quv-services`, `quv-science`, `quv-photo`,
`quv-wizard`, `quv-bench`, `quv-tests`) ; max ~312 kB, 0 warning circulaire (règle :
couches basses services/science dédiées, suites de tests isolées — voir audit N1).

## 9. Cible atteinte (mise à jour)

GitHub source de vérité + `main` (releases taguées) / `develop` (intégration) + CI stricte +
`docs/` versionnées + workflow multi-agents (`docs/agents/`) : **en place et éprouvé (PR #2→#23)**.
Restes connus : formulaires Tab06 extraits (save au parent — retypage `computed as any` ouvert),
lazy d'onglets, vérifs visuelles humaines par ticket UI.
