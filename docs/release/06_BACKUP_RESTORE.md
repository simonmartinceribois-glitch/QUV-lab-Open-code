# QUV-LAB v1.8.0 — POLITIQUE DE SAUVEGARDE & RESTAURATION

## 1. Principe de Persistance à 3 Niveaux
```text
localStorage du Navigateur ──► Métadonnées des essais (persistance de travail)
IndexedDB du Navigateur    ──► Photographies (depuis v1.6.0)
Export JSON externe        ──► Sauvegarde de sécurité après chaque jalon
Serveur Réseau Sécurisé    ──► Archivage réglementaire définitif
```

## 2. Structure d'Archivage sur Serveur Laboratoire
```text
/SERVEUR_LABORATOIRE/QUV_ARCHIVES/
    └── 2026/
        └── ESSAI_[REF]/
            ├── 01_JSON/         (Sauvegardes jalons et archive finale)
            ├── 02_RAW_CSV/      (Données brutes de paillasse pour auditabilité)
            ├── 03_REPORT_CSV/   (Matrice des résultats calculés)
            ├── 04_RAPPORT_PDF/  (Rapports normatifs signés)
            ├── 05_PHOTOTHEQUE/  (Fichiers originaux haute résolution)
            └── 06_AUDIT/        (Exports du journal d'audit)
```

## 3. Export de sauvegarde
Onglet **08 Résultats & Fiches → 8. Rapport Scientifique & Exports**, encadré **« Sauvegarde de l'essai »**
(disponible même sans rapport généré) :
- **Sauvegarde complète (avec photos)** → `SAUVEGARDE_COMPLETE_<REF>.json` : essai complet + photographies.
  **Format recommandé** pour la sauvegarde après chaque jalon.
- **Dossier JSON** → `DOSSIER_SCIENTIFIQUE_<REF>.json` : essai sans photographies (archive scientifique légère).
- Exports **RAW CSV** / **REPORT CSV** : disponibles une fois un rapport généré.

> Ces boutons existent depuis la v1.8.0. En v1.6.0 et v1.7.0, aucun bouton n'exposait l'export JSON (le code
> existait sans être relié à l'interface) : ces versions ne permettent pas de produire ces fichiers.

## 4. Restauration
Tableau de bord → **« Importer un essai »** → choisir la sauvegarde et saisir l'opérateur.
- L'essai est restauré à l'identique (données RAW, calculs, rapports, journal d'audit), import tracé (`IMPORT_TRIAL`).
- Sauvegarde complète : les photographies sont restaurées ; une photo déjà présente n'est jamais remplacée.
- Un essai déjà présent n'est jamais écrasé : l'import est refusé, avec la possibilité de l'**importer comme copie**
  (nouvel identifiant, référence suffixée `-COPIE`).

## 5. Copies de secours automatiques (v1.6.0)
Si le stockage local est illisible au démarrage, son contenu brut est copié tel quel sous la clé
`quv_lab_trials_v2_2__backup_<horodatage>` avant toute écriture (bandeau d'alerte affiché). Si la copie
est impossible, l'application n'enregistre plus rien. Ces copies ne sont ni relues ni purgées
automatiquement : leur récupération se fait par les outils développeur du navigateur (Application → Local Storage).
