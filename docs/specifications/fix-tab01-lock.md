# SPEC — fix/tab01-lock (LOW, base `develop`)

> Demande : bannière Configuration LOCKED/EDITABLE invisible en Tab01 (affichage seul).

## Modifications (`Tab01Identification.tsx` seul)

- Bloc bannière + `isLocked` + import `Lock` retirés (`CheckCircle2` conservé : succès de sauvegarde).

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel onglet 01.
