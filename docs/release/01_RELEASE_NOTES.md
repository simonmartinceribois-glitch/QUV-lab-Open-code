# QUV-LAB v1.8.0 — RELEASE NOTES
**Date de Release :** 09 Octobre 2026
**Statut :** RELEASE QUALIFIED — 1069 / 1069 tests, `tsc` strict 0 erreur, build OK, `npm audit` 0 vulnérabilité
**Périmètre :** PR #147 → #148 depuis la v1.7.0

## Correctif important
- **Boutons d'export de sauvegarde** : l'export JSON existait dans le code depuis l'origine mais n'était relié à
  aucun bouton. En v1.6.0 et v1.7.0, aucune sauvegarde rechargeable ne pouvait donc être produite, et l'import
  v1.7.0 n'était pas utilisable en pratique. Nouvel encadré **« Sauvegarde de l'essai »** dans l'onglet 08,
  disponible même sans rapport généré (#147).

## Nouveautés
- **Sauvegarde complète avec photographies** (`SAUVEGARDE_COMPLETE_<REF>.json`) : restauration intégrale de
  l'essai et de ses photos par « Importer un essai » ; une photo déjà présente n'est jamais remplacée (#147).
- **Import en copie** : un essai déjà présent peut être importé comme copie indépendante (nouvel identifiant,
  référence suffixée `-COPIE`), l'original n'est jamais modifié (#148).

---

# QUV-LAB v1.7.0 — RELEASE NOTES
**Date de Release :** 09 Octobre 2026
**Statut :** RELEASE QUALIFIED — 1061 / 1061 tests, `tsc` strict 0 erreur, build OK, `npm audit` 0 vulnérabilité
**Périmètre :** PR #142 → #144 depuis la v1.6.0

## Nouveautés
- **Import d'un essai** depuis le dossier scientifique JSON (tableau de bord → « Importer un essai ») :
  restauration à l'identique (RAW, calculs, rapports, journal d'audit), opérateur obligatoire, import tracé
  (`IMPORT_TRIAL`), jamais d'écrasement d'un essai existant, refus de tout fichier anormal (#144).

## Corrections
- Journal d'audit : l'export JSON est tracé sous son propre type `EXPORT_SCIENTIFIC_DOSSIER` (il apparaissait
  comme un export CSV calculé) (#142).

## Maintenance
- Identifiants générés par `crypto.randomUUID()` ; dépendance `motion` inutilisée supprimée ; outils de build
  en `devDependencies` ; typage des sélecteurs de l'interface ; README et identité du projet (#143).

---

# QUV-LAB v1.6.0 — RELEASE NOTES
**Date de Release :** 09 Octobre 2026
**Référentiel Normatif :** NF EN 927-6:2018 (critères complémentaires NF EN 927-2:2014 et INFIPERF / FCBA)
**Statut :** RELEASE QUALIFIED — 1051 / 1051 tests, `tsc` strict 0 erreur, build OK, `npm audit` 0 vulnérabilité
**Périmètre :** PR #27 → #139 depuis la v1.5.0 (04/09/2026)

## Évolutions scientifiques
- **Critères complémentaires** NF EN 927-2:2014 (classification STABLE / SEMI_STABLE / NON_STABLE) et INFIPERF / FCBA, évalués par lot, indépendants entre eux, sans verdict global (#124, #126, #127).
- **Adhérence** : 2 mesures par éprouvette (Gate 57), protocole adapté à 3 mesures, quadrillage non applicable au-delà de 250 µm, référence T0 du témoin (#60, #61, #64, #65, #96, #97, #131).
- **Persoz** : agrégation Gate 58, absence de mesure verrouillée sur le témoin, dénominateurs de delta séparés (#62, #63, #69, #82).
- **Protocoles de mesure adaptés** explicites et tracés pour toutes les familles ; nombre de mesures = choix explicite du protocole (#101, #102, #129, #132, #134, #135).
- **Gel du contexte scientifique** à la première acquisition (RuleSet figé par essai, reproductibilité) (#136).
- **Fidélité scientifique** : aucune valeur ni conclusion fabriquée, séparation stricte COMPUTED / critère, traçabilité explicite des références (#71, #79, #92, #93, #100).
- **Calendrier** : jalons d'exposition verrouillés, applicabilité par famille, suppression des faux jalons C1/C2 (#80, #95, #98, #109).

## Robustesse et données
- **Photothèque migrée vers IndexedDB** : les photos ne saturent plus le `localStorage` (#111, #120, #121, #122).
- **Persistance** : échecs d'écriture signalés à l'opérateur ; un stockage illisible est copié intégralement sous une clé de secours avant toute écriture, ou les écritures sont bloquées (#112, #139).
- **Exports CSV** échappés (séparateurs, guillemets, injection de formule) et encodés avec BOM UTF-8 (#139).
- **ErrorBoundary** global : plus d'écran blanc sur erreur d'affichage (#113).
- Imports et données mal formées rejetés sans plantage (#75).

## Interface
- Allègement de l'assistant de création (étapes 1 à 7), des onglets 01 à 03 et du calendrier ; suppression de l'onglet 07 Contrôle Qualité et des badges de verrouillage (#27 → #54).

## Sécurité et CI
- Workflow opencode réservé aux propriétaires / collaborateurs ; actions GitHub figées par SHA (#114, #115, #117).
- Branche par défaut `develop` ; check `verify` (GitHub Actions) et résolution des conversations exigés pour fusionner sur `develop` et `main`.

---

# QUV-LAB v1.2.0 — RELEASE NOTES
**Date de Release :** 01 Septembre 2026  
**Référentiel Normatif :** NF EN 927-6:2018  
**Statut :** Version Qualifiée pour Mise en Production Contrôlée (RELEASE QUALIFIED)

---

## 1. Vue d'Ensemble
QUV-Lab v1.2.0 est la solution métier de référence dédiée à la conduite, à la saisie de paillasse, au calcul statistique déterministe, à l'analyse multi-lots et au reporting normatif des essais de vieillissement accéléré UV sur finitions pour bois extérieurs.

## 2. Fonctionnalités et Capacités Validées
- **Modèle de Données Multi-Lots & Multi-Systèmes :** Gestion étanche des lots ($n$ lots par essai), 4 éprouvettes par lot ($1\text{ Témoin } T + 3\text{ Exposées } 1, 2, 3$).
- **Ségrégation Métrologique du Témoin $T$ :** Conservation intégrale dans le fichier brut `RAW CSV` et le rapport, avec exclusion mathématique absolue des cinétiques d'exposition.
- **Calendrier Normatif NF EN 927-6 :** 13 jalons stricts ($T_0$ obligatoire + 12 cycles de 168 h, jalon final à 2016 h).
- **Moteur Scientifique Déterministe :**
  - Couleur CIE 1976 $\Delta E^*_{ab}$ (4 points de mesure avec contrôle de répétabilité).
  - Brillance 60° GU selon ISO 2813 (Séries S1 sens du fil et S2 sens opposé au fil par rotation 180° de l'instrument, formule de rétention $R = (G_C / G_{T0}) \times 100$).
  - Dureté d'amortissement pendulaire Persoz selon ISO 1522 / procédure labo (3 répétitions, calcul $s$ et $CV\%$).
  - Observations visuelles ISO 4628 (cloquage, craquelage, écaillage, farinage).
- **Rapport Scientifique NF EN 927-6 :** 19 sections normatives exhaustives + 6 annexes techniques (A à F).
- **Double Exportation & Archivage :** Génération native des fichiers `RAW CSV`, `REPORT CSV` et `JSON` d'archive intégrale.
- **Journal d'Audit Immuable :** Traçabilité chronologique *append-only* avec horodatage ISO et identification des opérateurs.
