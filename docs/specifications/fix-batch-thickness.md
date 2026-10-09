# SPEC — fix/batch-thickness (MEDIUM, base `develop`)

> Bug : sur essai verrouillé (`LOCKED`), l'épaisseur sèche du lot n'est plus saisissable
> (`Tab02LotsPanels.tsx:382`) ; si elle est manquante (« Non renseignée »), aucune issue
> et l'adhérence reste bloquée. Cause : verrou binaire sans distinction.

## 1. Règle (Developer, `Tab02LotsPanels.tsx` uniquement)

- `hasAdhesionData(batchId)` = existe une acquisition `ADHESION` avec `raw` pour ce lot
  (tous jalons). L'épaisseur ne sert normativement qu'au quadrillage → sans adhérence
  mesurée, la modifier est sans effet sur les résultats.
- Affichage par lot :
  - non verrouillé : inchangé (input actuel) ;
  - verrouillé + `hasAdhesionData` : lecture seule + message explicite
    « Verrouillée — adhérence déjà mesurée » ;
  - verrouillé + sans adhérence : **input identique au mode éditable** + mention
    « Saisie tardive (essai verrouillé) ».
- `handleUpdateBatchThickness` : pousse un événement d'audit (`UPDATE_BATCH_THICKNESS`,
  `entityType: 'BATCH'`, ancienne/nouvelle valeurs, opérateur) avant `saveTrial`.

## 2. Hors périmètre

Modèle, store, moteurs, recalculs (l'épaisseur est une donnée descriptive ; le recalcul
d'adhérence utilise déjà la valeur courante à la saisie suivante).

## 3. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle (lot sans adhérence
verrouillé : input OK + audit ; lot avec adhérence : message de blocage).
