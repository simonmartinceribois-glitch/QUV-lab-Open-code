# AUDIT — feature/trial-import (2026-10-09)

> Vérifié : `typecheck` 0 erreur, `npm test` **1061/1061** (1053 + 8 R-IMPORT), `build` OK.

## Données

- Aller-retour export JSON → import : essai identique au contenu exporté, hors entrée d'audit
  `IMPORT_TRIAL` et `updatedAt`. Seule normalisation constatée : `reports` absent → `[]`, déjà
  appliquée par `saveTrial()` / `getTrial()` à tout essai (pas une perte).
- Aucun chemin n'écrase un essai existant (R-IMPORT-03 : essai existant octet pour octet inchangé).
- Tous les refus surviennent avant l'écriture (store vide après refus, R-IMPORT-04/05/06).

## Interface (vérifiée dans le navigateur, serveur de dev)

- Bouton « Importer un essai » affiché à côté de « Nouvel Essai QUV ».
- Fenêtre : avertissement photos, sélection du fichier, opérateur ; « Importer » désactivé tant que
  fichier et opérateur ne sont pas fournis.
- Le clic final n'a pas été rejoué dans le navigateur (session partagée avec l'utilisateur) :
  le chemin d'import est couvert par R-IMPORT-01 → 08 sur le même service.

## Verdict : conforme → PR vers `develop`.
