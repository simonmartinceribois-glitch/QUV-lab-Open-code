# AUDIT — feature/full-backup-with-photos (2026-10-09)

> Vérifié : `typecheck` 0 erreur, `npm test` **1066/1066** (1061 + 5 R-BACKUP), `build` OK.

## Constat corrigé

`handleExportJson` est présent depuis le commit initial (`e44914c`) mais n'a jamais été relié à un
bouton (`git grep` sur `e44914c`, `v1.5.0`, `v1.6.0` : une seule occurrence, la définition). La
documentation v1.6.0 / v1.7.0 (`06_BACKUP_RESTORE.md`) décrivait donc un bouton inexistant, et
l'import v1.7.0 n'avait pas de fichier source productible depuis l'interface.

## Vérification dans le navigateur (serveur de dev, onglet séparé)

- Onglet 08 → 8. Rapport Scientifique & Exports : encadré « Sauvegarde de l'essai » et ses deux
  boutons affichés sans rapport généré.
- Chaîne réelle exécutée dans la page, en lecture seule sur le stockage du navigateur :
  IndexedDB → `buildFullBackup` → sérialisation JSON → `restoreFullBackupMedia` vers un stockage
  en mémoire. DEMO-APP-001 : 4/4 photos (192 ko) ; QUV-2026-VAL-01 : 5/5 photos (248 ko) ;
  0 échec. Les boutons n'ont pas été cliqués (pas de téléchargement déclenché).

## Verdict : conforme → PR vers `develop`, puis publication corrective v1.7.1.
