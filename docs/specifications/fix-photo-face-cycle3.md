# SPEC — fix/photo-face-cycle3 (LOW, base `develop`)

> Demandes utilisateur : 1. supprimer le champ 4 « Face photographiée » du modal
> (décision « Supprimer », non stocké en modèle) ; 2. supprimer le doublon « Cycle 3 »
> (badge `C3 (504 h)` déjà présent).

## 1. Modifications (affichage seul)

- `PhotoAddModal.tsx` : bloc select face + props retirés.
- `TabPhotographs.tsx` : état `newPhotoFace` + légendes auto sans face.
- `ResultsGlobalView.tsx` : `Cycle ${i}` → `Cycle intermédiaire` (T0/Finale inchangés).

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle (modal, cartes chrono).
