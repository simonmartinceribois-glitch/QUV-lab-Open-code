# SPEC — fix/dashboard-lock (LOW, base `develop`)

> Demande : badge Verrouillé/Modifiable invisible sur les cartes d'essais (affichage seul).

## Modifications (`TrialDashboard.tsx` seul)

- Badge retiré + `isLocked` + 4 imports d'icônes devenus inutiles. Badge statut essai conservé.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel accueil.
