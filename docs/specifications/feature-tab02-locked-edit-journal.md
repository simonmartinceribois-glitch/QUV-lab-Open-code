# SPEC — feature/tab02-locked-edit-journal (MEDIUM, base `develop`)

> Demande utilisateur (2026-10-09) : « idem pour 02 Lots & Échantillons » — même parcours que
> l'onglet 01 (`feature-tab01-locked-edit-journal.md`).

## Constat avant correctif

- Épaisseur sèche : enregistrée **à chaque frappe** (une entrée `UPDATE_BATCH_THICKNESS` par chiffre saisi).
- Orientation du fil / face d'exposition : enregistrées dès la sélection, **sans aucune trace**.

## Comportement

- Lecture seule par défaut (sélecteurs désactivés, épaisseur non éditable).
- **Modifier** (Oui / Non) → mode modification → **Valider les modifications** → récapitulatif
  Élément / Champ / Avant / Après + opérateur obligatoire (Oui / Non). **Annuler** rétablit tout.
- Champs : épaisseur sèche (lot, 1 à 1000 µm, effaçable), orientation du fil (éprouvette),
  face d'exposition (éprouvettes exposées ; le témoin n'en a pas).
- Inchangés : règle d'épaisseur figée (essai verrouillé + adhérence mesurée sur le lot) — désormais
  aussi appliquée côté store ; éprouvette exclue non modifiable ; exclusion motivée et ajout de lot
  conservent leur fenêtre (masqués pendant le mode modification).

## Traçabilité

`updateLotsAndSpecimens(trialId, form, operatorId)` : une entrée par valeur modifiée —
`MODIFY_BATCH` (entité BATCH) ou `MODIFY_PANEL` (entité PANEL), détails `field`, `label`, `target`
(« LOT A » / « LOT A-2 »), `before`, `after`. Refus global si une valeur est invalide.
Le journal affiche « LOT A-2 · Face d'exposition : avant → après » et propose les filtres dédiés.

## Tests

Suite 65 R-LOTS-01 → 06.
