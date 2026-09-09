# OpenCode — DEV REPORT : contrat de fin de développement

> Généré par OpenCode seul, à partir des résultats RÉELS de son exécution.
> Publié comme commentaire sur la PR concernée, via l'accès GitHub de l'exécution
> (`use_github_token: true`, PR #88). Jamais généré par ChatGPT ni par un système externe.
> OpenCode n'écrit jamais `AUDIT: PASS` ni aucune validation scientifique :
> la validation finale appartient à ChatGPT, la décision à l'utilisateur.

## 1. Ordre impératif de publication

1. modification du code ;
2. exécution des tests (`npm ci`, `npm run lint`, `npm test`, `npm run build`) ;
3. commit ;
4. push ;
5. création ou mise à jour de la PR ;
6. **puis** publication du DEV REPORT en commentaire sur cette PR.

Le rapport ne contient donc que des informations correspondant à l'état réellement produit.

## 2. Bloc machine obligatoire

Texte humain autorisé au-dessus ; **le bloc machine reste strictement délimité** :

```text
<!-- OPENCODE_DEV_REPORT -->

STATUS: PASS | FAIL

TASK_ID:
TASK_TYPE: AUDIT | CORRECTIF | EVOLUTION | REFACTOR

PR:
BRANCH:
COMMIT:

FILES_MODIFIED:
- ...

SCIENTIFIC_FILES_MODIFIED:
- ...
ou
NONE

TESTS:
- npm ci:
- npm run lint:
- npm test:
- npm run build:

TEST_COUNT:

SCENARIOS:
- ...
ou
NONE

PROBLEMS:
- ...
ou
NONE

REMAINING_ISSUES:
- ...
ou
NONE

SCIENTIFIC_IMPACT:
- ...
ou
NONE

RECOMMENDATION:
READY_FOR_AUDIT | NEEDS_CORRECTION

<!-- /OPENCODE_DEV_REPORT -->
```

## 3. Règles de remplissage

- `STATUS` / `RECOMMENDATION` : jugement de DEV (tests + build), **jamais scientifique**.
- `TASK_ID` : repris du Coding Task Contract (issue) ; sinon référence claire de la tâche.
- `FILES_MODIFIED` : chemins relatifs, 1 par ligne.
- `SCIENTIFIC_FILES_MODIFIED` : `NONE`, ou les fichiers scientifiques réellement modifiés
  (`src/scientific/`, `src/types/`, `src/services/`) — les signaler = impact à auditer.
- `TEST_COUNT` : nombre réel tiré de `npm test` (jamais inventé).
- `SCIENTIFIC_IMPACT` : changements touchant règles/résultats scientifiques ; sinon `NONE`.
- Aucune donnée inventée. Règle ambiguë → `🔵 DONNÉES/RÈGLE INSUFFISANTES`.

## 4. Rôle du rapport dans la chaîne

```text
OPENCODE → DEV REPORT → GITHUB (commentaire PR) → CHATGPT → AUDIT → USER → MERGE
```

Le commentaire GitHub est une **entrée pour l'audit ChatGPT**, jamais une validation.
Identifiable automatiquement par les marqueurs `<!-- OPENCODE_DEV_REPORT -->` /
`<!-- /OPENCODE_DEV_REPORT -->` — aucune dépendance au texte libre.