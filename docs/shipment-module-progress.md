# Module 04 — Expéditions & Départs : cadrage et suivi

État au 14 octobre 2026. Source conservée intégralement : [cahier des charges](spec/module-04-expeditions-departs.md).

## État réel

Le premier lot registre/création est implémenté ; le module reste en cours. Les mentions « terminé » du document décrivent sa conception ; elles ne certifient ni le code ni la recette. Les [restes de Colis](parcel-module-progress.md) restent ouverts, en particulier la remise liée à Finance.

Le document contient 04.01, 04.02 et 04.04. Il cite 04.03 sans fournir une section détaillée autonome ; les règles départ/arrivée décrites dans 04.02 restent applicables, sans inventer de nouvelles exigences.

## Contrat retenu

- L’expédition est le mouvement collectif ; route = configuration réutilisable, départ/arrivée = événements réels, manifeste = représentation du chargement.
- Cycle visible : Prévue → Partie → Arrivée. Affecter à une expédition prévue ne signifie pas expédier un colis ; une arrivée ne signifie ni disponibilité pour retrait ni remise.
- Création minimale : origine et destination configurées, date prévue facultative. Référence, auteur et horodatage viennent du serveur. Ne pas imposer les champs techniques historiques ou une date inventée.
- Registre compact, recherche et filtres automatiques, bureau choisi seulement dans le sélecteur global ; présentation mobile dédiée plutôt qu’un tableau desktop écrasé.
- Fiche : Aperçu, Colis, Communications, Manifeste. Conserver le socle visuel partagé des nouveaux modules, les libellés compacts et les retours adaptés à la navigation.
- Affectation/retrait en préparation ; protection concurrente contre la double affectation ; correction explicite et auditée après départ.
- Conserver dates prévues, dates réelles et historique des modifications. Les retards sont des événements d’information, jamais des retours artificiels à l’état Prévue.
- Confirmer départ/arrivée après aperçu des colis concernés ; état, événements et notifications en file cohérents et protégés contre les répétitions. Ne pas effectuer les appels WhatsApp dans la transaction métier.
- Audience contextuelle selon événement : prospects pertinents pour une annonce, précédemment informés pour un report, clients réellement chargés pour départ/retard en transit/arrivée. Déduplication, aperçu du message et des destinataires, résultats d’envoi conservés.
- Aucun envoi à tous les contacts par défaut. Les permissions et règles du canal restent obligatoires ; les détails seront alignés avec Communication.
- Manifeste dynamique en préparation, composition et données déclarées figées au départ ; totaux calculés et poids manquants explicites. PDF, Excel et impression sans couplage à l’envoi de messages.
- Aucun scénario spécifique codé pour LUZA ou un pays ; isolation des bureaux et préservation du parcours véhicules.

## Premiers points d’intégration repérés — à auditer avant remplacement

- API `app/api/shipments.py` et dépôt `app/expeditions/repository.py` : modèle existant riche, états historiques, affectation de colis, notifications et export CSV.
- `app/departures/repository.py` possède aussi affectation, transitions, manifeste et automatisations. Déterminer une source de vérité et une migration des liens existants avant de retirer les doublons d’interface.
- Le dépôt Expéditions comporte `_ensure_schema` : inventorier les prérequis et déplacer les éventuelles évolutions nécessaires vers des migrations, sans DDL dans les nouvelles lectures.
- L’export actuel `export_manifest` lit les colis de l’expédition ; vérifier la conservation historique au départ, les permissions et les formats requis. Ne pas annoncer PDF/Excel ou snapshot comme acquis.
- Les états et données existants doivent être repris explicitement, pas supprimés pour faire correspondre l’interface à une maquette.

## Ordre des lots et critères de recette

1. **Registre et création** : projection paginée limitée au périmètre autorisé, filtres paramétrés, origine/destination issues du catalogue, date facultative, erreurs explicites, mobile et clavier.
2. **Préparation** : sélection recherchable/paginée à grand volume, compatibilité recontrôlée au serveur, affectation/retrait transactionnels, idempotence et conflits entre agents, colis restant Reçu.
3. **Départ et arrivée** : commandes dédiées, permissions et versions contrôlées, confirmation, synchronisation des seuls colis concernés, dates réelles, événements et file de notifications sans doublons.
4. **Manifeste** : lecture/recherche, poids connus et couverture, snapshot au départ, exports et impression ; changement ultérieur du nom client sans altération de la version partie.
5. **Planification et communications** : modifications et retards audités, aperçu d’audience, historique des destinataires, reprise des annonces précédentes et suivi fiable des envois.
6. **Recette croisée** : plusieurs bureaux, permissions limitées, affectations concurrentes, plus de 1 000 colis, panne réseau, envoi différé, migration d’anciennes expéditions, non-régression véhicules.

## Dépendances différées sans contournement

- Finance : reprendre les règles d’éligibilité et de remise avec les liens réels factures/paiements ; ne pas déclarer un colis financièrement éligible sur une supposition.
- Communication : consentement, restrictions du canal, templates et fenêtres applicables ; aucune campagne réelle durant les tests sans autorisation.
- Équipe & Permissions : séparer lecture, export, chargement et confirmation sans octroyer de droits réseau implicites.

## Validation de ce passage

Documentation uniquement. Pas de migration exécutée, pas de modification de données, pas de test fonctionnel ni déploiement revendiqué.

## Premier lot — 14 octobre 2026 : registre et création fret

- `ShipmentsPage` monte le nouveau registre uniquement pour PARCEL_FREIGHT. L’ancien écran et ses effets restent réservés aux autres parcours.
- Registre à quatre colonnes : référence avec nombre de colis, trajet, état, départ prévu/réel. Liste dédiée sur mobile ; filtre d’état et période de création UTC, recherche automatique, pagination de 50. Une période incomplète n’est pas envoyée.
- Projection limitée au bureau propriétaire actif, sans finances ni coordonnées client. Compteur calculé depuis les affectations actives et colis non supprimés. Les anciens états sont regroupés pour l’affichage sans réécrire leur valeur ; états ambigus conservés sous Autre état.
- Formulaire latéral : origine, destination/route configurée, départ prévu facultatif. Heure saisie dans le fuseau du navigateur et transmise avec décalage ; fuseau du bureau à intégrer ultérieurement si différent.
- Création dans `cargo_expeditions`, pas dans une troisième table métier ; état serveur PREPARING (affiché Prévue), contexte issu de la route revalidée et verrouillée, référence générée côté serveur, événement transactionnel. Aucun colis déplacé ni message envoyé à la création.
- Nouvelles routes `/shipments/register` et `/shipments/register/routes`, permissions serveur read/create. Pas d’appel `_ensure_schema` dans ces nouvelles opérations.
- Idempotence : clé UUID de demande utilisée comme identité de la création, verrou transactionnel et empreinte du contenu initial dans l’événement ; une répétition identique du même acteur/bureau retrouve le résultat. Autre contenu ou autre acteur/bureau : conflit. La clé est conservée pendant les réessais du formulaire, pas après fermeture/rechargement : vérifier le registre avant de recommencer après une réponse perdue.
- Les migrations existantes (notamment 024 et évolutions routes) doivent déjà être appliquées. Aucune migration nouvelle ni exécution sur une base distante dans ce lot.

### Limites et suite immédiate

- Les liens ouvrent encore la fiche détaillée historique. La remplacer par Aperçu / Colis / Communications / Manifeste au prochain lot, avec commandes métier dédiées.
- Les filtres origine/destination restent à ajouter au registre, avec options issues du périmètre consultable et masquage lorsqu’ils sont redondants.
- La visibilité du bureau destinataire n’est pas encore ajoutée : ne pas confondre identifiant de site et identifiant d’organisation. La lecture actuelle conserve volontairement le périmètre propriétaire existant.
- Départs et ses automatisations ne sont pas encore retirés. Migrer leurs liens et unifier les commandes avant suppression des doublons de navigation.
- Affectations massives, départ/arrivée atomiques, snapshot de manifeste, PDF/Excel et audiences contextuelles restent à implémenter/valider. La création seule ne les garantit pas.
- Pas de recette PostgreSQL réelle, navigateur authentifié ou WhatsApp dans ce lot. Déployer le backend avant le frontend.

### Validation locale du premier lot

- 47 tests Python ciblés passants : 13 nouveaux tests registre/création, acceptation LUZA et opérations Colis. Tests de dépôt simulés ; ne prouvent pas les verrous sur une vraie base PostgreSQL.
- 16 tests frontend passants en exécution séquentielle : 5 nouveaux tests du registre/création, 7 de non-régression Colis et 4 du panneau partagé. Le contexte de bureau est simulé explicitement dans les nouveaux tests.
- TypeScript et ESLint ciblé passants ; `git diff --check` sans erreur de contenu. Avertissement Python préexistant sur `datetime.utcnow()` dans le générateur de référence existant.
- À vérifier sur application connectée : rendu 1440/1024/390 px, droits create/read séparés, route suspendue pendant la saisie, dates dans plusieurs fuseaux et répétition concurrente d’une création sur PostgreSQL.
