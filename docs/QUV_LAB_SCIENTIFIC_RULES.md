# QUV-Lab — Règles scientifiques

**Statut : SOURCE DE VÉRITÉ SCIENTIFIQUE ET DOCUMENTAIRE**

## 1. Rôle de S0

`QUV_LAB_SCIENTIFIC_RULES.md` constitue la source de vérité scientifique et documentaire de QUV-Lab.

Il définit les règles scientifiques qui gouvernent :

* les données expérimentales ;
* les calculs ;
* les critères ;
* les analyses ;
* les conclusions et restitutions.

S0 n'est pas un moteur d'exécution.

## 2. Architecture scientifique S0 → S5

```text
S0 = SOURCE DE VÉRITÉ SCIENTIFIQUE / DOCUMENTAIRE

S1 = RAW
     données expérimentales réellement acquises

S2 = COMPUTED
     validation, calculs déterministes, statistiques

S3 = CRITÈRE
     application des règles normatives / complémentaires

S4 = ANALYSE
     tendances, comparaisons, anomalies, interprétation

S5 = CONCLUSION / RESTITUTION / UI
```

Chaîne d'exécution :

```text
S1 RAW
   ↓
S2 COMPUTED
   ↓
S3 CRITÈRE
   ↓
S4 ANALYSE
   ↓
S5 CONCLUSION / RESTITUTION
```

S0 définit les règles de cette chaîne mais ne constitue pas une étape de traitement des données.

## 3. Hiérarchie de référence

```text
QUV_LAB_SCIENTIFIC_RULES.md
          │
          ├──► CODE MÉTIER
          │       └── implémentation
          │
          ├──► TESTS
          │       └── vérification
          │
          └──► RAPPORTS / UI
                  └── restitution
```

Principes :

* S0 définit les règles ;
* le code les implémente ;
* les tests vérifient leur conformité ;
* les rapports et l'interface les restituent.

## 4. Références scientifiques

### NF EN 927-6:2018

Référence normative principale pour le périmètre QUV-Lab.

### INFIPERF FCBA 2024

Référence complémentaire lorsqu'elle est applicable.

Elle ne doit pas être présentée comme équivalente à la référence normative principale.

## 5. Durées scientifiques QUV

```text
T0  =    0 h
C1  =  168 h
C2  =  336 h
C3  =  504 h
C4  =  672 h
C5  =  840 h
C6  = 1008 h
C7  = 1176 h
C8  = 1344 h
C9  = 1512 h
C10 = 1680 h
C11 = 1848 h
C12 = 2016 h
```

Formule :

```text
durée scientifique = numéro du cycle × 168 h
```

`scheduledExposureHours` représente la durée scientifique du jalon.

`actualExposureHours` représente la durée réellement constatée sur la machine lorsqu'elle est disponible.

La durée réelle machine ne remplace jamais la durée scientifique.

Une durée machine absente ne rend pas nulle ou inconnue une durée scientifique déjà déterminée.

T0 = 0 h est une valeur scientifique valide.

Aucune anomalie scientifique artificielle ne doit être créée uniquement à partir d'un écart entre durée scientifique programmée et durée machine réelle.

## 6. Séparation RAW / COMPUTED / CRITÈRE / ANALYSE / CONCLUSION

### RAW

Données réellement acquises pendant l'expérimentation.

### COMPUTED

Résultats déterministes issus des données RAW :

* validation ;
* calculs ;
* statistiques ;
* agrégations définies.

### CRITÈRE

Application des règles normatives ou complémentaires.

### ANALYSE

Interprétation des résultats disponibles :

* tendances ;
* comparaisons ;
* anomalies ;
* évolution temporelle ;
* interprétation.

### CONCLUSION

Restitution scientifique finale.

## 7. Observations visuelles

Chaîne :

```text
RAW
 ↓
observationsEngine
 ↓
VisualObservationsComputedData
 ↓
ANALYSE
```

Une donnée déjà calculée dans COMPUTED doit être consommée depuis COMPUTED.

Les couches analytiques ne doivent pas recalculer localement une donnée déjà produite par le moteur.

## 8. Contrat VisualObservationsComputedData

Le contrat comprend notamment :

```text
totalEvaluated
defectsCount
maxRating
summary

qualityAssessment {
  status
  validCount
  expectedCount
  actualCount
  suspectCount
  invalidCount
  missingCount
  completenessPercent
  warnings
}

protocolStatus
computation
referenceTrace?
perCategoryMaxRating?
```

`perCategoryMaxRating` contient le maximum valide par catégorie.

Règles :

* domaine valide 0 à 5 ;
* maximum calculé uniquement sur les valeurs valides ;
* catégorie sans donnée valide = catégorie absente ;
* absence de donnée ≠ 0 ;
* donnée invalide ≠ 0 ;
* un vrai 0 est conservé ;
* aucune valeur 0 ne doit être fabriquée.

Le champ peut être absent dans certaines données historiques pour assurer la rétrocompatibilité.

## 9. Invariants des observations

### INV-OBS-01

Les données RAW sont conservées.

### INV-OBS-02

Les données COMPUTED restent traçables vers les données RAW lorsque cette traçabilité est disponible.

### INV-OBS-03

Aucune cotation valide → `maxRating = null`.

### INV-OBS-04

Une cotation réelle égale à 0 → `maxRating = 0`.

### INV-OBS-05

Une cotation positive valide est conservée.

### INV-OBS-06

`null`, `undefined`, vide ou absence → donnée manquante.

### INV-OBS-07

Valeur non numérique, non finie ou hors domaine → donnée invalide.

### INV-OBS-08

Le maximum porte uniquement sur les valeurs valides.

### INV-OBS-09

Pour `null + invalid + 0 + 2` :

```text
maxRating = 2
validCount = 2
```

### INV-OBS-10

Si :

```text
RAW = 5
COMPUTED = 2
```

le consommateur utilise :

```text
2
```

et ne reconstruit pas `5` depuis RAW.

### INV-OBS-11

L'absence de RAW n'empêche pas l'utilisation d'un COMPUTED valide lorsqu'il est disponible.

### INV-OBS-12

L'agrégation exposée concerne E1/E2/E3 et exclut le témoin T.

## 10. Neutralité de COMPUTED

COMPUTED ne doit pas porter de verdict technique ou normatif.

Ne pas y introduire de jugement tel que :

```text
FAVORABLE
DEFAVORABLE
CONFORME
NON CONFORME
```

COMPUTED ne doit pas contenir de critère normatif ou complémentaire.

COMPUTED ne doit pas contenir de conclusion technique.

`qualityAssessment.status` décrit exclusivement la qualité, la complétude ou la fiabilité des données/calculs. Il ne constitue pas un critère scientifique ni une conclusion technique.

Statuts validés par l'implémentation (PR #92, PR #93) :

```text
GOOD
ACCEPTABLE
WARNING
INVALID
```

Ces quatre statuts sont des statuts de qualité des données et/ou des calculs uniquement.

Ils ne constituent jamais :

* un verdict normatif ;
* une conformité/non-conformité ;
* un jugement favorable/défavorable ;
* une conclusion de performance ;
* une conclusion de comportement du système.

## 11. Statistiques

Les statistiques utilisent uniquement les valeurs valides.

Règles :

* une donnée manquante n'est jamais transformée en 0 ;
* le `n` réel doit être conservé ;
* l'écart-type échantillonnal utilise `n-1` lorsque pertinent ;
* l'écart-type population n'est utilisé que lorsque le contexte le justifie explicitement ;
* le coefficient de variation est :

```text
CV = SD / |moyenne| × 100
```

lorsque la moyenne est non nulle.

Protéger les calculs contre :

* division par zéro ;
* NaN ;
* Infinity ;
* tableaux vides ;
* données insuffisantes.

Pour `n = 1` :

* la moyenne est calculable ;
* l'écart-type échantillonnal n'est pas calculable ;
* le CV n'est pas calculable si le SD n'est pas disponible.

Une « moyenne des moyennes » ne doit pas recevoir implicitement une pondération non définie.

## 12. Brillance

Mesure à 60°.

Conserver les valeurs RAW disponibles aux différents jalons.

```text
ΔGloss = Gloss_jalon - Gloss_initial
```

```text
Rétention = Gloss_jalon / Gloss_initial × 100
```

Si le gloss initial est égal à 0 :

```text
rétention = non calculable
```

Ne jamais transformer ce cas en 0.

Conserver des dénominateurs distincts :

```text
glossCount
glossDeltaCount
glossRetentionCount
```

La rétention du brillant constitue un indicateur complémentaire lorsqu'elle est applicable.

Le seuil de 50 % doit rester associé à son contexte complémentaire applicable.

## 13. Couleur

Données RAW :

```text
L*
a*
b*
```

Calculs :

```text
ΔL*
Δa*
Δb*
ΔE*ab
```

Les calculs doivent rester traçables aux valeurs sources.

La référence initiale doit correspondre à l'échantillon concerné lorsqu'une référence individuelle est définie.

Aucune substitution silencieuse du T0 d'un autre échantillon.

## 14. PERSOZ

Le PERSOZ :

* n'est jamais mesuré sur le témoin T ;
* est mesuré uniquement sur E1/E2/E3 ;
* est suivi de T0 à C12 ;
* comporte 3 répétitions par échantillon.

Comparaisons :

```text
E1 T0 → E1 Cx
E2 T0 → E2 Cx
E3 T0 → E3 Cx
```

Une division par zéro rend l'évolution relative non calculable.

Une variation ne constitue pas automatiquement une amélioration ou une dégradation.

L'interprétation doit considérer notamment :

* direction ;
* amplitude ;
* dispersion ;
* évolution temporelle ;
* autres indicateurs disponibles.

Le PERSOZ relève d'une référence complémentaire lorsqu'elle est applicable.

## 15. ADHÉSION

L'adhésion comporte exactement quatre mesures RAW par lot :

```text
T0 témoin T
C12 E1
C12 E2
C12 E3
```

Aucune mesure d'adhésion n'est réalisée aux jalons C1 à C11.

Comparaison :

```text
T0(T témoin)
       ↓
C12(E1/E2/E3)
```

Ne jamais fabriquer une mesure absente.

La référence T0 de l'adhésion est distincte de la référence T0 utilisée pour le PERSOZ.

## 16. Analyse temporelle

L'analyse doit utiliser les jalons réellement disponibles.

Une mesure intermédiaire absente n'est pas automatiquement une anomalie.

Aucune interpolation ne doit être créée.

Des séquences telles que :

```text
T0 → C1 → C4 → C8 → C12
```

ou :

```text
C1 → C8 → C12
```

peuvent être analysées lorsqu'elles correspondent aux données réellement acquises.

Les analyses peuvent rechercher notamment :

* stabilité ;
* évolution progressive ;
* accélération ;
* apparition tardive ;
* rupture de tendance ;
* comportement atypique.

La durée machine réelle ne modifie pas le jalon scientifique.

## 17. Analyse inter-systèmes / inter-familles

L'analyse doit être dynamique et fondée uniquement sur les données disponibles.

Ne mentionner que les indicateurs effectivement présents.

Si aucune donnée exploitable n'est disponible :

```text
Aucune conclusion scientifique ne peut être établie.
```

Les comparaisons peuvent intégrer conjointement les indicateurs disponibles :

* couleur ;
* brillance ;
* PERSOZ ;
* aspect / défauts ;
* adhésion ;
* évolution temporelle.

Une conclusion globale ne doit pas être fondée sur un seul indicateur.

Une co-occurrence ne constitue pas une preuve de causalité.

## 18. Données manquantes

Principe général :

```text
missing ≠ 0
invalid ≠ 0
not evaluated ≠ 0
```

Une donnée absente ne doit jamais être silencieusement transformée en mesure.

## 19. Traçabilité et versionnement

Les calculs doivent être identifiables et traçables.

Les versions des règles scientifiques et des moteurs de calcul doivent pouvoir être distinguées.

Version actuelle du moteur d'observations :

```text
1.3.0
```

Les modifications scientifiques doivent rester traçables dans le temps.

## 20. Gouvernance scientifique

Toute nouvelle règle scientifique suit :

```text
définition
   ↓
validation
   ↓
documentation S0
   ↓
implémentation
   ↓
tests
   ↓
analyse / rapport / UI
```

Une règle ne doit pas être considérée comme scientifiquement validée uniquement parce qu'elle existe déjà dans le code.

## 21. Principe général de non-invention

Le document ne doit pas introduire de règle scientifique nouvelle non validée.

Ne pas inventer :

* seuil ;
* critère ;
* formule ;
* méthode statistique ;
* règle de décision ;
* interprétation scientifique.

Lorsqu'une règle n'est pas suffisamment définie :

```text
À DÉFINIR / À VALIDER
```