# SPEC — fix/tab02-mentions (LOW, base `develop`)

> Demande utilisateur (Référentiel Lots & Échantillons) : retirer mentions techniques et
> références dimensionnelles/normatives de la vue, sans toucher aux données.

## 1. Modifications (`Tab02LotsPanels.tsx` seul)

1. Badge `GATE 2.1 & 2.2` (L250-252) supprimé (titre conservé) + commentaire d'en-tête nettoyé (L2).
2. Mention `UUID: xxxxxxxx` par lot (L352) supprimée (donnée interne, conservée en modèle).
3. Option `Face externe (côté soleil)` → `Face externe (côté écorce)` (valeur `Face externe` inchangée).
4. Dimensions affichées : valeur de la carte projet (L285-287) + répétition sous chaque éprouvette
   (L558-560) supprimées (coquilles conservées : titre carte + note « Saisies 1 seule fois » + badge statut).
5. Option `Quartier (NF EN 927-6)` → `Quartier` (valeur inchangée).
6. Conservé volontairement : phrase « 1 Témoin + 3 Exposées selon NF EN 927-6 » (L392, informative,
   hors périmètre de la demande qui visait le suffixe de « quartier »).

## 2. Tests

`typecheck` (0), `npm test` (195/195), `build` OK + vérif visuelle onglet 02.
