# SPEC — fix/tab01-mentions (LOW, base `develop`)

> Demande utilisateur : retirer mentions et champs (portée « champs aussi » validée).

## 1. Modifications (Developer, `Tab01Identification.tsx` + wizard)

- Supprimé : bloc disclaimer (titre + paragraphe traçabilité), `(Immuable)` du label référence,
  `/ Demandeur / Projet` (→ `Client`), champ Essence + libellé, grille Préparation/Conditionnement.
- États `materialType`/`preparationNotes`/`conditioningNotes` supprimés ; `handleSave` préserve
  les valeurs stockées (`trial.commonCharacteristics?.x || ''`) — aucune donnée effacée.
- Import `Info` retiré (inutilisé). Wizard : 3 valeurs par défaut vidées (`''`).
- Données existantes intactes (affichées ailleurs : rapport, synthèse, lots).

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle onglet 01.
