# QUV-Lab — ARCHITECTURE CIBLE : APPLICATION SUR SERVEUR (D-13)

> Décision utilisateur (2026-10-09) : l'application sera hébergée sur un serveur, avec connexion
> par compte (une personne = un compte = un rôle, e-mail + mot de passe). **Rien n'est encore codé**
> côté serveur : ce document fixe la cible et les règles que **chaque évolution** doit respecter dès
> maintenant pour que la migration soit un changement de couche, pas une réécriture.
> Liens : `ARCHITECTURE.md` (état actuel), `../specifications/feature-auth-roles.md` (droits).

## 1. Aujourd'hui → demain

| Domaine | Aujourd'hui (100 % navigateur) | Cible serveur |
|---|---|---|
| Interface | React (SPA) | Inchangée, servie par le serveur |
| Persistance des essais | `localStorage`, un tableau JSON, store **synchrone** | Base de données serveur, API **asynchrone** |
| Photographies | IndexedDB (`MediaStoragePort`) | Stockage de fichiers serveur (même port) |
| Journal de bord | Écrit par le navigateur dans l'essai | Écrit **par le serveur**, append-only, horodaté serveur |
| Identité de l'opérateur | Champ libre « Opérateur » | Compte connecté (« Prénom NOM (Rôle) »), jamais saisi |
| Droits | Aucun (`AUTH_ENABLED = false`) | Contrôlés **par le serveur** (`permissions.ts` partagé), l'interface ne fait que masquer |
| Moteur scientifique | Exécuté dans le navigateur | Même code TypeScript, **réexécuté côté serveur** (les valeurs calculées du client ne sont jamais crues sur parole) |
| Multi-utilisateurs | Un seul navigateur | Accès simultanés → verrouillage optimiste (version de l'essai) |
| Sauvegarde | Manuelle (sauvegarde complète JSON) | Sauvegardes serveur automatiques ; les formats d'export restent |
| Connexion | Aucune | Comptes serveur ou annuaire de l'entreprise (OIDC, ex. Microsoft Entra ID) |

## 2. Principe directeur : une action = une commande

Chaque action qui modifie un essai est **une méthode dédiée de `TrialStoreService`**, avec des entrées
explicites (identifiant de l'essai, valeurs saisies, opérateur), qui valide, applique et journalise.
À la migration, chaque méthode devient **un appel d'API** ; le serveur exécute la même logique
(validation, moteur scientifique, `permissions.ts`, journal). Le catalogue `ACTION_CATALOG` est donc
aussi la **liste des futurs points d'API**.

## 3. Règles applicables dès maintenant (chaque PR)

1. **Pas d'écriture depuis l'interface** : un composant n'appelle jamais `saveTrial` et ne modifie pas
   l'objet essai (ni `auditTrail.push`) ; il appelle une méthode du store. *(garde-fou R-ARCH-02)*
2. **Moteur scientifique portable** : `src/scientific/` n'utilise aucune API du navigateur (`window`,
   `document`, `localStorage`, IndexedDB…) pour pouvoir tourner sur le serveur. *(R-ARCH-01)*
3. **Stockage confiné** : `localStorage` / IndexedDB uniquement dans les services de persistance
   (`trialStoreService`, `mediaStorageService`, `mediaMigrationService`). *(R-ARCH-03)*
4. **Opérateur = paramètre** : toute méthode qui journalise reçoit l'opérateur en paramètre (aujourd'hui
   saisi, demain fourni par la session) ; aucun opérateur « par défaut » nouveau.
5. **Horodatage du journal dans le store**, jamais dans un composant (le serveur en deviendra seul maître).
   Les dates *observées* (date de mesure, date d'application) restent des données saisies.
6. **Identifiants** : UUID générés par `generateUUID` (le serveur acceptera des UUID fournis par le
   client, ce qui rend les commandes rejouables sans doublon).
7. **Pas de mot de passe ni de donnée de compte** dans les essais, exports ou sauvegardes.
8. **Formats d'échange versionnés** (sauvegarde complète : `formatVersion`), car ils serviront à
   migrer les données locales vers le serveur.
9. Toute nouvelle action est classée dans `ACTION_CATALOG` (D-11, garde-fous R-AUTH-05 / 06).

## 4. Dette à résorber avant la migration (suivie par les garde-fous)

| # | Dette | Où | Action prévue |
|---|---|---|---|
| ~~A1~~ | ~~Ajout de lot écrit directement par l'interface~~ | — | **Résorbée** : `TrialStoreService.createBatch` (R-ARCH-05) ; liste de dette de R-ARCH-02 vide |
| A2 | Store synchrone, `localStorage` intégré | `trialStoreService.ts` | Extraire un port de persistance (`TrialRepository`) puis passer les méthodes en asynchrone (une PR dédiée, HIGH) |
| ~~A3~~ | ~~Horodatages produits dans l'onglet 06~~ | — | **Résorbée** : `stampAcquisitionRaw` dans `recordAcquisition` pose `measurementDateTime` / `assessedAt` / `assessedBy` s'ils manquent, sans écraser une valeur fournie (R-ARCH-06 / 07) |
| A4 | Essais de démonstration semés au premier lancement | `trialSeed.ts` | Désactiver en production serveur |
| A5 | Essai stocké comme un seul document JSON | modèle | Côté serveur : essai + table de journal séparée append-only + numéro de version |
| A6 | Valeurs calculées produites par le client | moteur scientifique | Le serveur recalcule à la réception (même code) |

## 5. Étapes de migration envisagées (non planifiées)

1. ~~Résorber A1 et A3~~ — fait (PR `refactor/server-debt-a1-a3`).
2. Port de persistance `TrialRepository` + store asynchrone, implémentation `localStorage` conservée (A2).
3. Serveur : API reprenant `ACTION_CATALOG`, base de données, stockage des photos, journal serveur,
   recalcul scientifique (A5, A6).
4. Connexion (comptes / annuaire), activation de `permissions.ts` côté serveur puis interface.
5. Migration des données locales par la **sauvegarde complète** (format versionné) ; arrêt du mode local.

## 6. Questions pour l'équipe informatique (à préparer)

- Hébergement (serveur interne, cloud), base de données imposée, politique de sauvegarde.
- Annuaire d'entreprise disponible pour la connexion (OIDC / SAML) ou comptes propres à l'application.
- Exigences de conservation et d'intégrité du journal (durée, horodatage certifié éventuel).
