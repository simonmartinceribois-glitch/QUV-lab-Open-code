# SPEC — remove-tab07 (HIGH, suppression validée, base `develop`)

> Décision utilisateur (2026-09-04) : suppression de l'onglet 07 Contrôle Qualité entier.
> Justification : bannière redondante (principe déjà porté par les vues résultats) et
> section par lot = stubs non implémentés (« Donnée non calculée », « Critère non implémenté »).

## 1. Modifications (Developer)

- `TrialDetailView.tsx` : retirer import `Tab07QualityControl`, entrée `{ id: '07', … }`,
  bloc de rendu `{activeTab === '07' && …}`. Nettoyer `ShieldCheck` si inutilisé ailleurs.
- Supprimer `trial-tabs/Tab07QualityControl.tsx` (`git rm`).

## 2. Intouchables

- `scientific/qualityEngine.ts` (assessStageQuality/TrialQuality) : utilisé par les tests
  gate34/40/52/53/54 + scientificEngine — **conservé tel quel**.
- `TrialDetailView` : les 9 autres onglets + `activeTab` par défaut (`'06'`) inchangés.

## 3. Tests

`typecheck` (0 — détecte toute référence restante), `npm test` (195/195),
`build` OK + vérif visuelle (onglets 01-06, PHOTO, 08, 09 ; plus de 07).
