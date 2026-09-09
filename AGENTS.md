# QUV-Lab — Instructions projet (OpenCode)

> Référence commune des agents : `docs/ai/QUV_LAB_SCIENTIFIC_CONTRACT.md`.
> Rôles et chaîne canonique : `docs/agents/AGENTS.md`, `docs/agents/WORKFLOW.md`.
> Architecture : `docs/architecture/ARCHITECTURE.md`.

## Routage `/oc AUDIT — SUJET`

Toute demande `/oc AUDIT — [SUJET]` est prise en charge par
`.opencode/agent/quv-orchestrator.md` : explorer → reviews scientifique,
normative et code (parallèle) → tests → consolidation → correction justifiée
éventuelle → re-test → re-audit → rapport → PR si modification (boucle max 5,
escalade humaine si persistance, jamais de merge auto scientifique critique).

## Sous-agents (`@` + nom, ou via Task)

- `@quv-orchestrator` — coordination et consolidation.
- `@quv-explorer` — exploration READ ONLY.
- `@quv-scientific-reviewer` — audit scientifique READ ONLY (NF EN 927-6).
- `@quv-norm-reviewer` — audit normatif READ ONLY (NF EN 927-6 vs INFIPERF).
- `@quv-code-reviewer` — revue logiciel READ ONLY.
- `@quv-test-engineer` — tests (propose + exécute : `npm test`, `tsc --noEmit`).

## Garde-fous

- Audit = lecture seule par défaut ; correction seulement si justifiée
  (Données→Règle→Anomalie→Correction→Test→Vérification).
- Jamais : test supprimé/affaibli, critère modifié pour verdir, hypothèse en règle.
- `develop` protégée ; PR vers `develop` ; CI (`lint`, `test`, `build`) fait foi.
