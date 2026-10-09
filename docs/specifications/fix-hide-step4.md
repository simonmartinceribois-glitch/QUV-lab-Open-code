# SPEC — fix/hide-step4 (LOW, base `develop`)

> Demande : étape 04 Panneaux invisible (masquée, non supprimée).

## Modifications (`CreateTrialWizardModal.tsx` seul)

- `stepsList` sans 04 ; `goNextStep` (03→05) / `goPrevStep` (05→03) ; bloc de rendu 04
  et import retirés. `WizardStep4Panels.tsx` conservé (réactivation possible).
- Validations 1/3/5 et création inchangées.

## Tests

`typecheck` (0), `npm test` (195/195), `build` OK + visuel (flux 01-02-03-05-06-07).
