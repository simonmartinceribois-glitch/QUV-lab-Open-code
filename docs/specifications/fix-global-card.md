# SPEC — fix/global-card (LOW, base `develop`)

> Demande : carte chronologie globale — badge `C3 (504 h)` + nom `504 h — MESURES…` :
> retirer `(504 h)` du badge et `MESURES EN COURS D'EXPOSITION` du nom.

## Modifications (`ResultsGlobalView.tsx` seul, affichage)

- Badge : `formatStageShort` → `cycleTag` (`C3`).
- Ligne nom : `{stage.name}` → `{stage.scheduledExposureHours} h` (donnée, pas de chirurgie
  de chaîne ; chaque info — repère, nature, heures — une seule fois).

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle cartes chrono.
