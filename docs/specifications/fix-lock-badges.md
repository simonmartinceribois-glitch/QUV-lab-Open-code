# SPEC — fix/lock-badges (LOW, base `develop`)

> Demande : les mentions de verrouillage n'ont pas d'utilité visible. Retrait d'affichage
> uniquement — le mécanisme LOCKED (store, gardes, audit) est intégralement conservé.

## 1. Modifications (affichage seul)

- `TrialDetailView` : badge Config Verrouillée/Modifiable retiré (+ `isLocked`, imports d'icônes).
- `Tab03Protocol` : badge Protocole VERROUILLÉ/MODIFIABLE retiré (+ import `Lock`).
- `Tab04Calendar` : badge Plan Verrouillé/Modifiable retiré (+ imports `Lock`/`Unlock`).
- `Tab02LotsPanels` : `Référentiel verrouillé…` → rien si verrouillé (bouton si éditable).
- `Tab05Stages` : badge `Norme Obligatoire` retiré.
- `PhotoModeSwitcher` : sous-titre transversal retiré (titre + badge norme conservés).
- Conservés : Tab01 (hors périmètre demandé), TrialDashboard, logique `isLocked` partout.

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel.
