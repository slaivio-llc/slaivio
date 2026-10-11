# Module 03 — Colis : suivi d’implémentation

Source : [spécification fournie](spec/module-03-parcels.md). État au 11 octobre 2026.

## Arbitrages

- Le complément final impose client + service + route configurés ; il prévaut sur le formulaire initial limité à la destination.
- Le modèle actuel associe un service à une seule route. Le formulaire présente cette route, sans inventer de relation plusieurs-à-plusieurs.
- Les filtres restent automatiques et le bureau est choisi dans le sélecteur global (décisions visuelles antérieures).
- Les maquettes et exemples de clients du document ne sont pas des données à introduire en production.
- Le parcours véhicules ne doit pas être remplacé par le parcours fret.

## Premier lot réalisé : réception manuelle fret

- L’ancien formulaire fret est remplacé par un composant dédié : client, transport, informations du colis, réception.
- Recherche client avec résultats asynchrones protégés contre les réponses obsolètes, sélection conservée pendant les recherches, création client intégrée sans perdre le brouillon.
- Service puis route compatible du catalogue ; service sans route active exclu. Erreurs de chargement explicites et réessai.
- Référence fournisseur et description facultatives ; poids facultatif, strictement positif s’il est connu. L’absence de pesée reste `null`.
- Emplacement de stockage facultatif ; bureau actif fourni par le contexte serveur.
- Pour la réception manuelle fret sans dossier, le serveur exige client/service/route, impose l’état reçu et l’heure de réception, génère les références et refuse les destinations/montants/identités imposés par le navigateur.
- Le dépôt conserve les contrôles de propriété client/route/service et de compatibilité route-service. L’agent de réception est enregistré même sans date fournie par le navigateur.
- L’historique et la mise en file de notification existants restent transactionnels ; aucun envoi WhatsApp synchrone n’est ajouté.
- Le bouton empêche un double clic immédiat. Cela ne constitue PAS encore une idempotence réseau/serveur.

## Restant — ne pas déclarer Module 03 terminé

1. **03.01 Registre** : remplacer pour le fret le tableau/KPI/menus hérités par référence, client, état et éventuellement service ; recherche et filtres simples ; projection API minimale, pagination, états erreur/vide/chargement. Préserver le périmètre des bureaux autorisés et les liens Customer360.
2. **03.02 Fiabilité de réception** : idempotence transactionnelle des nouvelles tentatives ; remplacer le blocage historique des références fournisseur répétées par un avertissement contextualisé avec confirmation tracée (une même référence peut désigner plusieurs colis). Vérifier import/API/IA séparément.
3. **03.03 Fiche** : Vue d’ensemble + Historique, service/route visibles, références distinguées, édition limitée ; réaffectation client et modification du service après facturation explicitement contrôlées.
4. **Tarification** : ne pas inventer de prix. Raccorder le calcul aux données suffisantes, afficher « Tarif à définir » lorsque le calcul est impossible, puis vérifier l’éligibilité aux expéditions.
5. **03.04 Cycle de vie** : auditer les transitions existantes et leurs événements ; garantir qu’une affectation n’est pas un départ et qu’une arrivée n’est pas une livraison. Préserver les anciens événements sans proposer tous les états hérités comme parcours normal.
6. **03.05 Retrait** : actions métier disponibles/remis, concurrence et idempotence, conditions financières par agence, remise groupée contrôlée individuellement, correction auditée ; relances annulées après remise.
7. **03.06–03.07 Photos/localisation** : ajout dès réception, stockage privé par défaut, partage client explicite et autorisé. Le premier lot ne propose pas encore de téléversement photo dans le nouveau formulaire.
8. **Recette réelle** : PostgreSQL, comptes avec permissions limitées, plusieurs bureaux, catalogue modifié pendant la saisie, connexion interrompue après validation, livraison WhatsApp réelle, mobile et accès clavier. Vérifier l’alignement visuel avec le socle partagé.

## Validation du premier lot

- 12 tests Python de préparation et intégration dépôt simulée ; aucun accès à une base de production.
- 9 tests d’acceptation LUZA existants également passants (21 tests Python au total).
- 4 tests d’interaction du nouveau formulaire passants.
- TypeScript et ESLint ciblé exécutés ; validation navigateur authentifiée et base réelle encore nécessaires.
- Pas de migration SQL ajoutée ou appliquée dans ce lot.
