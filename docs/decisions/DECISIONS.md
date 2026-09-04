# QUV-Lab — DÉCISIONS (journal, ordre antichronologique)

## 2026-09-04 — D-03 : CI verte 195/195, audit corrigé, ticket Gate 2.2 annulé

- **Fait** : CI sur `e44914c` = `tsc` OK + **195/195 tests OK** (Gate 2.2 = 7/7) + build.
  Détail : suites 44/7/30/12/6/**23**/9/12/**11**/18/8/15 (intitulés `run_tests.ts` "20" et "12" à corriger).
- **Correction d'audit** : les 3 échecs Gate 2.2 venaient du `test-results.txt` committé (état de code
  antérieur). Constats C1/C2 révisés en C1bis (artefact trompeur) + manifest 151 à régénérer.
  Fichiers MAJ : `ARCHITECTURE.md` §6, `INITIAL_AUDIT.md` §2/§4.
- **Décidé** : ticket HIGH `fix/gate22-temoin-jalons` **annulé** (plus d'objet). Prochain ticket :
  `fix/test-transparency` (LOW/MEDIUM) — labels UI `App.tsx:91-104`, intitulés `run_tests.ts`,
  sort du `test-results.txt` (régénérer ou git-ignorer, la CI fait foi).
- **Aussi** : `ci.yml` passé à `actions/checkout@v5` + `setup-node@v5` (`29edcda`, warning Node 20 clos),
  Node app conservé à 20 (environnement qualifié du manifest).

## 2026-09-04 — D-02 : repo GitHub créé et poussé

- Commits `e44914c` (audit + CI) puis `29edcda` (actions v5) sur `audit/initial`, `main` créée au même point,
  poussés vers `simonmartinceribois-glitch/QUV-lab-Open-code` (public). CI déclenchée automatiquement.

## 2026-09-04 — D-01 : CI minimale sans lockfile, Git à installer

- **Contexte** : copie `quv-lab-main/` sans `.git`, sans `node_modules`, sans lockfile ;
  `git` introuvable sur le poste (`C:\Program Files\Git\*`, GitHub Desktop : absents).
- **Décidé** : CI `.github/workflows/ci.yml` (ubuntu, Node 20) avec `npm install`
  (pas `npm ci`, aucun lockfile), puis `npm run lint` (= `tsc --noEmit`), `npm test`
  (= `tsx run_tests.ts`, 193 tests), `npm run build`.
- **Conséquence assumée** : CI **rouge** tant que Gate 2.2 A2/A3/B2 non corrigés
  (voir `docs/audits/INITIAL_AUDIT.md` C1). C'est le comportement voulu : pas de vert artificiel.
- **À faire côté humain** : installer Git, `git init` + commit + push (commandes transmises à l'utilisateur).
- **Non-décidé / reporté** : génération d'un lockfile (`npm install` local, à committer) ;
  élagage `express/dotenv/@google/genai` ; `strict:true` — tickets dédiés, validation requise.

## 2026-09-04 — D-00 : Audit initial sans modification du code

- Audit read-only de `src/` ; seuls des fichiers `docs/` (+ `.github/`) ont été ajoutés.
  Aucune refonte engagée. Réf : `docs/audits/INITIAL_AUDIT.md`.
