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

Les règles de l'Annexe A (A.1 à A.8, voir section 15) sont des règles normatives issues de cette norme.

### Normes référencées par l'Annexe A

Elles ne sont pas des références normatives de premier niveau du protocole QUV-Lab, mais des références de méthode appelées par l'Annexe A de NF EN 927-6:2018 :

* ISO 4628-1:2016 (échelle d'évaluation de l'aspect général, Tableau 2) ;
* ISO 4628-2 (cloquage) ;
* ISO 4628-4 (craquelage / fissuration) ;
* ISO 4628-5 (écaillage) ;
* ISO 4628-6 (farinage) ;
* EN ISO 2409 (adhérence — essai au quadrillage) ;
* EN ISO 2813 (mesure du brillant) ;
* ISO 18314-1 (mesure colorimétrique).

### INFIPERF FCBA 2024

Référence complémentaire lorsqu'elle est applicable.

Elle ne doit pas être présentée comme équivalente à la référence normative principale.

Un critère complémentaire ne doit jamais être élevé au rang d'exigence normative NF EN 927-6.

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

## 6. Séparation RAW / COMPUTED / CRITÈRE / ANALYSE / CONCLUSION / RESTITUTION

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

La restitution (S5) est distincte du calcul interne : elle présente les valeurs conformément aux règles de restitution normatives définies par propriété (voir section 15).

Les analyses, les rapports et l'interface ne doivent pas recalculer localement une donnée déjà produite par une couche définie.

## 7. Distinction des sources et des rôles

Le S0 distingue explicitement cinq catégories.

Aucune règle interne QUV-Lab ne doit être présentée comme une exigence NF EN 927-6.

Aucun paramètre de protocole ne doit être présenté comme une exigence universelle.

```text
A. EXIGENCE NORMATIVE
     Règle explicitement issue de NF EN 927-6:2018 ou d'une méthode d'essai
     référencée par celle-ci.

B. RÈGLE SCIENTIFIQUE QUV-LAB
     Règle interne garantissant la traçabilité, l'intégrité des données,
     les calculs ou l'analyse.

C. PARAMÈTRE DU PROTOCOLE DE L'ESSAI
     Choix expérimental défini lors de la création d'un essai.

D. CALCUL / STATISTIQUE
     Transformation déterministe des données RAW selon le protocole
     et les règles scientifiques.

E. RESTITUTION
     Format d'affichage ou de présentation du résultat.
```

Toute règle dont la source ou l'interprétation normative n'est pas suffisamment établie est écrite explicitement :

```text
À DÉFINIR / À VALIDER SCIENTIFIQUEMENT
```

Aucune exigence minimale imposée par une méthode normative ne peut être contournée par un paramètre de protocole.

## 8. Règle générale : nombre de mesures paramétrable

Le nombre de mesures n'est pas une constante universelle figée de QUV-Lab.

Pour les familles suivantes :

* adhérence ;
* couleur ;
* brillance ;
* PERSOZ ;

le nombre de mesures peut être défini par le protocole expérimental lors de la création de l'essai, lorsque le protocole le prévoit.

Chaîne scientifique :

```text
Référentiel scientifique
        ↓
Protocole de l'essai
        ↓
Paramètres d'acquisition
        ↓
Mesures RAW
        ↓
Calculs COMPUTED
        ↓
Critères éventuels
        ↓
Analyse
        ↓
Restitution
```

Le paramètre du nombre de mesures appartient au protocole de l'essai et est conservé avec celui-ci.

Exemples conceptuels :

```text
adhérence : nombre de mesures par panneau
couleur   : nombre de mesures par panneau
brillance : nombre de mesures selon la structure méthodologique retenue,
             notamment par direction lorsque cela est applicable
PERSOZ    : nombre de mesures individuelles / répétitions par échantillon
```

Paramétrable ≠ libre de toute contrainte normative :

Le paramétrage ne doit jamais permettre de contourner une exigence minimale imposée par NF EN 927-6 ou par une méthode d'essai applicable.

Si une méthode normative impose un minimum, ce minimum reste applicable et le paramètre du protocole doit le respecter.

Verrouillage du paramètre :

Le nombre de mesures défini lors de la création du protocole est conservé avec l'essai.

Il constitue la référence pour :

* la complétude ;
* la validation des acquisitions ;
* les contrôles de cohérence ;
* les calculs statistiques ;
* les moyennes ;
* les écarts-types lorsque applicables ;
* les restitutions ;
* la traçabilité.

Après la première acquisition scientifique, une modification silencieuse du nombre de mesures n'est pas autorisée.

Toute évolution ultérieure doit préserver l'historique et la traçabilité.

Aucune procédure technique de modification n'est définie dans le présent S0.

### 8.1 Protocole standard et protocole adapté

Chaîne de référence scientifique :

```text
RÉFÉRENCE SCIENTIFIQUE / NORMATIVE
        ↓
PROTOCOLE RÉEL DE L'ESSAI
        ↓
NOMBRE CONFIGURÉ
        ↓
STATUT D'ADAPTATION
        ↓
JUSTIFICATION
        ↓
RAW
        ↓
COMPUTED
```

Le nombre de mesures configuré pour une famille est comparé à la référence scientifique de cette famille.

`PROTOCOLE STANDARD` : le nombre de mesures configuré correspond à la référence scientifique de la famille.

`PROTOCOLE ADAPTÉ` : le nombre de mesures configuré s'écarte de la référence scientifique de la famille.

Toute adaptation doit être :

* explicitement identifiée ;
* persistée avec l'essai ;
* justifiée ;
* traçable ;
* visible dans la restitution concernée.

### 8.2 Justification d'adaptation (règle P5)

Une justification d'adaptation est formellement valide à partir de 8 caractères, après suppression des espaces en début et fin de chaîne :

```text
""                  → invalide
"1"                 → invalide
"1234567"            → invalide
"       1234567"    → invalide
"12345678"           → valide
" 12345678 "         → valide
```

Le S0 ne juge pas la pertinence scientifique de la justification.

Le logiciel vérifie uniquement le minimum formel de longueur.

## 9. Neutralité de COMPUTED

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

## 10. Statistiques

Les statistiques utilisent uniquement les valeurs valides.

Les calculs statistiques utilisent :

* uniquement les mesures RAW valides ;
* le nombre de mesures défini par le protocole de l'essai (voir section 8) ;
* le nombre réel de valeurs disponibles.

Règles :

* seules les valeurs valides sont utilisées ;
* une valeur manquante n'est jamais transformée en 0 ;
* une valeur invalide n'est jamais transformée en 0 ;
* le `n` réel doit être conservé ;
* `n` correspond au nombre réel de données utilisées ;
* la moyenne est possible si au moins une donnée valide est disponible ;
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

Un tableau vide représente une absence de donnée exploitable.

Pour `n = 1` :

* la moyenne est calculable ;
* l'écart-type échantillonnal n'est pas calculable ;
* le CV n'est pas calculable si le SD n'est pas disponible.

Une « moyenne des moyennes » ne doit pas recevoir implicitement une pondération.

Si plusieurs moyennes sont agrégées, le S0 doit préciser si elles ont le même poids ou si une pondération par le nombre d'observations est nécessaire.

Une moyenne des moyennes n'est calculée que si la règle scientifique correspondante est explicitement définie.

Si la règle scientifique de pondération n'est pas définie :

```text
À DÉFINIR / À VALIDER
```

## 11. Données manquantes

Principe général :

```text
missing ≠ 0
invalid ≠ 0
not evaluated ≠ 0
```

Une donnée absente ne doit jamais être silencieusement transformée en mesure.

Une absence de mesure ne doit jamais produire artificiellement une mesure nulle.

Cette distinction s'applique à toutes les propriétés A.1 à A.8 de l'Annexe A (section 15).

## 12. Observations visuelles

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

## 13. Contrat VisualObservationsComputedData

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

`maxRating` est un indicateur de sévérité maximale. Il ne constitue pas par lui-même une métrique moyenne normative (voir section 15, A.3 à A.6).

## 14. Invariants des observations

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

## 15. Annexe A — NF EN 927-6:2018

La présente section applique à l'Annexe A de NF EN 927-6:2018 la distinction des sources définie aux sections 7 et 8 : exigence normative / règle scientifique QUV-Lab / paramètre du protocole de l'essai / calcul / restitution.

Toute règle dont la source ou l'interprétation normative n'est pas suffisamment établie est explicitement identifiée comme :

```text
À DÉFINIR / À VALIDER SCIENTIFIQUEMENT
```

Aucune règle minimale ou exigence normative n'est contournée par un paramètre de protocole.

### 15.1 Règles transversales de l'Annexe A

Les règles suivantes s'appliquent à l'ensemble des propriétés A.1 à A.8 :

* **RAW** : les mesures individuelles réellement acquises sont conservées ;
* **COMPUTED** : les calculs déterministes (moyennes, écarts-types, variations, Δ, statistiques, agrégations définies) sont effectués avec la précision nécessaire, sans arrondi prématuré et sans verdict ;
* **CRITÈRE (S3)** : application des règles normatives ou complémentaires explicitement définies ;
* **ANALYSE (S4)** : tendances, évolutions, stabilité, accélération, apparition tardive, rupture de tendance, comparaisons entre systèmes ;
* **CONCLUSION / RESTITUTION (S5)** : restitution scientifique finale conforme aux règles de restitution normatives définies par propriété ;
* **données manquantes** : `missing ≠ 0`, `invalid ≠ 0`, `not evaluated ≠ 0` dans toutes les propriétés A.1 à A.8 ;
* **traçabilité** : chaque valeur restituée reste traçable vers les valeurs sources RAW via des calculs COMPUTED définis ;
* **normatif / complémentaire** : les règles de l'Annexe A sont des règles normatives (NF EN 927-6:2018) ; un critère complémentaire (INFIPERF FCBA 2024) n'est jamais élevé au rang d'exigence normative ;
* **source / rôle** : pour chaque propriété, le S0 distingue la source normative, le protocole QUV-Lab, le calcul et la restitution conformément à la section 7 ;
* **paramètre de protocole** : le nombre de mesures est un paramètre du protocole de l'essai (section 8) et ne peut pas contourner une exigence normative minimale.

### 15.2 A.1 — Brillant

Mesure :

```text
angle 60°
```

Règles de mesure :

Deux séries sont distinguées.

Série 1 :

* au minimum deux mesures ;
* dans des zones distinctes ;
* faisceau strictement parallèle au fil du bois ;
* orientation sémantique : `GRAIN_DIRECTION`.

Série 2 :

* au minimum deux mesures supplémentaires ;
* dans des zones adjacentes ;
* instrument retourné de 180° par rapport à la première série ;
* faisceau toujours strictement parallèle au fil du bois ;
* orientation sémantique : `OPPOSITE_GRAIN_DIRECTION`.

La seconde série constitue une mesure dans la direction opposée à 180° par rapport à la première série, tout en restant strictement parallèle au fil du bois.

Nombre de mesures (paramètre du protocole de l'essai, section 8) :

* le nombre de mesures de brillance est défini par le protocole de l'essai, sous réserve des exigences méthodologiques applicables ;
* si plusieurs directions sont requises, le paramétrage respecte cette structure (au minimum deux mesures dans chacune des directions) et ne supprime pas une exigence méthodologique.

Traitement :

* calcul de la moyenne ;
* exploitation des mesures avant et après exposition ;
* variation entre avant et après.

Panneaux :

* les trois panneaux exposés E1/E2/E3 ;
* le panneau de référence non exposé.

Statistiques : moyenne et écart-type lorsque requis.

Distinction des couches :

```text
RAW         → mesures individuelles réellement acquises
COMPUTED    → moyennes, écarts-types et variations calculés
RESTITUTION → valeurs présentées conformément à la règle normative
```

Aucun seuil universel de perte de brillant n'est introduit.

Le seuil de rétention de 50 % est, s'il est utilisé, un critère INFIPERF et ne doit jamais être présenté comme une exigence universelle de NF EN 927-6.

Formules consommées par la chaîne :

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

Le seuil de 50 % reste associé à son contexte complémentaire applicable (INFIPERF FCBA 2024).

### 15.3 A.2 — Couleur

Système et conditions de mesure :

```text
système     CIE 1976 L*a*b*
canaux      L*, a*, b*
illuminant  D65
observateur 10°
géométrie   45°:0° ou di:8° selon la norme
```

Règles de mesure :

* au minimum quatre mesures individuelles par panneau.

Nombre de mesures (paramètre du protocole de l'essai, section 8) :

* le nombre de mesures couleur est un paramètre du protocole de l'essai, sous réserve des exigences méthodologiques applicables (au minimum quatre mesures individuelles par panneau) ;
* le paramètre est conservé avec l'essai ;
* les calculs utilisent le nombre de mesures réellement défini dans le protocole ;
* aucune donnée manquante ne devient 0.

Précision et arrondis :

```text
RAW         valeurs réellement mesurées, conservées avec leur précision disponible
COMPUTED    calculs avec la précision nécessaire, sans arrondi prématuré
RESTITUTION règles normatives A.2 :
            • mesures individuelles            : 1 décimale
            • moyenne des trois panneaux       : entier
            • écart-type des trois panneaux    : entier
```

Le S0 empêche explicitement qu'un arrondi intermédiaire dégrade les calculs.

Aucun arrondi interne fixe (par exemple à 3 décimales) n'est imposé par le S0 sans justification scientifique : la précision interne de COMPUTED est la précision nécessaire aux calculs.

Calculs :

```text
ΔL*
Δa*
Δb*
ΔE*ab
```

Les calculs ΔL*, Δa*, Δb* et ΔE*ab restent traçables aux valeurs sources.

La référence initiale doit correspondre à l'échantillon concerné lorsqu'une référence individuelle est définie.

Aucune substitution silencieuse du T0 d'un autre échantillon.

### 15.4 A.3 — Cloquage

Règles :

* évaluation séparée de chaque zone/panneau exposé ;
* référence : ISO 4628-2 ;
* conservation des observations RAW ;
* calcul de la moyenne conformément à l'Annexe A ;
* restitution de la moyenne à 1 décimale.

`maxRating` (indicateur de sévérité maximale) est conservé.

Il n'est ni supprimé, ni arbitrairement défini comme la moyenne normative.

Le S0 distingue :

* l'indicateur de sévérité maximale éventuellement conservé (`maxRating`) ;
* la métrique moyenne normative requise par A.3.

Le modèle scientifique exact entre les catégories/observations existantes et le calcul normatif n'est pas suffisamment défini à ce stade :

```text
À DÉFINIR / À VALIDER SCIENTIFIQUEMENT
```

Aucune correspondance n'est inventée.

### 15.5 A.4 — Écaillage

Règles :

* évaluation séparée de chaque zone/panneau exposé ;
* référence : ISO 4628-5 ;
* conservation des résultats RAW ;
* calcul de la moyenne conformément à l'Annexe A ;
* restitution de la moyenne à 1 décimale.

Même principe architectural que A.3 :

```text
RAW → COMPUTED → CRITÈRE → ANALYSE → RESTITUTION
```

`maxRating` n'est pas automatiquement assimilé à la moyenne normative.

### 15.6 A.5 — Craquelage (fissuration)

Règles :

* évaluation séparée de chaque zone/panneau exposé ;
* référence : ISO 4628-4 ;
* conservation des observations RAW ;
* calcul de la moyenne conformément à l'Annexe A ;
* restitution de la moyenne à 1 décimale.

`maxRating` n'est pas arbitrairement remplacé par la moyenne normative.

Si la correspondance exacte avec le modèle de données actuel n'est pas définie :

```text
À DÉFINIR / À VALIDER SCIENTIFIQUEMENT
```

### 15.7 A.6 — Farinage

Règles :

* évaluation séparée de chaque zone/panneau exposé ;
* référence : ISO 4628-6 ;
* conservation des observations RAW ;
* calcul de la moyenne conformément à l'Annexe A ;
* restitution de la moyenne à 1 décimale.

Même principe :

* `maxRating` peut rester un indicateur de sévérité ;
* la moyenne normative doit être identifiée séparément si nécessaire ;
* aucune substitution arbitraire.

### 15.8 A.7 — Aspect général

L'Annexe A distingue clairement :

```text
A.3 à A.6   défauts / propriétés spécifiques :
            cloquage, écaillage, craquelage, farinage

A.7         aspect général
```

L'aspect général est évalué selon l'échelle de :

```text
ISO 4628-1:2016, Tableau 2
```

L'évaluation doit être comparée avec les panneaux de référence non exposés.

A.7 n'est pas fusionné avec les indicateurs A.3 à A.6.

L'aspect général est une observation distincte.

Il ne doit pas être automatiquement déduit de la somme ou de la moyenne des autres défauts.

### 15.9 A.8 — Adhérence

**Référence méthodologique :**

```text
EN ISO 2409 dans le cadre applicable de NF EN 927-6.
```

**Règles issues du référentiel :**

Seules les règles effectivement établies et validées comme exigences normatives sont documentées comme telles.

Toute règle non établie est notée :

```text
À DÉFINIR / À VALIDER SCIENTIFIQUEMENT
```

**Protocole QUV-Lab actuellement retenu :**

* T0 : acquisition sur le panneau de référence non vieilli T ;
* fin d'exposition : acquisition sur E1, E2 et E3 ;
* C1 à C11 : aucune acquisition d'adhérence ;
* E1/E2/E3 : 2 essais sur chaque panneau exposé.

**Exigence normative NF EN 927-6:2018 :**

```text
→ 2 essais sur chaque panneau exposé.
```

NF EN 927-6:2018, Annexe A.8.3, impose :

* deux essais sur chaque panneau exposé ;
* résultats individuels sans décimale ;
* moyenne de chaque panneau à une décimale ;
* moyenne des trois panneaux à une décimale.

Pour QUV-Lab appliquant NF EN 927-6:2018, la valeur normative A.8 est :

```text
E1 : M1 + M2
E2 : M1 + M2
E3 : M1 + M2
```

**Paramètre de protocole :**

```text
→ paramétrable uniquement lorsqu'une telle liberté est compatible
  avec les exigences normatives/méthodologiques applicables.
```

Lorsque la norme fixe le nombre de mesures, le paramètre du protocole doit respecter cette valeur.

Cette règle est cohérente avec la section 8 :

```text
Paramétrable ≠ libre de toute contrainte normative.
```

**Protocole standard / protocole adapté :**

```text
2 essais/panneau             → protocole standard
1 essai/panneau              → protocole adapté possible, à condition d'une
                               justification formellement valide (≥ 8 caractères
                               après trim, section 8.2)
3 essais/panneau ou plus     → non autorisé
```

**RAW :**

* T0 : valeur RAW initiale du panneau de référence T, entier sur l'échelle 0 à 5, sans décimale ;
* E1/E2/E3 (exigence normative A.8.3, 2 essais par panneau) : chaque résultat individuel est RAW, entier de 0 à 5, sans décimale ;
* les résultats individuels ne sont jamais remplacés par leur moyenne ;
* les mesures individuelles restent accessibles et traçables.

**Calcul :**

Moyenne par panneau exposé :

```text
somme des mesures RAW valides du panneau / nombre de mesures valides correspondant au protocole
```

Protocole actuel à 2 mesures par panneau :

```text
E1 = (E1-M1 + E1-M2) / 2
E2 = (E2-M1 + E2-M2) / 2
E3 = (E3-M1 + E3-M2) / 2
```

Moyenne globale après exposition :

```text
moyenne(E1, E2, E3) = (moyenne E1 + moyenne E2 + moyenne E3) / 3
```

La moyenne globale reste une valeur COMPUTED.

**Restitution :**

* moyenne par panneau : 1 décimale ;
* moyenne globale après exposition : 1 décimale.

**Distinction T0 / exposés :**

* T0 = panneau de référence non vieilli T ;
* fin d'exposition = panneaux exposés E1/E2/E3 ;
* T n'est jamais fusionné avec E1/E2/E3 dans une moyenne globale d'exposition ;
* une moyenne calculée ne remplace jamais la valeur RAW T0.

**Point restant à valider :**

```text
Fréquence exacte de mesure du panneau de référence T0 : À DÉFINIR / À VALIDER SCIENTIFIQUEMENT.
```

### 15.10 Adhérence T0 / panneau de référence

La norme traite la mesure de l'adhérence sur les panneaux de référence avant exposition.

La règle opérationnelle exacte du protocole QUV-Lab concernant la fréquence T0 d'adhérence sur le panneau témoin/référence doit être explicitement validée :

```text
Fréquence / nombre exact de mesures d'adhérence T0 sur le panneau de référence : À DÉFINIR / À VALIDER SCIENTIFIQUEMENT.
```

Cette incertitude ne bloque pas la formalisation de A.8 pour les trois panneaux exposés (section 15.9).

Aucune règle n'est inventée pour obtenir un modèle informatique complet.

La référence T0 de l'adhérence est distincte de la référence T0 utilisée pour le PERSOZ.

## 16. PERSOZ

Le PERSOZ :

* n'est jamais mesuré sur le témoin T ;
* est mesuré uniquement sur E1/E2/E3 ;
* est suivi de T0 à C12 ;
* comporte 3 répétitions par échantillon selon le protocole actuellement retenu.

Le nombre de mesures individuelles / répétitions PERSOZ est un paramètre du protocole de l'essai (section 8) :

* il est défini à la création de l'essai ;
* il est conservé avec l'essai ;
* il est utilisé par les contrôles de complétude et les calculs.

La règle absolue « aucun PERSOZ sur T » reste inchangée quel que soit le nombre de répétitions défini.

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

## 17. Analyse temporelle

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

## 18. Analyse inter-systèmes / inter-familles

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

## 19. Conservation de la compatibilité avec les données historiques

Le S0 distingue :

```text
règle scientifique normative actuelle
```

de :

```text
compatibilité avec les données historiques
```

Si une ancienne structure de données existe dans le code, cela ne conduit pas à affaiblir la règle scientifique actuelle.

La compatibilité historique pourra être traitée ultérieurement dans le code.

## 20. Traçabilité et versionnement

Les calculs doivent être identifiables et traçables.

Les versions des règles scientifiques et des moteurs de calcul doivent pouvoir être distinguées.

Version actuelle du moteur d'observations :

```text
1.3.0
```

Les modifications scientifiques doivent rester traçables dans le temps.

## 21. Gouvernance scientifique

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

## 22. Principe général de non-invention

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

## 23. IMPACT CODE À PRÉVOIR APRÈS VALIDATION S0

Cette section documente uniquement les besoins futurs identifiés après validation du présent S0.

Aucune implémentation n'est effectuée à ce stade.

Besoins identifiés :

* ajout de métriques normatives moyennes pour A.3 à A.6, distinctes de l'indicateur de sévérité `maxRating` (le mapping entre les catégories/observations existantes et le calcul normatif restant `À DÉFINIR / À VALIDER SCIENTIFIQUEMENT`) ;
* évolution du modèle de données adhérence A.8 : deux essais par panneau exposé (E1-M1/E1-M2, E2-M1/E2-M2, E3-M1/E3-M2), moyennes panneau et globale, restitution à 1 décimale, avec le nombre de mesures par panneau paramétré et conservé au protocole de l'essai ;
* définition et validation de la fréquence T0 d'adhérence sur le panneau de référence (section 15.10) ;
* mise en place du paramètre « nombre de mesures » du protocole d'essai pour l'adhérence, la couleur, la brillance et le PERSOZ, sous réserve des exigences normatives minimales ;
* évolution des règles d'arrondi liées à la restitution A.2 (mesures individuelles à 1 décimale, moyenne et écart-type des trois panneaux en entier) ;
* évolution de la restitution couleur ;
* évolution des tests scientifiques associés ;
* éventuelle adaptation des agrégations et de la chaîne RAW → COMPUTED → CRITÈRE → ANALYSE → RESTITUTION pour ces métriques.