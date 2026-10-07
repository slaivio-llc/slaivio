# Accueil Cargo — contexte temporel et opérations

## Périmètre livré

Le profil colis/fret utilise `/dashboard/cargo`, après vérification du bureau actif.
L'ancien composant d'accueil fret est supprimé ; les véhicules gardent leur parcours.
Le cache sessionStorage global de l'accueil n'est plus lu ni alimenté.

- 13 périodes prédéfinies et dates personnalisées, persistées dans l'URL.
- Comparaison précédente de même durée, année précédente ou dates personnalisées.
- Dates locales inclusives transformées en bornes UTC semi-ouvertes, avec tzdata.
- Fuseau provenant de `organization_settings.timezone`, UTC si non configuré.
- Flux : dates `received_at`, `dispatched_at`, `delivered_at`, sans déduction depuis le statut.
- États actuels : entrepôt, acheminement, retrait, blocage, indépendants des dates choisies.
- Attention : 10 colis bloqués ou ETA dépassée sans état final ; réceptions : 8 dernières de la période.
- Destinations : 8 premières par réceptions, pays et ville séparés. Livraisons à ce jour de cette cohorte, pas taux de ponctualité.
- Données FR/EN, formats de dates et nombres internationaux, calcul horodaté.
- KPI cliquables : liste de correspondances paginée (25 par page), sélection unique,
  métrique et page dans l'URL, mêmes bornes UTC et périmètre que les compteurs.
- Arrivées estimées dans les 7 jours suivants, 10 premières, hors états terminés.
  Ce widget utilise les ETA renseignées, pas une promesse de livraison.
- Départs à venir sur 7 jours (10 premiers), hors brouillons/annulations/départs déjà
  effectués ; interrogation conditionnée à `departures.read`, même périmètre propriétaire.
  L'accès proposé ouvre le module du bureau actif, pas une fiche de départ distante.
- Une erreur n'est pas un jeu de valeurs à zéro. Les réponses périmées sont annulées.

## Autorisation et consolidation

`packages.read` est requis. Le réseau nécessite aussi `network.overview`.
Seuls les bureaux actifs du groupe autorisés par une adhésion réseau active ALL_OFFICES
ou une adhésion locale active sont agrégés. Les colis propriétaires sont comptés une fois.
Au niveau bureau, les colis entrants destinés au bureau restent visibles.
Les fiches d'un autre bureau ne sont pas ouvertes sous le tenant courant : changement
de bureau nécessaire. Ce filtre est limité à l'accueil, pas présenté comme scope global.

La consolidation utilise actuellement le fuseau du bureau actif, explicitement affiché.
Un fuseau de reporting unique du réseau et le scope global partagé restent à livrer.

## Vérification sur environnement de recette

1. Installer les dépendances API mises à jour, dont tzdata. Les migrations existantes
   des colis, paramètres et réseau doivent déjà être appliquées.
2. Ouvrir l'accueil fret : aucune donnée véhicule ou cache d'un autre bureau.
3. Vérifier 7/30/90 jours, semaine/mois/trimestre/année, puis plage personnalisée.
4. Recharger/copier l'URL : mêmes périodes. Naviguer avec précédent/suivant du navigateur.
5. Comparer une période à zéro : pas d'infini ni de faux pourcentage.
6. Tester dates inversées/futures : erreur, pas de statistiques inventées.
7. Régler Europe/Paris et vérifier le 29 mars 2026 (journée de 23 h).
8. Comparer aux dates SQL réelles des jalons. Un jalon sans date reste exclu.
9. Changer la période : les flux changent, pas les états actuels.
10. Vérifier colis bloqué, ETA dépassée, livré et annulé : seuls les deux premiers
    sont signalés. Les liens du bureau ouvrent les fiches exactes.
11. Tester agent sans packages.read, agent sans network.overview, réseau avec
    bureaux assignés et accès ALL_OFFICES, bureau suspendu, organisation véhicule.
12. Couper l'API : erreur explicite. Changer rapidement les périodes : aucune réponse
    ancienne ne doit remplacer la nouvelle. Changer de bureau : aucune donnée persistée.
13. Vérifier 375 px, zoom 200 %, navigation clavier, FR/EN.

## Limites explicites

Ce lot n'achève pas toute la spécification DASH-02 à DASH-10. Restent notamment :
vues partagées, création globale, exports,
finance multi-devises, indicateurs support/IA, rafraîchissement temps réel, synchronisation
hors ligne, séries temporelles et mesures de performance sur PostgreSQL réel.
Les tests unitaires SQL utilisent des doubles : ils ne certifient pas le schéma déployé.
