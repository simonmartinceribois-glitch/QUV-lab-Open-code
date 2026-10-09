# QUV-LAB v1.6.0 — POLITIQUE DE SAUVEGARDE & RESTAURATION

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
Onglet **08 Résultats & Fiches → 8. Rapport Scientifique & Exports** : bouton d'export **JSON** (`DOSSIER_SCIENTIFIQUE_<REF>.json` :
essai sans binaires, RuleSet, rapport actif, évaluations complémentaires) et exports **RAW CSV** / **REPORT CSV**.
Les photographies (IndexedDB) ne sont pas incluses dans le JSON : conserver les originaux sur le serveur.

## 4. Restauration
**Aucune fonction d'import n'existe dans l'application (v1.6.0).** Le fichier JSON est une archive de
traçabilité, pas un point de restauration rechargeable. Voir `07_KNOWN_LIMITATIONS.md`.

## 5. Copies de secours automatiques (v1.6.0)
Si le stockage local est illisible au démarrage, son contenu brut est copié tel quel sous la clé
`quv_lab_trials_v2_2__backup_<horodatage>` avant toute écriture (bandeau d'alerte affiché). Si la copie
est impossible, l'application n'enregistre plus rien. Ces copies ne sont ni relues ni purgées
automatiquement : leur récupération se fait par les outils développeur du navigateur (Application → Local Storage).
