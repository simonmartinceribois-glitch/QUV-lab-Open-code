# SPEC — fix/storage-overwrite-csv-escaping (HIGH, base `develop`)

> Origine : audit de `develop` du 2026-10-09 (`e26a9f9`). Risque HIGH : persistance + exports.

## 1. Perte de données après lecture corrompue du stockage

**Constat (reproduit)** : si `quv_lab_trials_v2_2` est illisible (JSON corrompu, objet au lieu
d'un tableau, ou essai individuel invalide), le store charge la démo en mémoire « sans écrire »,
mais la **première écriture** (ex. `logViewResults`, simple consultation des résultats, ou la
migration média au démarrage) remplace le contenu d'origine par la démo.

**Correctif** (`trialStoreService.ts`) :
- Le chargement n'écrit toujours **jamais** (contrat IR-35/36/37/48/56 conservé).
- Anomalie de lecture → copie de secours **programmée** ; `saveToStorage()` écrit le contenu brut
  intégral sous `quv_lab_trials_v2_2__backup_<horodatage>` **avant** la première écriture.
  - Copie réussie → écritures normales autorisées, rien n'est perdu (`STORAGE_LOAD_RECOVERED` + `backupKey`).
  - Copie impossible, ou `getItem` en échec → **écritures bloquées** (`STORAGE_WRITE_BLOCKED`),
    notifiées à chaque tentative ; `isPersistenceHealthy()` = false.
- `getStorageLoadIssue()` : l'anomalie survient dans le constructeur, avant tout abonnement ;
  `App.tsx` l'utilise comme état initial du bandeau d'alerte existant.

## 2. Exports CSV non échappés

**Constat** : `exportReportToCsv` / `exportRawDataToCsv` interpolaient les valeurs telles quelles :
`"`, `;` ou retour ligne saisis → colonnes décalées ; texte commençant par `= + - @` → formule
exécutée par le tableur. Pas de BOM → accents corrompus dans Excel.

**Correctif** :
- `src/services/csvUtils.ts` : `csvValue` (valeurs produites par l'application : guillemets doublés)
  et `csvUserText` (texte saisi : guillemets doublés + apostrophe devant `= + - @ tab CR`,
  sauf nombres signés). Mode `auto` pour les champs historiquement non entourés.
- Aucune neutralisation des valeurs calculées (« -3.2 GU » reste intact).
- Sortie **strictement identique** à l'ancien format pour toute valeur sans caractère spécial.
- `downloadTextFile` ajoute le BOM UTF-8 aux fichiers `text/csv` (contenu généré inchangé).

## 3. Dépendances

`npm audit fix` : `source-map-js` (GHSA-68fv-2mgg-jv7q, high) — lockfile uniquement.

## Tests

- Suite 55 étendue : R-STORAGE-09 → 14 (JSON corrompu, copie impossible, format inattendu,
  essai illisible, lecture impossible, stockage sain).
- Nouvelle suite 60 : R-CSV-01 → 06 (format historique, échappement, neutralisation,
  CSV RAW et rapport relus par un parseur RFC 4180).

## Limites

- Les copies de secours ne sont ni relues ni purgées automatiquement ; leur restauration se fait
  manuellement (outils développeur du navigateur). Une interface de restauration est un ticket distinct.
- En mode bloqué, l'application reste consultable mais aucune modification n'est enregistrée.
