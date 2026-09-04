# SPEC — fix/results-active-stages (MEDIUM, base `develop`)

> Demande utilisateur : photothèque déjà alignée (PR #16) → aligner les résultats :
> 1. renommer l'onglet `06 Paillasse / Saisie` en `06 Mesures` ;
> 2. chronologie globale : seuls les jalons du plan ;
> 3. sélecteurs comparaison temporelle : seuls les jalons actifs ;
> 4. évolution chronologique calculée par éprouvette : seuls les jalons actifs.

## 1. Modifications (Developer)

- `TrialDetailView.tsx:60` : label → `'06 Mesures'` (seule occurrence du libellé avec FamilyAnalysis/Advanced déjà conformes via `getActiveStages`).
- `ResultsGlobalView` : cartes chronologie (L192) + colonnes tableau (L320/355) sur
  `getActiveStages(trial.stages)` ; `colSpan` (L334) aligné ; titre « 13 Étapes » →
  dynamique sur le nombre de jalons affichés. Compteurs L44-50 (stats essai) inchangés.
- `ResultsTemporalComparisonView` : options des 2 selects (L107/125) sur jalons actifs ;
  repli d'affichage si la sélection courante est hors plan (état inchangé).
- `ResultsPanelAnalysisView` L244 : ajouter `stage.status !== 'INACTIVE'` au filtre existant.
  Bloc RAW L404 : **inchangé** (traçabilité brute ; aucun raw ne peut naître sur INACTIVE via Tab06).

## 2. Hors périmètre

Modèle, store, calculs, normatif, compteurs globaux, galerie (filtre), comparateur multi-systèmes.

## 3. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle humaine (plan restreint :
chrono/tableau/comparateurs = jalons actifs uniquement).
