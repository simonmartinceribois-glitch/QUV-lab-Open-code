# SPEC — fix/wizard-step6-texts (LOW, base `develop`)

> Demande : étape 6 sans badge PLAN MODIFIABLE ni § verrouillage ni encadré adhérence ;
> header wizard sans sous-titre ; `Trimestriels` → `3 semaines`.

## Modifications (affichage seul)

- `WizardStep6Calendar` : badge + paragraphe + encadré retirés (fermeture restaurée, tsc) ;
  preset renommé ; import `ShieldAlert` nettoyé.
- `CreateTrialWizardModal` : sous-titre header retiré.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel étape 6.
