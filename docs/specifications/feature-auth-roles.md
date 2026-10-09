# SPEC — Profils, connexion et droits par rôle (évolution future)

> Demande utilisateur (2026-10-09) : à terme, connexion par profil **Prénom + Nom + rôle**.
> Préparer le processus et les fichiers **sans coder l'ensemble des fonctionnalités**.
> Statut : **phase 0 livrée (fondation inactive)** — aucun changement de comportement.

## 1. Rôles

| Rôle | Intention | Droits |
|---|---|---|
| **Utilisateur** | Consultation seule | Aucune modification ; consultation des onglets 01 → 08 |
| **Technicien** | Travail courant de laboratoire | Actions de criticité **LOW** et **STANDARD** ; onglets 01 → 08 |
| **Responsable** | Pilotage et qualité | **Toutes** les actions ; tous les onglets (dont 09 Journal de bord) |

« Visuel de 1 à 8 » = onglets 01 Identification → 08 Résultats & Fiches, Photothèque (07) comprise.

## 2. Criticité des actions

Distincte des niveaux de risque de développement (LOW / MEDIUM / HIGH de `WORKFLOW.md`).

| Criticité | Définition | Utilisateur | Technicien | Responsable |
|---|---|:-:|:-:|:-:|
| READ | Consultation, sans effet sur les données | ✅ | ✅ | ✅ |
| LOW | Action mineure, réversible ou documentaire | ❌ | ✅ | ✅ |
| STANDARD | Saisie et modification courantes, tracées | ❌ | ✅ | ✅ |
| HIGH | Décision scientifique ou qualité, structurante ou irréversible | ❌ | ❌ | ✅ |

## 3. Matrice des actions (source de vérité : `src/services/permissions.ts`)

| Action | Criticité | Méthode du store | Codes du journal |
|---|---|---|---|
| Consulter les résultats | READ | `logViewResults` | VIEW_RESULTS |
| Commenter un rapport | LOW | `addReportReviewComment` | ADD_REPORT_COMMENT |
| Ajouter / remplacer une photographie | LOW | `attachPhoto` | ATTACH_PHOTO, REPLACE_PHOTO |
| Exporter (PDF, CSV, JSON, sauvegarde complète) | LOW | `logReportExport` | EXPORT_* |
| Créer un essai | STANDARD | `createTrial` | CREATE_TRIAL, CONFIGURE_PROTOCOL |
| Modifier l'identification (onglet 01) | STANDARD | `updateTrialIdentification` | MODIFY_IDENTIFICATION |
| Modifier la date effective du T0 | STANDARD | `updateT0EffectiveDate` | UPDATE_T0_EFFECTIVE_DATE |
| Ajouter un lot | STANDARD | *(dans l'onglet 02 — dette, voir §6)* | CREATE_BATCH |
| Modifier lots et éprouvettes (onglet 02) | STANDARD | `updateLotsAndSpecimens` | MODIFY_BATCH, MODIFY_PANEL |
| Saisir des mesures | STANDARD | `recordAcquisition` | RECORD_ACQUISITION, UPDATE_ACQUISITION, LOCK_TRIAL_CONFIGURATION |
| Générer un rapport | STANDARD | `generateScientificReportForTrial` | GENERATE_REPORT, REGENERATE_REPORT |
| Valider une étape | HIGH | `validateStage` | VALIDATE_STAGE |
| Exclure une éprouvette | HIGH | `excludePanel` | EXCLUDE_PANEL |
| Adapter le protocole de mesure | HIGH | `adaptProtocolConfig` | MODIFY_MEASUREMENT_CONFIG(URATION) |
| Modifier le plan de mesure | HIGH | `updateMeasurementPlan` | UPDATE_MEASUREMENT_PLAN |
| Activer / désactiver une étape | HIGH | `toggleStageStatus` | DEACTIVATE_STAGE, REACTIVATE_STAGE |
| Supprimer une photographie | HIGH | `deletePhoto` | DELETE_PHOTO |
| Changer le statut d'un rapport | HIGH | `updateReportStatus` | REVIEW_REPORT, APPROVE_REPORT |
| Importer un essai | HIGH | `importTrialFromExport` | IMPORT_TRIAL |
| Réinitialiser les essais de démonstration | HIGH | `resetToDemo` | — |

Sections de la barre principale : « Essais » et « Normes » pour tous ; « Tests UX » et « Tests Calculs »
réservées au Responsable.

## 4. Processus de développement (à appliquer dès maintenant)

1. **Toute nouvelle action qui modifie un essai** est déclarée dans `ACTION_CATALOG` avec sa criticité,
   sa méthode du store et ses codes de journal, **dans la même PR**.
2. La suite **R-AUTH** (suite 66) l'impose automatiquement : elle échoue si un code `action` écrit dans
   le code ou une méthode publique du store modifiant un essai n'est pas classé (R-AUTH-05 / 06).
3. Une modification de la matrice (criticité, rôle, onglet) est une décision : entrée dans
   `docs/decisions/DECISIONS.md` + mise à jour du tableau §3.
4. Les écritures passent par une **méthode dédiée du store** (jamais `saveTrial` depuis l'interface),
   pour que la phase 1 n'ait qu'un point de contrôle par action.

## 5. Fichiers de la fondation (phase 0, inactifs)

| Fichier | Rôle |
|---|---|
| `src/types/auth.ts` | `Role`, `Criticity`, `UserProfile` (Prénom, Nom, rôle, actif), identifiants d'onglets et sections |
| `src/services/permissions.ts` | Catalogue des actions, matrice rôle → criticités / onglets / sections, `canPerform`, `canViewTab`, `canViewSection`, `formatOperatorLabel` |
| `src/services/session.ts` | Point d'accroche : `AUTH_ENABLED = false`, `getCurrentUser` / `setCurrentUser`, `isAllowed`, `isTabVisible` (tout autorisé tant que désactivé) |
| `src/scientific/tests/auth_roles_foundation.test.ts` | Suite 66 R-AUTH-01 → 08 (matrice + garde-fous de classement) |

## 6. Feuille de route

**Phase 0 — Fondation (livrée).** Modèle, matrice, garde-fous, aucun effet sur l'application.

**Phase 1 — Profils locaux et application des droits** (application toujours 100 % locale) :
- Écran de sélection de profil au démarrage ; gestion des profils (création, désactivation) réservée au
  Responsable ; profils stockés localement ; premier lancement → création du premier Responsable.
- Boutons masqués ou désactivés via `isAllowed(action)` ; onglets filtrés via `isTabVisible(tab)`.
- **Contrôle aussi dans le store** : chaque méthode classée vérifie `isAllowed` et lève
  `IntegrityViolationError` sinon (l'interface ne suffit jamais).
- Le champ libre « Opérateur » des boîtes de validation est remplacé par le profil connecté
  (`formatOperatorLabel` → « Prénom NOM (Rôle) ») ; entrée de journal `LOGIN` / `LOGOUT`.
- Dette à solder avant : déplacer l'ajout de lot (`CREATE_BATCH`, écrit directement dans l'onglet 02)
  dans une méthode du store ; rendre `saveTrial` non publique pour l'interface.

**Phase 2 — Authentification réelle** : nécessite un **serveur** (ou annuaire de l'entreprise).
Dans une application 100 % navigateur, un mot de passe ou un rôle stocké localement **n'est pas une
barrière de sécurité** : toute personne ayant accès au poste peut modifier le stockage du navigateur.
La phase 1 apporte la **traçabilité nominative et la prévention des erreurs**, pas une protection
contre un acte volontaire. La phase 2 (identité vérifiée, données centralisées, journal infalsifiable
côté serveur) est un projet d'architecture à part entière.

## 7. Questions ouvertes (à trancher avant la phase 1)

1. L'**Utilisateur** voit-il aussi **09 Journal de bord** ? (défaut retenu : non, comme le Technicien.)
2. Les **exports** (PDF, CSV, sauvegarde) sont-ils permis à l'Utilisateur ? (défaut : non, LOW = Technicien+.)
3. **Valider une étape** : HIGH (défaut) ou STANDARD pour le Technicien ?
4. **Créer un essai** : Technicien autorisé (défaut STANDARD) ou Responsable seul ?
5. Faut-il une **double validation** (Technicien saisit, Responsable approuve) pour certaines actions HIGH ?
6. Profils **partagés entre postes** (nécessite la phase 2) ou propres à chaque poste ?
