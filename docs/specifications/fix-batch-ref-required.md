# SPEC — fix/batch-ref-required (LOW, base `develop`)

> Demande : référence lot obligatoire et en majuscules (étape 3).

## Modifications

- `WizardStep3Batches` : saisie forcée en majuscules + bordure d'erreur si vide.
- `CreateTrialWizardModal` : `isStep3Valid` (tous lots renseignés) bloque Suivant (garde + disabled).

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel (minuscules converties, Suivant bloqué si vide).
