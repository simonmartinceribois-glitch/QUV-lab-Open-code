# QUV-Lab — CONTRAT SCIENTIFIQUE CENTRAL (référence commune des agents)

> Statut : **référence d'orientation, pas seconde source normative.**
> Les sources de vérité restent : `NF EN 927-6` (norme), `INFIPERF – FCBA 2024`
> (complément), et le code (`src/scientific/*`, `src/types/*`). Ce document
> pointe vers elles et ne duplique aucune valeur normative autre que les
> tableaux imposés ci-dessous (jalons, statuts, contrôles).

## 1. Hiérarchie

```text
ESSAI → LOTS → ÉCHANTILLONS → JALONS → MESURES
```

Référence modèle : `src/types/trial.ts` (`Trial { metadata, config, stages[],
batches[], acquisitions{}, auditTrail[] }`).

## 2. Distinctions obligatoires

```text
MESURE BRUTE ≠ VALEUR CALCULÉE ≠ CRITÈRE NF EN 927-6 ≠ CRITÈRE INFIPERF
  ≠ OBSERVATION ≠ ANALYSE / CONCLUSION
```

- Brute (RAW) : saisie paillasse, gelée, jamais mutée (`recalculator.ts`).
- Calculée (COMPUTED) : moteur versionné (`ruleSet.ts`), traçée (`referenceTrace`).
- Critère NF EN 927-6 : exigence normative (`NORMATIVE_REQUIREMENT`).
- Critère INFIPERF : complément explicite (`LAB_RECOMMENDATION`), jamais
  présenté comme exigence NF EN 927-6.
- Observation : cotation ISO 4628 / ISO 2409 (constat, pas mesure physique).
- Analyse/conclusion : interprétation, jamais une donnée.

## 3. QUV — jalons déterministes

`scheduledExposureHours = cycleIndex × 168` (`trialStages.ts`) :

```text
T0 = 0 h (obligatoire, référence initiale)
C1 = 168 h / C2 = 336 h / C3 = 504 h / C4 = 672 h / C5 = 840 h
C6 = 1008 h / C7 = 1176 h / C8 = 1344 h / C9 = 1512 h / C10 = 1680 h
C11 = 1848 h / C12 = 2016 h (obligatoire, jalon final)
```

T0 et C12 ne sont jamais INACTIVE. `INACTIVE` = cycle conservé, exclu du plan.
`actualExposureHours` : compatibilité historique uniquement, jamais source
scientifique (voir PR #80).

## 4. PERSOZ (`LAB_RECOMMENDATION`, ISO 1522 — jamais exigence NF EN 927-6)

- Aucune mesure Persoz sur le Témoin ; E1/E2/E3 uniquement (`panelUtils.ts`).
- Chaque échantillon exposé utilise son PROPRE T0 comme référence ; le T0 du
  Témoin ne sert jamais de référence Persoz pour E1/E2/E3.
- 3 répétitions conservées ; mesures individuelles + moyenne + dispersion
  conservées ; valeurs calculées tracées.
- Variation relative nulle/non calculable → `null`, jamais `0` ; vrai `0` conservé.

## 5. COULEUR

- Conserver L\*, a\*, b\* ; calculer ΔL\*, Δa\*, Δb\*, ΔE\*ab (CIE 1976).
- Référence initiale du MÊME échantillon (ISO 7724, D65/10°).

## 6. BRILLANT (géométrie 60°, ISO 2813)

- Mesure brute → évolution (ΔGloss) → rétention (%).
- Tout seuil de rétention est un critère INFIPERF, explicitement identifié
  comme tel, jamais comme exigence NF EN 927-6.

## 7. ASPECT

Aspect général, cloquage, écaillage, fissuration (craquelage), farinage
(ISO 4628), adhérence au quadrillage classes 0–5 (ISO 2409, T0/T et C12/E1-E3
uniquement), observations, photographies.

## 8. STATUTS

```text
🟢 Favorable / 🟠 À surveiller / 🔴 Défavorable
🔵 Données insuffisantes / ⚠️ Anomalie à vérifier
```

## 9. CONTRÔLES

Unicité lots ; format codes ; présence échantillons ; cohérence
jalons/cycles/heures ; mesures manquantes ; doublons ; unités ; valeurs
aberrantes ; association lot/échantillon/jalon ; cohérence dates.
Données ou règle ambiguë → 🔵 DONNÉES/RÈGLE INSUFFISANTES, validation
humaine requise (ne jamais inventer).
