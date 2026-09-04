# QUV-Lab — ARCHITECTURE (audit initial 2026-09-04)

> Source auditée : `quv-lab-main/` (copie ZIP, sans `.git`). Aucun fichier applicatif modifié.
> Références : `src/App.tsx`, `src/types/{trial,scientific,analysis}.ts`, `src/services/trialStore.ts`,
> `src/scientific/*`, `src/components/*`, `run_tests.ts`, `docs/release/`.

## 1. Vue d'ensemble

- **Stack** : React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4 (`package.json:14-26`).
- **Objet** : suivi d'essais de vieillissement accéléré UV selon NF EN 927-6 (Cycle A : T0 + 12 × 168 h = 2016 h).
- **Taille** : `src/` ~1,27 Mo. Plus gros fichiers : `services/trialStore.ts` (2226 l),
  `components/trial-tabs/TabPhotographs.tsx` (1488 l), `components/CreateTrialWizardModal.tsx` (1464 l),
  `components/trial-tabs/Tab06MeasurementsBench.tsx` (1246 l).
- **Scripts** (`package.json:6-13`) : `dev`, `build` (vite seul, sans `tsc`), `test` (`tsx run_tests.ts`),
  `lint` (= `tsc --noEmit`, pas d'ESLint), `clean` (`rm -rf`, casse sous Windows), `preview`.

## 2. Architecture React

```text
src/main.tsx → src/App.tsx (5 sections)
  TRIALS → TrialDashboard → TrialDetailView (10 onglets)
    01 Identification / 02 Lots & Éprouvettes / 03 Protocole / 04 Calendrier /
    05 Étapes / 06 Paillasse-Saisie / PHOTO Photothèque /
    07 Contrôle Qualité / 08 Résultats (7 sous-vues) / 09 Journal d'audit
  UX_TESTS → UXTestsSuite.tsx
  SCIENTIFIC_TESTS → ScientificTestsViewer.tsx (1 suite sur 12 seulement)
  SANDBOX → ScientificCalculatorSandbox.tsx
  RULESET → ScientificRuleSetView.tsx
```

- État : `useState` local (`App.tsx:24-31`, `TrialDetailView.tsx:51-52`) + singleton
  `globalTrialStore` (`services/trialStore.ts:1253`, `Map` mémoire).
- Pas de routeur, pas de librairie d'état externe, pas de backend (voir §5).

## 3. Modèle de données

- `src/types/trial.ts:265-282` : `Trial { metadata, commonCharacteristics, status,
  configurationStatus, config, scheduleConfig, stages[], batches[], acquisitions{},
  auditTrail[], mediaReferences[], reports? }`.
- Lots : `BatchDefinition` → exactement 4 `PanelDefinition` (T témoin + E1/E2/E3 exposées).
- Étapes : T0 (`INITIAL_PRE_EXPOSURE`) + 12 cycles 168 h (`generateStandardExposureStages`,
  `trialStore.ts:163-215`), statut `INACTIVE` = cycle physique conservé mais exclu du plan de mesurage.
- `src/types/scientific.ts` : 5 niveaux indépendants (validité lecture / qualité relevé /
  conformité protocole / conclusion normative), alertes `MeasurementAlert`, `QualityAssessment`,
  `ScientificReport` (sections + 6 annexes + review).
- `src/types/analysis.ts` : hiérarchie d'information en 6 niveaux, anomalies factuelles,
  tendances, comparaisons multi-systèmes, synthèse — conclusion normative `NON_EVALUEE` par défaut.
- Point faible typage : `WoodGrainOrientation` (`trial.ts:43-56`) et `ExposureFace` (`trial.ts:61-70`)
  se terminent par `| string` → unions littérales neutralisées. `tsconfig.json` sans `strict`,
  sans `noUnusedLocals`.

## 4. Moteurs scientifiques (purs, versionnés 1.2.0)

| Famille | Fichier | Référence |
|---|---|---|
| Couleur ΔE (CIE 1976, 4 pts) | `scientific/colorEngine.ts:25` | NF EN 927-6 cl. 6.3.2 |
| Brillance 2×2 60° + rétention | `scientific/glossEngine.ts:25` | NF EN 927-6 cl. 6.3.3 / ISO 2813 |
| Persoz (3 répétitions) | `scientific/persozEngine.ts:26` | ISO 1522 / procédure labo |
| Adhérence quadrillage 0-5 + délai 168 h | `scientific/adhesionEngine.ts:18-19` | NF EN ISO 2409:2020 |
| Observations visuelles | `scientific/observationsEngine.ts:17` | ISO 4628 |
| Socle | `statistics.ts` (moyenne, écart-type échantillon n-1 par défaut, CV, gardes NaN/Inf), `validity.ts` (RAW SUSPECT conservé, jamais détruit), `protocolEngine.ts`, `qualityEngine.ts`, `aggregations.ts`, `recalculator.ts:32-54` (pipeline RAW→COMPUTED, réf T0, snapshot d'immuabilité), `auditEngine.ts`, `ruleSet.ts:23-33` (référentiel découplé, origines NORMATIVE/LAB/METRO/ADAPTATION) |
| Analyse | `scientific/analysis/` (AnalysisEngine, AnomalyDetector, TrendAnalyzer, MultiSystemComparator, TechnicalSynthesisGenerator) |

Règles canoniques : `panelUtils.ts:95-112` (ADHESION = T0 + C12 uniquement, destructif),
`panelUtils.ts:65-67` (`getActiveStages` exclut INACTIVE), témoin T exclu des moyennes.

## 5. Persistance, exports, AI

- Persistance : `localStorage` clé `quv_lab_trials_v2_2` (`trialStore.ts:1352-1382`), blob JSON,
  seed démo + essai de validation si vide (`trialStore.ts:1370-1376`), migration terminologie,
  filtre anti-mock, store éphémère isolé pour tests (`trialStore.ts:1269`).
  Limitations assumées (`docs/release/07_KNOWN_LIMITATIONS.md`) : purge navigateur, quota ~5 Mo,
  last-write-wins multi-onglets, navigation privée interdite, pas d'auth.
- Photos démo = SVG data-URI (`trialStore.ts:704-705`) vs consigne prod (serveur labo + indexation).
- Exports : `exportService.ts` (Blob texte/JSON + `window.print()` ; pas de CSV/XLSX/PDF réel).
- Dépendances `express`, `dotenv`, `@google/genai` présentes au `package.json` mais **0 usage dans `src/`**
  (résidu probable AI Studio — à élaguer après confirmation).

## 6. Tests

- `run_tests.ts` : 12 suites maison via `tsx`, **193 tests** (44+7+30+12+6+20+9+12+12+18+8+15).
- `test-results.txt` : suite générale 44/44 OK, puis **Gate 2.2 : 4/7 — 3 échecs (A2, A3, B2)** :
  ségrégation témoin T dans `extractTemporalKinetics` / `MultiSystemComparator`, réactivation de jalon.
- `docs/release/08_RELEASE_MANIFEST.json:11-16` affirme 151/151 à 100 % (GATE 5.2) → **contredit**,
  manifest obsolète. UI `App.tsx:91-104` affiche "Tests UX (20)" / "Tests Calculs (22)" → obsolète vs 193 réels.

## 7. Architecture cible (écarts)

Cible : GitHub source de vérité + `main/develop/feature|fix|refactor|audit/*` + CI
(`tsc --noEmit` + `tsx run_tests.ts` + `vite build`) + `docs/{architecture,agents,specifications,audits,decisions,tests}`.
Écarts : pas de `.git`/CI ; docs limitées à `docs/release/` ; 3 tests rouges ; manifest à régénérer ;
god files à découper ; dépendances mortes ; scripts/typage à durcir.
