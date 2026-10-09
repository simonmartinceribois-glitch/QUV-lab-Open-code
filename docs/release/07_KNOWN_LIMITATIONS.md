# QUV-LAB v1.7.0 — LIMITATIONS CONNUES & CONDITIONS D'EXPLOITATION

## 1. Limitations Architecturales Documentées

| Limitation Identifiée | Nature & Impact | Classification | Mesure Opérationnelle Requise |
| :--- | :--- | :--- | :--- |
| **Persistance Locale Navigateur (`localStorage`)** | Le cache local peut être purgé par l'utilisateur ou par les politiques de sécurité du navigateur. | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Export JSON obligatoire après chaque jalon validé et dépôt sur serveur réseau. |
| **Absence d'Authentification Centralisée** | Pas de gestion de sessions utilisateurs distantes (comptes/mots de passe). | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Traçabilité assurée par la saisie obligatoire de l'opérateur dans les actions d'audit. |
| **Photographies dans IndexedDB** | Depuis v1.6.0, les photos sont stockées dans IndexedDB (hors quota `localStorage`) mais restent locales au navigateur et absentes de l'export JSON. | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Conserver les originaux haute résolution sur le serveur du laboratoire. |
| **Travail Multi-Onglets Simultané** | Deux onglets ouverts sur le même essai peuvent s'écraser mutuellement (*Last-Write-Wins*). | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Règle d'exploitation : Travailler sur un seul onglet actif par essai. |
| **Navigation Privée** | Les données locales sont détruites à la fermeture de la fenêtre privée. | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Interdiction formelle d'utiliser QUV-Lab en navigation privée. |
| **Export JSON sans bouton (v1.6.0, v1.7.0)** | L'export JSON n'était relié à aucun bouton : impossible de produire une sauvegarde rechargeable, donc d'utiliser l'import. | **CORRIGÉ SUR `develop`** (prochaine version) | Encadré « Sauvegarde de l'essai » (onglet 08) avec sauvegarde complète incluant les photographies. |
| **Copies de secours du stockage** | Les copies `__backup_` créées sur stockage illisible ne sont ni relues ni purgées automatiquement. | **ACCEPTABLE EN EXPLOITATION CONTRÔLÉE** | Récupération manuelle via les outils développeur ; interface de restauration à développer. |
