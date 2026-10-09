# SPEC — Profils, connexion et droits par rôle (évolution future)

> Demande utilisateur (2026-10-09) : à terme, connexion par profil **Prénom + Nom + rôle**,
> identification par **adresse e-mail + mot de passe**, **une personne = un compte = un rôle** (D-12).
> Préparer le processus et les fichiers **sans coder l'ensemble des fonctionnalités**.
> Statut : **phase 0 livrée (fondation inactive)** — aucun changement de comportement.
> **D-13 : l'application sera sur serveur** — la phase 1 « profils locaux » est abandonnée ; les droits
> seront contrôlés par le serveur. Cible d'architecture : `../architecture/SERVER_TARGET.md`.

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
| Valider une étape *(D-12)* | STANDARD | `validateStage` | VALIDATE_STAGE |
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
| `src/types/auth.ts` | `Role`, `Criticity`, `UserProfile` (e-mail, Prénom, Nom, rôle unique, actif — jamais de mot de passe), identifiants d'onglets et sections |
| `src/services/permissions.ts` | Catalogue des actions, matrice rôle → criticités / onglets / sections, `canPerform`, `canViewTab`, `canViewSection`, `formatOperatorLabel`, `validateUserProfile` (e-mail unique) |
| `src/services/session.ts` | Point d'accroche : `AUTH_ENABLED = false`, `getCurrentUser` / `setCurrentUser`, `isAllowed`, `isTabVisible` (tout autorisé tant que désactivé) |
| `src/scientific/tests/auth_roles_foundation.test.ts` | Suite 66 R-AUTH-01 → 10 (matrice, garde-fous de classement, règles de compte) |

## 6. Feuille de route

**Phase 0 — Fondation (livrée).** Modèle, matrice, garde-fous, aucun effet sur l'application.

**~~Phase 1 — Profils locaux~~ (abandonnée par D-13)** — conservée pour mémoire ; les éléments utiles
(masquage des boutons, opérateur issu de la session, dette CREATE_BATCH) sont repris dans la phase 2 :
- Écran de sélection de profil au démarrage ; gestion des profils (création, désactivation) réservée au
  Responsable ; profils stockés localement ; premier lancement → création du premier Responsable.
- Boutons masqués ou désactivés via `isAllowed(action)` ; onglets filtrés via `isTabVisible(tab)`.
- **Contrôle aussi dans le store** : chaque méthode classée vérifie `isAllowed` et lève
  `IntegrityViolationError` sinon (l'interface ne suffit jamais).
- Le champ libre « Opérateur » des boîtes de validation est remplacé par le profil connecté
  (`formatOperatorLabel` → « Prénom NOM (Rôle) ») ; entrée de journal `LOGIN` / `LOGOUT`.
- Dette à solder avant : déplacer l'ajout de lot (`CREATE_BATCH`, écrit directement dans l'onglet 02)
  dans une méthode du store ; rendre `saveTrial` non publique pour l'interface.

**Phase 2 — Application sur serveur avec authentification (cible retenue, D-13)** :
voir `SERVER_TARGET.md` §5. Rappel du raisonnement :
Dans une application 100 % navigateur, un mot de passe ou un rôle stocké localement **n'est pas une
barrière de sécurité** : toute personne ayant accès au poste peut modifier le stockage du navigateur.
La phase 1 apporte la **traçabilité nominative et la prévention des erreurs**, pas une protection
contre un acte volontaire. La phase 2 (identité vérifiée, données centralisées, journal infalsifiable
côté serveur) est un projet d'architecture à part entière.

## 7. Questions ouvertes (à trancher avant la phase 1)

1. L'**Utilisateur** voit-il aussi **09 Journal de bord** ? (défaut retenu : non, comme le Technicien.)
2. Les **exports** (PDF, CSV, sauvegarde) sont-ils permis à l'Utilisateur ? (défaut : non, LOW = Technicien+.)
3. ~~Valider une étape~~ — **tranché (D-12) : STANDARD**, ouvert au Technicien.
4. **Créer un essai** : Technicien autorisé (défaut STANDARD) ou Responsable seul ?
5. Faut-il une **double validation** (Technicien saisit, Responsable approuve) pour certaines actions HIGH ?
6. ~~Profils par poste ou partagés~~ — **tranché (D-12) : une personne = un compte = un rôle**, connexion
   par e-mail + mot de passe (voir §8).

## 8. Identification par e-mail + mot de passe (D-12)

**Règles de compte** (déjà codées : `validateUserProfile`, R-AUTH-10) : e-mail obligatoire, valide et
**unique** (insensible à la casse) ; prénom et nom obligatoires ; **un seul rôle** par compte (changer de
rôle = modifier le compte, jamais en créer un second) ; un compte n'est jamais supprimé, il est
**désactivé** (les entrées du journal qui le citent restent lisibles).

**Mot de passe — exigences quelle que soit la phase**
- Jamais stocké en clair, jamais dans un essai, un export, une sauvegarde complète ni le journal.
- Empreinte salée et lente (PBKDF2-SHA-256 via Web Crypto, sel aléatoire par compte, ≥ 600 000
  itérations — ou Argon2id côté serveur) ; comparaison en temps constant.
- Longueur minimale 12 caractères ; blocage temporaire après plusieurs échecs ; déconnexion
  automatique après inactivité (poste de laboratoire partagé).
- Comptes stockés à part des essais (clé dédiée, ex. `quv_lab_accounts_v1`), hors sauvegardes d'essai.

**Ce que l'e-mail + mot de passe implique pour la feuille de route**
- **Phase 1 (locale)** possible, mais limitée : les comptes n'existent que sur le poste où ils sont
  créés (un même agent doit être créé sur chaque poste), **aucune réinitialisation par e-mail**
  (le Responsable réinitialise le mot de passe), et protection **non opposable** à quelqu'un qui
  manipule le navigateur. Elle reste utile pour la traçabilité nominative (« Prénom NOM (Rôle) »).
- **Phase 2 (serveur ou annuaire de l'entreprise, ex. Microsoft 365 / Entra ID)** recommandée pour
  « une personne = un compte » sur tous les postes : comptes centralisés, réinitialisation par e-mail,
  vérification du mot de passe hors d'atteinte de l'utilisateur, éventuellement authentification
  unique avec le compte de messagerie de l'entreprise (aucun mot de passe supplémentaire à gérer).
- **Décision à prendre avant la phase 1** : faire une phase 1 locale transitoire, ou passer directement
  à la phase 2 avec l'annuaire de l'entreprise.
