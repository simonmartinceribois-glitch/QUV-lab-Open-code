# QUV-Lab — AUDIT INITIAL (2026-09-04, READ ONLY sur `src/`)

## 1. Périmètre

Copie `quv-lab-main/` (ZIP, sans `.git`). 15 points couverts : structure, React, types, état,
persistance, calculs, normatif, exports, tests, scripts, Git, parallèles/orphelins, dépendances,
régressions, intégration OpenCode. Détail architecture : voir `docs/architecture/ARCHITECTURE.md`.

## 2. Constats majeurs

| # | Constat | Preuve | Risque |
|---|---|---|---|
| C1 | Gate 2.2 : 3 échecs (A2 cinétique, A3 comparateur, B2 réactivation jalon) | `test-results.txt` (4/7) | HIGH — cœur métier (témoin T, jalons) |
| C2 | Manifest 151/151 à 100 % contredit par C1 | `docs/release/08_RELEASE_MANIFEST.json:11-16` | HIGH — faux vert |
| C3 | Pas de Git/CI, pas de source de vérité | `Test-Path .git` = False | HIGH — bloque multi-agents |
| C4 | Labels UI "20/22" faux vs 193 tests réels ; viewer UI = 1/12 suites | `App.tsx:91-104`, `ScientificTestsViewer.tsx:2` | MED — confiance |
| C5 | Typage permissif (`| string`, pas de `strict`) | `trial.ts:43-70`, `tsconfig.json` | MED — données |
| C6 | Scripts : `lint`=tsc, `build` sans tsc, `clean` non-Windows | `package.json:6-13` | MED — dérive silencieuse |
| C7 | Dépendances mortes `express/dotenv/@google/genai` (0 usage `src/`) | grep `src/` | MED — attaque/poids |
| C8 | God files (trialStore 2226 l, TabPhotographs 1488 l, Wizard 1464 l, Tab06 1246 l) | mesures `src/` | MED — régression |
| C9 | Persistance `localStorage` fragile + seed démo en prod | `trialStore.ts:1352-1382`, `07_KNOWN_LIMITATIONS.md` | HIGH — perte/confusion |
| C10 | Photos démo SVG vs consigne serveur labo | `trialStore.ts:704-705` | LOW — écart démo/prod |

## 3. Points conformes

Moteurs purs/déterministes versionnés 1.2.0, RAW immuable (SUSPECT conservé), référentiel découplé
avec origines de règles, pipeline T0, 5 niveaux + 6 niveaux d'analyse, conclusion `NON_EVALUEE` par défaut,
ADHESION T0+C12, T0/C12 verrouillés, INACTIVE exclu des actifs, 12 suites de tests lançables via `tsx`,
store éphémère isolé, `docs/release/` (procédures, limitations assumées).

## 4. Architecture cible / écarts / plan

Cible : repo GitHub + CI (tsc + 193 tests + build) + docs versionnées + workflow
`docs/agents/WORKFLOW.md`. Écarts : §2 C1-C9. Plan : (1) corriger Gate 2.2 + régénérer résultats/manifest
(HIGH, validation humaine) ; (2) `git init` + CI ; (3) durcir scripts/typage ; (4) transparence tests UI ;
(5) élaguer dépendances ; (6) découper god files. Premier ticket conseillé : `fix/gate22-temoin-jalons`.
Aucune refonte engagée — cet audit + `docs/` sont l'étape 1.
