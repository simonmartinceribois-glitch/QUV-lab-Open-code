# SPEC — fix/wizard-step2-fields (LOW, base `develop`)

> Demande : étape 2 sans bannière ; `Nature du support` → `Nature du support / matériau
> de référence` ; champs Essence et Orientation du fil retirés (inutiles ici).

## Modifications (affichage seul)

- `WizardStep2Characteristics` : bannière + 2 champs retirés (états parents conservés :
  alimentent récapitulatif, lots par défaut et création — valeurs par défaut vides).
- Props/états nettoyés côté enfant ; parent inchangé hors retrait des props.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel étape 2 et récapitulatif.
