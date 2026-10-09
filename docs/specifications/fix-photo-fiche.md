# SPEC — fix/photo-fiche (LOW, base `develop`)

> Demande : retirer de la fiche échantillon (Photothèque > Chronologie) la ligne
> « essence • produit • épaisseur film sec » (affichage seul, données conservées).

## Modifications (`PhotoTimelineView.tsx` seul)

- Paragraphe descriptif supprimé ; titre (référence + Témoin/Exposé) conservé.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle.
