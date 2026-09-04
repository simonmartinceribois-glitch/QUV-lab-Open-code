# QUV-Lab — DÉCISIONS (journal, ordre antichronologique)

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
