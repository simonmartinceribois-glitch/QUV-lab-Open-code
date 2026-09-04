# SPEC — fix/stageoption-dedup (LOW, base `develop`)

> Demande : `T0 · T0 — …` dans le modal Nouveau Cliché + audit global du motif.
> Audit : 8 sites `tag ·/— nom` dupliquaient T0 (nom T0 porte déjà son repère).

## 1. Modifications (affichage seul)

- `panelUtils.ts` : helper `formatStageOption()` — nom tel quel s'il commence par le tag,
  sinon `TAG · nom` ; tolérant `null`.
- Appliqué aux 8 sites (modals, selects galerie/comparateurs, lightbox, tableaux, Tab05).
  Badges `cycleTag` seuls et titres `formatStageTitle` : déjà dédupliqués, inchangés.

## 2. Tests

`typecheck` (0 — a d'ailleurs attrapé 3 imports), `npm test` (195/195), `build` OK + visuel.
