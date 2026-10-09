# SPEC — fix/calendar-status-text (LOW, base `develop`)

> Bug remonté : Tab04 affiche « 1 validée(s) • Toutes étapes terminées » alors que des
> jalons ne sont pas commencés. Cause : `Tab04Calendar.tsx:96` conclut « terminées » dès
> qu'aucune étape n'est `IN_PROGRESS`.

## 1. Modifications (Developer, `Tab04Calendar.tsx` seul, affichage)

- Calculer `allMeasuredValidated = measuredStages.length > 0 && measuredStages.every(...)`.
- Texte : si `inProgressStage` → `Étape active : X` (inchangé) ; sinon si `allMeasuredValidated`
  → `Toutes étapes terminées` ; sinon → `Prochaine étape : <nom du 1er jalon mesuré non validé>`.

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle (T0 seul validé →
« Prochaine étape : … » ; tout validé → « Toutes étapes terminées »).
