# QUV-Lab — PLAN D'ACTION : MIGRATION VERS LE SERVEUR

> Créé le 2026-10-09 (demande utilisateur). Référence : `docs/architecture/SERVER_TARGET.md` (cible, règles,
> dette), décisions D-11 → D-14. Ce plan découpe la dette restante en lots livrables ; **aucun lot n'est
> engagé** tant que l'hébergement n'est pas décidé avec l'équipe informatique (lot 0).
> Mettre à jour la colonne « Statut » à chaque PR.

## Vue d'ensemble

| Lot | Dette | Objet | Dépend de | Risque | Charge estimée | Statut |
|---|---|---|---|---|---|---|
| 0 | — | Cadrage avec l'équipe informatique | — | — | 1 réunion + compte rendu | À faire |
| 1 | A4 | Essais de démonstration désactivables | — | LOW | ½ jour | À faire |
| 2 | A2 | Port de persistance + store asynchrone (toujours local) | — | HIGH | 3 à 5 jours | À faire |
| 3 | A5 | Serveur : API, base de données, journal serveur | 0, 2 | HIGH | 2 à 4 semaines | À faire |
| 4 | A6 | Recalcul scientifique côté serveur | 3 | HIGH | 3 à 5 jours | À faire |
| 5 | — | Connexion (e-mail + mot de passe / annuaire), droits appliqués | 3 | HIGH | 1 à 2 semaines | À faire |
| 6 | — | Migration des données locales, arrêt du mode local | 3, 4, 5 | HIGH | 2 à 3 jours | À faire |

Déjà résorbé : A1 (`createBatch`, PR #157), A3 (horodatages dans le store, PR #157).

---

## Lot 0 — Cadrage avec l'équipe informatique

**Objectif** : fixer les choix d'infrastructure dont dépendent les lots 3 à 6.
**Questions** (cf. `SERVER_TARGET.md` §6) : hébergement (serveur interne / cloud) ; base de données
imposée ; sauvegardes et rétention ; annuaire d'entreprise utilisable pour la connexion (OIDC / SAML,
ex. Microsoft Entra ID) ou comptes propres à l'application ; exigences d'intégrité du journal (durée de
conservation, horodatage certifié) ; accès réseau des postes de laboratoire.
**Livrable** : compte rendu dans `docs/decisions/DECISIONS.md` (nouvelle décision).

## Lot 1 — A4 : essais de démonstration désactivables

**Constat** : `trialSeed.ts` crée DEMO-APP-001 et QUV-2026-VAL-01 au premier lancement.
**Étapes** : drapeau de configuration (`VITE_SEED_DEMO`, actif par défaut en local, inactif en
production) lu par `TrialStoreService` ; `resetToDemo` réservé au Responsable (déjà HIGH) et masqué en
production ; documentation `04_DEPLOYMENT_GUIDE.md`.
**Tests** : stockage vide + drapeau inactif → aucun essai créé ; drapeau actif → comportement actuel.
**Critère de fin** : un build de production démarre sans essai de démonstration.

## Lot 2 — A2 : port de persistance et store asynchrone (préparation, toujours 100 % local)

**Constat** : `TrialStoreService` mêle logique métier et `localStorage`, et toutes ses méthodes sont
synchrones ; un appel serveur sera asynchrone.
**Étapes (PR successives, comportement inchangé)** :
1. Interface `TrialRepository` (`loadAll`, `save`, `saveAuditEntries`…) ; implémentation
   `LocalStorageTrialRepository` reprenant exactement le code actuel (copie de secours, blocage
   d'écriture, zéro écriture au chargement — IR-35/36/37/48/56).
2. Les méthodes de commande du store deviennent `async` (retour `Promise`) ; l'interface attend le
   résultat (état « enregistrement… », erreurs affichées) — un onglet par PR.
3. Le chargement initial devient asynchrone (écran de chargement).
**Risques** : régressions d'interface (double clic, états intermédiaires) → bouton désactivé pendant
l'enregistrement ; suites de tests à adapter en `await` sans en supprimer.
**Critère de fin** : plus aucun appel direct à `localStorage` dans `trialStoreService.ts` ; 100 % des
tests verts ; garde-fou R-ARCH-03 restreint au seul dépôt local.

## Lot 3 — A5 : serveur, API, base de données, journal serveur

**Étapes** :
1. API reprenant `ACTION_CATALOG` (une action = un point d'API), validation identique (code TypeScript
   partagé : `trialIntegrity`, `trialIdentification`, `trialLotsSpecimens`…).
2. Modèle : essai + **table de journal séparée, append-only**, horodatée et signée par le serveur ;
   **numéro de version** par essai (verrouillage optimiste : refus si l'essai a changé entre-temps).
3. Stockage des photographies (implémentation serveur de `MediaStoragePort`).
4. `HttpTrialRepository` côté client (remplace `LocalStorageTrialRepository`).
**Risques** : accès simultanés → conflits de version gérés à l'écran (« l'essai a été modifié par … »).
**Critère de fin** : deux postes voient le même essai ; une modification concurrente est refusée
proprement ; le journal n'est plus modifiable par le client.

## Lot 4 — A6 : recalcul scientifique côté serveur

**Constat** : les valeurs calculées (COMPUTED) sont produites par le navigateur.
**Étapes** : le serveur exécute le même moteur (`src/scientific/`, déjà sans API navigateur — R-ARCH-01)
à chaque enregistrement de mesure et à la génération de rapport ; les valeurs envoyées par le client
sont ignorées ou comparées (écart journalisé).
**Critère de fin** : un client modifié ne peut pas imposer une valeur calculée.

## Lot 5 — Connexion et droits

**Étapes** : connexion e-mail + mot de passe (ou annuaire, selon lot 0) ; exigences de
`feature-auth-roles.md` §8 (empreinte salée, blocage, déconnexion automatique) ; `session.ts` alimenté
par le serveur ; **suppression du profil provisoire** (`sessionProfileStore.ts`,
`SessionProfileDialog.tsx`) ; `AUTH_ENABLED = true` ; contrôle des droits **côté serveur** sur chaque
point d'API, l'interface masquant boutons et onglets (`isAllowed`, `isTabVisible`) ; gestion des
comptes réservée au Responsable ; questions ouvertes 1 et 2 de la spec tranchées.
**Critère de fin** : chaque entrée du journal porte le compte connecté ; un Technicien ne peut pas
exécuter une action HIGH, même en appelant l'API directement.

## Lot 6 — Migration des données et fin du mode local

**Étapes** : chaque poste exporte ses essais en **sauvegarde complète** (format versionné, photos
incluses) ; import serveur (même contrôles que `importTrialFromExport`, import en copie en cas de
doublon) ; vérification par essai (nombre d'acquisitions, rapports, journal) ; mode local désactivé.
**Critère de fin** : inventaire des essais migrés signé par le Responsable ; plus aucune donnée
uniquement locale.
