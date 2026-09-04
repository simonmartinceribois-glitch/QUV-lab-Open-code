# QUV-Lab — WORKFLOW (PLANIFIER → MERGER)

## 1. Chaîne canonique

```text
ANALYSE → PLAN → VALIDATION PLAN (si MEDIUM/HIGH) → BRANCHE → DÉVELOPPEMENT →
TEST → AUDIT → CORRECTION → SECOND TEST → PULL REQUEST → VALIDATION HUMAINE → MERGE
```

Jamais de dev direct sur `main`. Branches : `main / develop / feature/* / fix/* / refactor/* / audit/*`.

## 2. Étapes (QUV-Lab)

1. **ANALYSE (READ ONLY)** : lire `docs/architecture/ARCHITECTURE.md`, `docs/audits/INITIAL_AUDIT.md`,
   `src/types/*`, moteurs et onglets concernés, état Git. Ne rien modifier.
2. **PLAN** : objectif, fichiers concernés, dépendances, risques, plan d'implémentation, tests nécessaires
   → `docs/specifications/<SUJET>.md`.
3. **VALIDATION PLAN** : obligatoire si HIGH (données, calculs, persistance, exports, normatif).
4. **BRANCHE** : `fix/gate22-temoin-jalons`, `fix/scripts-windows`, `refactor/trialstore-split`, etc.
5. **DÉVELOPPEMENT** : Developer seul écrivain, périmètre strict de la spec.
6. **TEST** : commandes réelles uniquement — `npm run lint` (= `tsc --noEmit`), `npm test` (= `tsx run_tests.ts`),
   `npm run build`. Référence : 193 tests / 12 suites. Mettre à jour `test-results.txt`.
7. **AUDIT** : Auditor produit `docs/audits/<DATE>_<SUJET>.md`.
8. **CORRECTION** : Developer corrige ; jamais de test supprimé/désactivé pour verdir.
9. **SECOND TEST** : rejouer l'intégralité + build.
10. **PR** : objectif, modifications, fichiers principaux, résultats tests, limites éventuelles.
11. **VALIDATION HUMAINE + MERGE** : obligatoire pour tout HIGH.

## 3. Niveaux de risque

- **LOW** (typo, label UI, ex. corriger "Tests UX (20)" / "Tests Calculs (22)" en `App.tsx:91-104`) :
  `Developer → tests → PR`.
- **MEDIUM** (nouveau composant/fonction, logique existante, ex. split `TabPhotographs.tsx`, exports CSV) :
  `Architect → Developer → Tester → Auditor → PR`.
- **HIGH** (modèle de données, calcul scientifique, persistance, exports normatifs, migration, Gate 2.2 A2/A3/B2) :
  `Architect → validation humaine → Developer → Tester → Auditor → 2ᵉ audit si besoin → PR → validation humaine → merge`.

## 4. Premiers tickets recommandés (issus de l'audit)

1. `fix/gate22-temoin-jalons` (HIGH) : corriger A2/A3/B2, régénérer `test-results.txt` + manifest.
2. `fix/scripts-typing` (MEDIUM) : `clean` compatible Windows, `typecheck` séparé, `strict:true`,
   retirer `| string` des unions (`trial.ts:43-70`), `build` avec `tsc`.
3. `fix/test-transparency` (LOW) : labels UI + `ScientificTestsViewer` couvrant les 12 suites.
4. `refactor/prune-deps` (MEDIUM) : statuer sur `express/dotenv/@google/genai` (0 usage `src/`).
5. `refactor/trialstore-split` (MEDIUM) : découper `trialStore.ts` (store / seed / migration / photos).
