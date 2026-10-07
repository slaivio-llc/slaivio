# Accueil Cargo — point de reprise

État au 7 octobre 2026 : **partiellement implémenté, non clôturé**.
L'utilisateur demande de passer au module Clients / CRM ; ne pas confondre ce
changement de priorité avec une validation complète de l'accueil.

## Déjà implémenté

- API Cargo dédiée, interface distincte des véhicules, suppression du cache global partagé.
- Périodes prédéfinies/personnalisées, comparaisons, bornes UTC et fuseau du bureau.
- Flux de réception/expédition/livraison séparés des états actuels.
- KPI avec sélection unique et liste paginée, contexte conservé dans l'URL.
- Colis bloqués/en retard, réceptions récentes, destinations et évolution des réceptions.
- Arrivées estimées et départs programmés à sept jours (listes limitées explicitement).
- Consolidation opérationnelle autorisée dans l'accueil uniquement.
- Finance du bureau actif par devise, sans conversion ni consolidation financière réseau.
- Export CSV de synthèse ; actualisation à 60 secondes, indication hors connexion.
- Recherche métier globale, premiers liens objet des notifications et actions de lecture.

## Reste à terminer — aucune case validée implicitement

- [ ] Périmètre global organisation/pays/bureau cohérent avec le sélecteur et les modules.
- [ ] Fuseau de reporting réseau indépendant du bureau actif.
- [ ] Vues personnelles enregistrées, vues partagées, droits et gestion de ces vues.
- [ ] Menu Créer par permissions/workspace, avec formulaires réellement ouverts et contexte transmis.
- [ ] Service client : conversations en attente, relances, supervision IA depuis des événements réels.
- [ ] Attention élargie : anomalies, échéances financières et demandes client, sans doublons d'alertes.
- [ ] Consolidation financière par bureau autorisé et par devise ; aucune somme inter-devises implicite.
- [ ] Séries expéditions/livraisons, performances par bureau/destination et historique navigable.
- [ ] Ouverture directe d'un départ et navigation inter-bureaux autorisée vers les fiches.
- [ ] Exports détaillés/PDF respectant exactement filtres et droits (le CSV actuel est une synthèse).
- [ ] Notifications utiles distinctes du journal d'envoi, badges exacts et traductions complètes.
- [ ] Données temps réel et état de synchronisation ; le polling actuel n'est pas du temps réel.
- [ ] Politique hors connexion et conflits ; les données actuelles sont seulement gardées en mémoire.
- [ ] Recette PostgreSQL réel : schéma, chiffres, index, plans SQL et performance avec volume.
- [ ] Recette sécurité : comptes multi-rôles, révocation, bureaux suspendus, réseau, données financières.
- [ ] Recette navigateur : mobile, clavier, lecteur d'écran, zoom 200 %, FR/EN et fuseaux.

## Conditions de clôture

Relire le document Dashboard original section par section : cette liste ne remplace
pas ses critères détaillés. Relier chaque exigence à une implémentation et un test.
Les tests unitaires réussis ne prouvent ni le déploiement, ni le rendu réel, ni les
performances de production. Ne pas annoncer « prêt production mondiale » sans recette.

## Fichiers pour reprendre

- `docs/dashboard-cargo-spec-progress.md` : progression initiale et limites.
- `docs/cargo-dashboard-validation.md` : fonctionnalités et scénarios de recette.
- `apps/api/app/dashboard/cargo_overview.py`, `periods.py`, `finance_summary.py`.
- `apps/web/dashboard/components/dashboard/cargo-dashboard.tsx`.
- Document original : pièce jointe `000f9248-e795-4808-b68c-df554d50bedd/pasted-text.txt`.

Priorité suivante : `docs/spec/module-02-clients-crm.md` et `docs/clients-crm-progress.md`.
