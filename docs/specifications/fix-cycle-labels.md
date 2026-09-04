# SPEC — fix/cycle-labels (LOW, base `develop`)

> Demande : toute information de cycle affiche son repère (T0 / C1…C12) avant les heures.
> Moyen : helpers `cycleTag()` / `formatStageShort()` dans `panelUtils.ts` (source unique),
> appliqués aux ~27 sites d'affichage (jamais aux logs de tests ni aux formules).

## 1. Helpers (`panelUtils.ts`, purs)

- `cycleTag(stage)` → `'T0'` si `cycleIndex === 0`, sinon `'C{i}'`.
- `formatStageShort(stage)` → `'T0 (0 h)'` / `'C{i} ({scheduledExposureHours} h)'`.

## 2. Règle d'application (affichage seul)

- Heures nues (`{h} h`, badges, en-têtes, lightbox, phrases) → `formatStageShort`.
- `nom + (heures)` → `cycleTag — nom`, heures redondantes retirées.
- Exclus : formule `N × 168 h = X h` (Tab05:258, calcul explicite), logs de tests (UXTestsSuite:142).

## 3. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle (C3 (504 h) partout).
