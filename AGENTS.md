# QUV-Lab — Instructions projet (chargées automatiquement par OpenCode)

> Rôle : OpenCode = **exécutant**. ChatGPT = **pilote** (décision & contexte scientifique).
> Ce fichier est lu par OpenCode à chaque session, locale comme exécutée via
> `.github/workflows/opencode.yml` (pont ChatGPT → GitHub → OpenCode).

## 1. Chaîne d'exécution imposée pour toute tâche

```text
AUDIT  : analyse → rapport → (PR si correction demandée)
CORRECTIF : modification → tests → commit → PR
EVOLUTION : modification → tests → commit → PR
REFACTOR  : modification → tests → commit → PR
```

Avant d'ouvrir une PR, exécuter OBLIGATOIREMENT, dans l'ordre et avec le résultat :

```bash
npm ci
npm run lint   # = tsc --noEmit
npm test       # = tsx run_tests.ts
npm run build  # = tsc --noEmit && vite build
```

Ne jamais inventer d'autre commande (`package.json` fait foi). La CI GitHub (`ci.yml`)
rejoue ces mêmes étapes sur la PR — pas de vert artificiel.

## 2. Garde-fous scientifiques (ne JAMAIS enfreindre)

- **Persoz** interdit sur le témoin (T) ; uniquement E1/E2/E3.
- Chaque échantillon exposé possède son **propre T0 Persoz** ; C1–C12 utilisent le T0 du MÊME échantillon.
- Le T0 du témoin ne doit **jamais** devenir la référence Persoz d'un échantillon exposé.
- Témoin (T) exclu de toutes les moyennes et agrégations.
- **Couleur** : conserver L\*, a\*, b\* ; calculer ΔL\*, Δa\*, Δb\*, ΔE\*ab ; référence = T0 du même échantillon ; 4 points d'aspect (cl. 6.3.2 NF EN 927-6).
- **Brillance** : mesure brute + évolution + rétention (cl. 6.3.3 / ISO 2813).
- **Adhérence** : ISO 2409:2020, échelle 0–5, mesures à T0 et C12 uniquement.
- **QUV** : 1 jalon = 168 h ; C1 = 168 h … C12 = 2016 h ; T0 et C12 obligatoires.
- **Référentiel** : NF EN 927-6 = référence principale ; INFIPERF (FCBA 2024) = **complémentaire**, jamais présenté comme exigence NF EN 927-6 ; NF EN 927-3 hors périmètre QUV.
- Les mesures brutes (RAW) sont immuables après saisie ; un statut `SUSPECT` est conservé.
- Règles non ambiguës → appliquer. Règle ambiguë/source manquante → **ne pas inventer**, signaler `🔵 DONNÉES/RÈGLE INSUFFISANTES` et demander validation humaine.

## 3. Interdictions absolues

- Ne jamais supprimer, désactiver ou affaiblir un test pour faire passer la CI.
- Ne jamais modifier un critère scientifique pour faire passer le code.
- Ne jamais transformer une hypothèse en règle.
- Ne jamais merge automatiquement une modification scientifique critique (PR seule, validation humaine obligatoire).

## 4. DEV REPORT de fin de développement (obligatoire)

À chaque tâche de DEV terminée (CORRECTIF / EVOLUTION / REFACTOR, y compris AUDIT avec PR),
publier un commentaire DEV REPORT sur la PR créée/mise à jour, dans cet ordre impératif :

1. modifier le code ;
2. exécuter les validations (`npm ci`, `npm run lint`, `npm test`, `npm run build`) ;
3. commit ;
4. push ;
5. créer/mettre à jour la PR ;
6. **puis** publier le DEV REPORT en commentaire sur cette PR (via l'accès GitHub de l'exécution,
   `use_github_token: true`).

Le rapport contient uniquement des informations correspondant à l'état réellement produit.
Bloc machine strictement délimité (modèle canonique : `docs/opencode/DEV_REPORT_TEMPLATE.md`) :

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

Interdits dans le DEV REPORT :
- écrire `AUDIT: PASS` ou toute conclusion/validation scientifique (la validation appartient à ChatGPT) ;
- inventer une donnée de test (`TEST_COUNT` = résultat réel de `npm test`) ;
- référencer des fichiers non réellement modifiés.

`STATUS` / `RECOMMENDATION` restent des jugements de **DEV** (tests + build).
Règle ambiguë/source manquante → `🔵 DONNÉES/RÈGLE INSUFFISANTES`, validation humaine.

Références internes : `docs/architecture/ARCHITECTURE.md`, `docs/agents/WORKFLOW.md`,
`docs/agents/AGENTS.md`, `docs/opencode/DEV_REPORT_TEMPLATE.md`, `docs/audits/`,
`docs/decisions/DECISIONS.md`, `src/scientific/ruleSet.ts`.