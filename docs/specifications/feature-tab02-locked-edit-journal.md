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
- Éprouvette exclue non modifiable ; exclusion motivée et ajout de lot conservent leur fenêtre
  (masqués pendant le mode modification).
- Affichage de référence : listes déroulantes **sans flèche** hors mode modification (la flèche
  n'apparaît qu'après « Modifier ») ; idem pour l'unité de l'onglet 01.

## Épaisseur sèche : règle de gel (révisée, `fix/thickness-freeze-and-select-arrows`)

Audit : l'épaisseur est le **prérequis** de l'adhérence — sans elle (ou > 250 µm) la saisie
d'adhérence est impossible ; elle fixe l'espacement du peigne ISO 2409 et est **recopiée** dans chaque
acquisition (`coatingThicknessMicrons`, `gridSpacingMm`). L'ancienne règle ne la figeait que si l'essai
était verrouillé **et** une adhérence mesurée : la modifier entre T0 et C12 aurait fait mesurer C12
avec un autre peigne que T0.

Règle : **figée définitivement dès qu'une mesure d'adhérence est enregistrée sur le lot** (en pratique
au T0), quel que soit le statut de l'essai ; **modifiable tant qu'aucune adhérence n'est enregistrée**.
Affichage « 55 µm 🔒 figée (adhérence enregistrée) ». Appliquée à l'interface et au store.
Tests : R-LOTS-05, R-LOTS-07.

## Traçabilité

`updateLotsAndSpecimens(trialId, form, operatorId)` : une entrée par valeur modifiée —
`MODIFY_BATCH` (entité BATCH) ou `MODIFY_PANEL` (entité PANEL), détails `field`, `label`, `target`
(« LOT A » / « LOT A-2 »), `before`, `after`. Refus global si une valeur est invalide.
Le journal affiche « LOT A-2 · Face d'exposition : avant → après » et propose les filtres dédiés.

## Tests

Suite 65 R-LOTS-01 → 07.
