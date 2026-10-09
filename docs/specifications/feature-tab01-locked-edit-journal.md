# SPEC — feature/tab01-locked-edit-journal (MEDIUM, base `develop`)

> Demande utilisateur (2026-10-09) : les informations d'identification sont saisies à la création de
> l'essai ; dans l'essai, elles ne doivent plus être modifiables directement. Modification uniquement
> via « Modifier » (Oui / Non) puis « Valider les modifications » (Oui / Non), chaque modification
> tracée (date, action, valeur) dans l'onglet 09, renommé « Journal de bord ».

## Constat avant correctif

L'onglet 01 était éditable en permanence et « Enregistrer les Modifications » écrasait les valeurs
**sans aucune entrée dans le journal**.

## Comportement

- **Lecture seule par défaut** (champs non éditables ; référence et créateur restent toujours figés).
- **Modifier** → boîte « Modifier » Oui / Non → mode modification (bandeau d'avertissement).
- **Annuler** → retour aux valeurs enregistrées, rien n'est écrit.
- **Valider les modifications** → contrôle de saisie, puis boîte « Valider les modifications » :
  tableau Champ / Avant / Après + **opérateur obligatoire** (« Oui » désactivé sinon) → Oui / Non.
  Aucune différence → message « Aucune modification à valider », rien n'est écrit.
- Champs modifiables : N° Commande, N° Rapport, Intitulé, Client, Notes générales, Longueur, Largeur,
  Épaisseur, Unité, Nature du support. Dimensions : nombre > 0 (virgule acceptée), effacement refusé.

## Traçabilité

`TrialStoreService.updateTrialIdentification(trialId, form, operatorId)` : une entrée
`MODIFY_IDENTIFICATION` **par champ modifié** (`field`, `label`, `before`, `after`, opérateur,
horodatage commun). Le calcul des différences (`trialIdentification.ts`) est partagé entre le
récapitulatif affiché et l'enregistrement : ce qui est montré est exactement ce qui est tracé.

## Onglet 09

Libellé **« 09 Journal de bord »** ; les entrées `MODIFY_IDENTIFICATION` s'affichent
« Champ : avant → après » ; filtre dédié.

## Tests

Suite 64 R-IDENT-01 → 06 : aucune différence, traçabilité par champ et champs préservés,
opérateur obligatoire, saisies invalides, normalisation numérique, essai sans dimensions.
