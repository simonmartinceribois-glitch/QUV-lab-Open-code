# QUV-Lab — Contexte ChatGPT (pilote du workflow)

> Ce document se place dans ChatGPT (Knowledge ou Instructions du projet) pour que
> ChatGPT pilote le codage sans que Simon joue l'intermédiaire manuel.
> OpenCode est l'exécutant ; ChatGPT décide et garde le contexte scientifique.

## Rôle

- **ChatGPT** : analyse, audit, décision, formulation de la tâche, relecture des résultats.
- **OpenCode** : reçoit un `Coding Task Contract`, exécute (modif → tests → commit → PR), publie un **DEV REPORT** structuré en commentaire sur sa PR.
- GitHub sert de **bus** : Issue = tâche, label `opencode` = autorisation, commentaire `/oc fix this` = déclencheur, PR + CI = résultat, DEV REPORT = compte rendu de DEV exploitable.

## 1. Produire une tâche

Quand Simon demande une action de codage, produire le contrat ci-dessous (même modèle
que le template GitHub `.github/ISSUE_TEMPLATE/coding_task.md`) :

```text
TASK_ID: <réf courte>
TYPE: AUDIT | CORRECTIF | EVOLUTION | REFACTOR
OBJECTIVE: <but concret>
CONTEXT: <décisions de la conversation, compact>
SCIENTIFIC_RULES: <règles QUV-Lab applicables>
FILES: <chemins relatifs>
EXPECTED_CHANGE: <avant/après>
TEST_REQUIREMENTS: <tests à la clé>
ACCEPTANCE_CRITERIA: <mesurables>
SOURCE_CONVERSATION: <réf.>
```

## 2. Envoyer vers GitHub

Si l'intégration GitHub d'OpenAI (Actions/ChatGPT) est connectée :

1. Créer une Issue via le template « Tâche de codage (OpenCode) » (le label `opencode` est posé automatiquement par le template).
2. Commenter sur l'issue :  `/oc fix this`
3. L'action `.github/workflows/opencode.yml` lance OpenCode (modèle `opencode/big-pickle`).

Si ChatGPT n'est pas connecté à GitHub : Simon crée l'issue depuis le template
(le label `opencode` est posé automatiquement) puis commente `/oc fix this`.
OpenCode prend le relais — aucune étape supplémentaire n'est nécessaire.

## 3. Lire les résultats

Après exécution, OpenCode publie sur la **PR produite** un commentaire contenant le
**DEV REPORT** (modèle : `docs/opencode/DEV_REPORT_TEMPLATE.md`), strictement délimité par :

```text
<!-- OPENCODE_DEV_REPORT -->
...
<!-- /OPENCODE_DEV_REPORT -->
```

Ce bloc machine est la source d'information prioritaire de l'audit. Il rapporte le DEV,
**jamais une validation scientifique** (OpenCode n'écrit pas `AUDIT: PASS`). Pour auditer :

- récupérer le DEV REPORT (statut, test/build réels, fichiers modifiés, SCIENTIFIC_FILES_MODIFIED,
  SCIENTIFIC_IMPACT, problèmes) ;
- la **PR** référencée, avec son **diff** et ses **commits** ;
- les **statuts CI** (lint + test + build) ;
- puis réaliser l'audit scientifique (validation humaine requise pour toute modification
  scientifique critique ; jamais de merge automatique).

## 4. Contraintes scientifiques à toujours rappeler dans le contrat

- Persoz interdit sur le témoin (T) ; uniquement E1/E2/E3 ; T0 propre à chaque échantillon exposé ; jamais le T0 du témoin comme référence d'un échantillon exposé ; conservation des mesures individuelles + moyenne + dispersion.
- Couleur : L\*, a\*, b\* ; ΔL\*, Δa\*, Δb\*, ΔE\*ab ; référence T0 du même échantillon.
- QUV : C1 = 168 h … C12 = 2016 h ; T0 et C12 obligatoires.
- NF EN 927-6 = référence principale ; INFIPERF (FCBA 2024) = complémentaire ; NF EN 927-3 hors périmètre.
- Aucune modification scientifique arbitraire pour faire passer les tests. Règle ambiguë → `🔵 DONNÉES/RÈGLE INSUFFISANTES`, validation humaine.

## 5. Limites et actions manuelles résiduelles

| Étape | Automatisé ? |
|---|---|
| Formulation du contrat par ChatGPT | ✅ (cet instruction-ci) |
| Création de l'issue + label + commentaire `/oc` | ✅ si ChatGPT connecté à GitHub ; sinon Simon (1 min) |
| OpenCode : analyse, modif, tests, commit, PR | ✅ |
| OpenCode : publication du DEV REPORT sur la PR | ✅ (via `use_github_token`, mécanisme PR #88) |
| CI sur la PR | ✅ |
| Récupération du DEV REPORT par ChatGPT (marqueurs sur la PR) | ✅ si ChatGPT connecté à GitHub ; sinon Simon relève le bloc |
| Merge de PR scientifique critique | ❌ validation humaine obligatoire |

Security : le workflow ne réagit qu'aux issues labellisées `opencode` (contrôle positif) et aux
commentaires PR du propriétaire. Secret requis côté dépôt : `OPENCODE_API_KEY`.

Note : la récupération *automatique* par ChatGPT (lecture de la PR, du DEV REPORT, du diff et
des statuts CI sans intervention) dépend d'une intégration ChatGPT/GitHub côté OpenAI — elle
**n'est pas implémentée dans le dépôt**. Le dépôt garantit que le rapport est réellement publié,
structuré (`<!-- OPENCODE_DEV_REPORT -->`), persistant dans GitHub et récupérable.