# MODULE-08 — TARIFICATION

## Objectif

Le Module-08 est le référentiel de calcul tarifaire d'une organisation. Il
consomme les routes et services du Module-09, calcule un montant déterministe,
explique le calcul et conserve un snapshot lorsqu'un prix est appliqué à un
colis ou figé dans un devis. Il ne gère ni les acomptes et soldes (Finance), ni
les départs (Expéditions), ni l'envoi automatique d'annonces tarifaires.

## 08.01 — Grilles et règles

Une grille relie une route, un service, une devise, une période d'application
et une méthode de calcul. Elle est créée en brouillon et peut contenir :

- des règles générales ou ciblées par catégorie, client, segment, bureau ou
  plage de quantité ;
- des paliers par poids, volume, unités ou valeur ; chaque palier est soit un
  prix par unité de sa base, soit un forfait ;
- des frais complémentaires avec leur méthode de calcul, leurs conditions et
  leur caractère taxable ;
- des coûts internes, utilisés pour l'estimation de marge ;
- des catégories de marchandises configurées par l'agence.

Une catégorie n'est demandée que si aucune règle générale ne permet de fixer le
prix et que la grille différencie les marchandises. La liste fournie au départ
est indicative ; une agence peut créer ses propres catégories.

## 08.02 — Calcul déterministe

Méthodes disponibles : kg, CBM, colis, unité, pourcentage de la valeur, forfait
et paliers. Le volume est saisi directement ou calculé à partir des dimensions.
Le poids réel n'est jamais remplacé par le poids facturable.

Pour les grilles qui l'activent, le seuil de densité est propre à la grille :
si le poids réel divisé par le volume mesuré dépasse le seuil configuré, le
calcul passe au poids réel facturable au lieu du CBM. Aucun seuil universel
n'est imposé.

Les limites de paliers suivent l'intervalle `[minimum, maximum)` ; une borne
haute vide signifie qu'il n'y a pas de maximum. Les bornes d'un palier doivent
être positives/cohérentes et ne peuvent chevaucher un autre palier de même base
et de même règle. Un palier forfaitaire est multiplié par une quantité de 1,
pas par son poids ou son volume.

Lorsqu'une donnée nécessaire manque (par exemple poids pour un tarif au kg), le
moteur répond « information requise » au lieu de retourner un prix nul ou
incomplet. Les simulations expliquent le poids réel, le poids volumétrique, le
poids facturable, les règles, frais, réductions, taxes et la version de grille.

## 08.03 — Création, publication et historique

Le parcours de création est organisé en trois étapes : route/service, méthode
et paramètres de calcul, puis devise/visibilité/date d'application. La grille
reste un brouillon jusqu'à la saisie de ses règles, sa simulation, son
approbation et son activation.

Une grille publiée est en lecture seule. Pour changer un prix, l'utilisateur
prépare une nouvelle version sous le même code, avec une date d'application.
Les règles, paliers, frais et coûts sont copiés dans le brouillon de version ;
les anciennes lignes tarifaires et les snapshots appliqués restent consultables.
À l'activation d'une version, la période de la grille active précédente pour
la même route et le même service est clôturée à la date d'effet.

Un devis figé conserve la version, les entrées, le détail du calcul et un
identifiant d'idempotence. Réutiliser cet identifiant avec des entrées
différentes est refusé. Changer une grille ne réécrit donc pas un prix déjà
appliqué.

Le calcul déclenché depuis la fiche d'un colis utilise le même moteur, puis
conserve le total, la devise et le snapshot tarifaire avec le colis. La
publication ou la modification d'une grille n'envoie pas automatiquement de
communication aux clients.

## Accès et migration

Les routes de lecture, création, simulation, approbation, publication,
catégories et coûts sont protégées par les permissions `pricing.*`. Toute
requête de données est limitée à l'organisation connectée.

La migration additive `infra/sql/133_module_08_pricing_completion.sql` ajoute
le seuil de densité par grille, le mode forfaitaire des paliers et les
contraintes de bornes. Elle doit être appliquée à la base avant de déployer
cette version de l'API.
