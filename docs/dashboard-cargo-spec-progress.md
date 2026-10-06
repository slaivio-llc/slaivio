# Dashboard Cargo — suivi de la spécification

Source : document utilisateur « 01 — DASHBOARD / ACCUEIL », fourni le 6 octobre 2026.
La spécification évolue après son introduction vers une cible internationale, et non un simple MVP. Les exemples de chiffres et de personnes ne sont pas des données à injecter dans le produit.

## Lot actuel : DASH-01, barre globale

Remplacements effectués pour le profil colis/fret :

- Recherche de ressources dans le bureau actif : clients (nom/téléphone/email), colis (référence/tracking), expéditions, dossiers et factures. Les résultats sont groupés et ouvrent leur fiche, indépendamment de la pagination des listes.
- Autorisations vérifiées côté API pour chaque famille ; une famille interdite n'est pas interrogée. Le tenant vient du contexte authentifié, pas d'un paramètre fourni par le navigateur.
- Ancienne recherche serveur sans contrôle par module supprimée.
- Requêtes différées de 300 ms, annulables, 100 caractères maximum, cinq résultats maximum par famille. Erreur distincte d'un résultat vide.
- Recherche accessible par bouton et Ctrl/Cmd+K, fermeture Échap, gestion du focus et des touches Tab dans la boîte de dialogue. Textes de recherche FR/EN.
- Aide, notifications et compte regroupés dans le header Cargo ; anciens déclencheurs de compte et notifications retirés du bas de sa sidebar.
- Profil/sécurité gérés par Clerk ; préférences de langue personnelles séparées des paramètres métier. Paramètres métier conservés dans la sidebar.
- Sélecteur du bureau conservé ; sur mobile, une seconde ligne évite de comprimer toutes les commandes. Indicateur hors connexion existant conservé.

## DASH-01 : reste à livrer et valider

- Périmètre organisation/pays/tous les bureaux partagé par tous les modules : pas de faux sélecteur consolidé tant que les API n'appliquent pas le même contrat de scope et les mêmes droits.
- Recherche des paiements et recherche des colis par identité client ; normalisation internationale des téléphones et accents ; pagination complète et mesures de performance/indexation sur données réalistes.
- Notifications limitées à l'attention utile : le moteur existant n'a pas encore été remplacé. Badges, liens objet systématiques, priorité et traductions restent à auditer.
- Menus globaux : audit clavier complet, mobile, lecteur d'écran, fuseau horaire et préférences de formats personnelles.
- Tests navigateur et PostgreSQL réel : les tests de requêtes mockées ne valident pas les schémas déployés ni les temps de réponse.

## Lots suivants, sans mélanger leur état de livraison

1. DASH-02 — identité de page, période, comparaison, fraîcheur et contexte.
2. DASH-03 — indicateurs d'état et flux temporels distincts, liens vers les vues correspondantes.
3. DASH-04 — attention détectable, explicable, actionnable.
4. DASH-05 — activité et performance opérationnelle.
5. DASH-06 — événements métier et historique navigable.
6. DASH-07 — actions globales et commandes, avec politiques de validation.
7. DASH-08 — opérations à venir.
8. DASH-09 — réseau, bureaux, entrepôts et moteur de périmètre.
9. DASH-10 — service client, conversations, politiques IA et traçabilité.

Ce lot ne signifie pas que tout le Dashboard ou toute la spécification internationale est terminé. Les modèles véhicules ne sont pas remplacés par le parcours Cargo.
