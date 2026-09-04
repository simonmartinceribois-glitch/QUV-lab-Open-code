# SPEC — fix/tab03-referentiel (LOW, base `develop`)

> Demande utilisateur : retirer l'encadré « RÉFÉRENTIEL NORMATIF DU MODULE QUV » de l'onglet 03.

## 1. Modifications (`Tab03Protocol.tsx` seul, affichage)

- Encadré L98-209 supprimé (titre, badge NORMATIF, 4 cartes 927-6/927-3/P23-305/INFIPERF, principes).
- Import `ShieldCheck` retiré (inutilisé). Cartes Familles et reste de l'onglet intacts.
- Référentiel de données (`ruleSet`, moteurs) intact : seul le panneau d'affichage est retiré.

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle onglet 03.
