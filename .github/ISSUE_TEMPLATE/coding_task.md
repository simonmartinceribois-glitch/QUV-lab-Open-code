---
name: "Tâche de codage (OpenCode)"
about: "Coding Task Contract — à remplir par ChatGPT / analyste puis labelliser et lancer via /oc fix this"
title: "[TASK] <objectif court>"
labels: ["opencode"]
---

## Coding Task Contract

```text
TASK_ID: <réf courte, ex. T-2026-xxxx>
TYPE: AUDIT | CORRECTIF | EVOLUTION | REFACTOR
OBJECTIVE: <but concret, 2-3 lignes>
CONTEXT: <décisions/contexte de la conversation à conserver, compact>
SCIENTIFIC_RULES: <règles QUV-Lab applicables (réf. AGENTS.md)>
FILES: <fichiers concernés, chemins relatifs>
EXPECTED_CHANGE: <comportement attendu avant/après>
TEST_REQUIREMENTS: <tests à ajouter / suites à exécuter>
ACCEPTANCE_CRITERIA: <critères mesurables de réussite>
SOURCE_CONVERSATION: <lien/réf. de la conversation ChatGPT>
```

---

### Détail de la tâche

- **Règles scientifiques à respecter absolument** (voir `AGENTS.md`) :
  - Persoz interdit sur le témoin T ; uniquement E1/E2/E3, T0 propre à chaque échantillon exposé.
  - Jamais le T0 du témoin comme référence pour un échantillon exposé.
  - Couleur : L*, a*, b*, ΔL*, Δa*, Δb*, ΔE*ab, référence T0 du même échantillon.
  - QUV : C1 = 168 h … C12 = 2016 h ; T0 et C12 obligatoires.
  - NF EN 927-6 = référence normative principale ; INFIPERF (FCBA 2024) = complémentaire.
  - Aucune modification scientifique arbitraire pour faire passer les tests.

### Lancement

Après création : ajouter le label `opencode` (si non posé automatiquement), puis commenter :

```text
/oc fix this
```

OpenCode lit ce fil, exécute, lance les tests, ouvre une PR et répond ici avec le résultat.