# SPEC — feature/full-backup-with-photos (HIGH, base `develop`)

> Origine : limitation « Photographies hors sauvegarde JSON » (v1.7.0) et constat du 2026-10-09 :
> **le handler `handleExportJson` n'a jamais eu de bouton** (depuis le commit initial) — l'export
> JSON, et donc l'import publié en v1.7.0, n'étaient pas utilisables depuis l'interface.

## 1. Boutons d'export (correctif)

Onglet 08 → « 8. Rapport Scientifique & Exports » → nouvel encadré **« Sauvegarde de l'essai »**,
visible **même sans rapport généré** :
- **Dossier JSON** : `DOSSIER_SCIENTIFIQUE_<REF>.json` (handler existant, sans binaire, inchangé).
- **Sauvegarde complète (avec photos)** : `SAUVEGARDE_COMPLETE_<REF>.json`.

## 2. Format de sauvegarde complète (`fullBackupService.ts`)

`{ format: 'QUV-LAB-FULL-BACKUP', formatVersion: 1, exportedAt, trial, media[], missingMediaKeys[], ruleSet, activeReport, criteriaEvaluation }`
- `media[]` : `{ storageKey, mimeType, sizeBytes, dataBase64 }` pour chaque clé référencée par
  `trial.mediaReferences` présente dans IndexedDB ; les absentes sont listées dans `missingMediaKeys`.
- Aucune dépendance ajoutée (pas de ZIP) ; base64 par blocs de 32 ko.
- Export tracé : `FULL_BACKUP_JSON` → action `EXPORT_FULL_BACKUP`.

## 3. Restauration

L'import existant (`importTrialFromExport`, fail-closed, jamais d'écrasement) importe d'abord l'essai ;
si le fichier est une sauvegarde complète, `restoreFullBackupMedia` écrit ensuite les photos :
- uniquement les clés référencées par l'essai importé (aucune clé arbitraire) ;
- **jamais d'écrasement** d'un média déjà présent ;
- une entrée invalide est comptée en échec sans bloquer les autres ; en cas d'échec partiel, la
  fenêtre reste ouverte et affiche le bilan (restaurées / déjà présentes / en échec).

## Tests

Suite 63 R-BACKUP-01 → 05 : contenu de la sauvegarde, aller-retour octet pour octet (dont un média
de 70 ko, > 1 bloc d'encodage), non-écrasement, clés intruses et entrées incomplètes, dossier
scientifique toujours sans binaire.
