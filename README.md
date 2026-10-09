# QUV-Lab

Application de saisie et de suivi des essais de vieillissement artificiel accéléré UV
(enceinte QUV) sur finitions pour bois extérieurs, selon la **NF EN 927-6:2018**.
Critères complémentaires : **NF EN 927-2:2014** (classification historique) et **INFIPERF / FCBA**.

- Saisie de paillasse : couleur (CIE L\*a\*b\*, ΔE\*), brillance 60°, dureté Persoz, adhérence (ISO 2409), observations (ISO 4628).
- Calendrier normatif T0 + 12 cycles de 168 h (2016 h), multi-lots, témoin T + éprouvettes exposées E1-E3.
- Calculs déterministes, rapport scientifique, exports RAW CSV / REPORT CSV / JSON, journal d'audit, photothèque.

## Fonctionnement

Application **100 % locale** dans le navigateur : aucun serveur, aucune clé d'API, aucun fichier `.env`.
Les métadonnées des essais sont stockées dans le `localStorage`, les photographies dans IndexedDB.
Exporter régulièrement les essais (JSON / CSV) : voir [`docs/release/06_BACKUP_RESTORE.md`](docs/release/06_BACKUP_RESTORE.md).

## Démarrage

Prérequis : Node.js 20 LTS.

```bash
npm ci          # installation (lockfile versionné)
npm run dev     # serveur de développement sur http://localhost:3000
```

## Qualité

```bash
npm run lint    # tsc --noEmit, mode strict
npm test        # suites de tests scientifiques (run_tests.ts)
npm run build   # build de production (dist/)
```

La CI GitHub Actions (`verify`) exécute ces trois commandes et doit être verte pour fusionner sur `develop` ou `main`.

## Documentation

- Règles scientifiques : [`docs/QUV_LAB_SCIENTIFIC_RULES.md`](docs/QUV_LAB_SCIENTIFIC_RULES.md)
- Architecture : [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- Workflow de contribution (branches, PR, niveaux de risque) : [`docs/agents/WORKFLOW.md`](docs/agents/WORKFLOW.md)
- Dossier de version : [`docs/release/`](docs/release/)
