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

## 4. Addendum chronologie (demande de rationalisation)

- Nouveau helper `formatStageTitle()` : `504 h — MESURES…` → `C3 — MESURES…`
  (T0/C12 gérés : préfixe existant conservé, heures retirées du doublon).
- Timeline : badge = repère seul (`C3`), titre via `formatStageTitle`,
  sous-libellé `Cycle intermédiaire 504h` / `Final (terme essai) 2016h` (T0 inchangé).
  Chaque info (repère, heures, nature) apparaît une seule fois. Vérifié par exécution
  (`tsx` : T0/C3/C12 conformes).
