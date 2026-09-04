# SPEC — fix/global-card-line (LOW, base `develop`)

> Demande : carte chrono — `Finale` (sans 1er « 2016 h ») + nature et heures sur la même ligne.

## Modifications (`ResultsGlobalView.tsx` seul, affichage)

- Nature : `2016 h Finale` → `Finale` ; heures inline `· X h` (masquées si 0) ; ligne nom supprimée.
- Rendu : `C12` + `Finale · 2016 h` ; `C3` + `Cycle intermédiaire · 504 h` ; `T0` + `T0 Initiale`.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel.
