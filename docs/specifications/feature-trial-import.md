# SPEC — feature/trial-import (HIGH, base `develop`)

> Origine : limitation « À TRAITER » de la v1.6.0 (`07_KNOWN_LIMITATIONS.md`) — aucune fonction ne
> rechargeait un export JSON : une purge du navigateur n'était pas récupérable depuis l'interface.
> Risque HIGH : persistance.

## Comportement

- Tableau de bord → bouton **« Importer un essai »** → fichier `DOSSIER_SCIENTIFIQUE_*.json`
  (export de l'onglet 08) + **opérateur obligatoire** → l'essai importé s'ouvre (onglet 01).
- Formats acceptés : l'enveloppe d'export `{ trial, ruleSet, activeReport, criteriaEvaluation }`
  ou un objet Trial brut. Seul `trial` est importé (le RuleSet de l'essai voyage dans son
  contexte scientifique gelé ; le rapport est déjà dans `trial.reports`).

## Contrat (`TrialStoreService.importTrialFromExport`) — FAIL-CLOSED

Refus par `IntegrityViolationError`, **avant toute modification du store**, si :
- opérateur vide ;
- structure invalide (`isStructurallyValidTrial`, le validateur du chargement) ;
- `metadata.reference` absente, ou `auditTrail` / `reports` / `mediaReferences` non-listes
  (le tableau de bord planterait) ;
- identifiant `MOCK_TEST_*` ;
- **identifiant déjà présent : jamais d'écrasement** ;
- contexte scientifique gelé `INVALID` (aucune réparation) ;
- échec de `migrateTrialTerminology`.

Sinon : copie profonde, migration terminologique (idempotente), entrée d'audit `IMPORT_TRIAL`
(opérateur, nom du fichier, nombre de références média), `saveTrial()` — qui respecte le blocage
d'écriture introduit en #139.

## Hors périmètre

- Photographies : les Blobs IndexedDB ne sont pas dans le JSON ; les références sont conservées
  et s'affichent « introuvables » (`PhotoStorageImage`) si le média est absent du poste.
- ~~Import « en copie »~~ : ajouté par `feature/import-as-copy` (voir ci-dessous).

## Import en copie (`feature/import-as-copy`)

Sur doublon d'identifiant, l'erreur porte `details.reason = 'DUPLICATE_TRIAL_ID'` et la fenêtre propose
**« Importer comme copie »** (`importTrialFromExport(..., { asCopy: true })`) :
- nouvel identifiant ; tout champ `trialId` / `entityId` **valant** l'ancien identifiant est réécrit, à toute
  profondeur (lots, jalons, acquisitions, médias, rapports, audit) ; contrôle structurel rejoué ensuite ;
- référence suffixée `-COPIE` (`-COPIE-2`, … si déjà prise) ;
- identifiants internes (lots, éprouvettes, jalons, acquisitions, clés média) conservés : ils sont propres à
  chaque essai, même s'ils contiennent l'ancien identifiant comme sous-chaîne (essais de démonstration) ;
- l'essai d'origine n'est jamais modifié ; l'entrée `IMPORT_TRIAL` trace `importedAsCopyOf`.

Tests : R-IMPORT-09 → 11.

## Tests

Suite 62 R-IMPORT-01 → 08 : aller-retour export → import fidèle, traçabilité, refus doublon
(essai existant inchangé), 6 contenus non reconnus, opérateur vide, contexte gelé invalide,
MOCK_TEST_ / Trial brut, copie profonde.
