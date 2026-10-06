# Validation du parcours bureaux et entrepôts

## Modèle retenu

- Un réseau relie les espaces de la même agence.
- Un bureau et un entrepôt sont des espaces distincts, avec des accès locaux.
- Un site de stockage interne n’est pas un nouvel espace et n’accorde aucun accès réseau.
- Le type d’espace adapte la navigation ; les permissions backend restent l’autorité pour chaque action.
- Les espaces véhicules conservent leur navigation propre.

## Recette avant démonstration

1. Créer une agence colis/fret et enregistrer son identité, sa ville, sa langue et sa devise dans l’onboarding. Vérifier leur reprise dans les paramètres. Les anciens profils ne sont pas rétroactivement écrasés : les réenregistrer si nécessaire.
2. Depuis le sélecteur d’espaces, créer un bureau puis un entrepôt. Vérifier le nom en minuscules, le type, le changement d’espace et l’absence de données étrangères au réseau.
3. Dans l’entrepôt, vérifier le stockage interne initial. Dans un bureau, vérifier l’accès aux opérations et aux finances. Vérifier chaque rôle avec un compte non propriétaire.
4. Inviter un opérateur dans un seul espace. Accepter réellement l’invitation et vérifier qu’un autre espace reste inaccessible, y compris par URL et par API.
5. Créer un client manuellement, puis ouvrir Nouveau colis. Le retrouver par nom et téléphone ; tester aussi une recherche sans résultat et un échec réseau. Aucun enregistrement sans sélection valide.
6. Configurer une route et un service actifs. Dans Nouveau colis, vérifier pays, ville et service dépendants, un type proposé et un type personnalisé.
7. Affecter le colis à un départ vers un autre bureau. Vérifier sa visibilité aux deux extrémités et qu’il compte une seule fois dans le total réseau.
8. Vérifier les boutons retour des sous-modules vers Opérations ou Communication, sans retour sur les pages de regroupement elles-mêmes.
9. Sur mobile et ordinateur, vérifier les fiches client et colis, leurs onglets, les menus non coupés et l’accès aux actions au clavier.
10. Faire le parcours terrain complet : réception, paiement, affectation, départ, arrivée, mise à disposition, livraison. Vérifier chaque notification sur le téléphone du destinataire et le lien de suivi public avec la marque de l’agence.

## Limites de la validation locale

Les tests unitaires et contrôles TypeScript ne prouvent ni la livraison WhatsApp, ni le rendu navigateur, ni l’acceptation Clerk, ni l’exécution SQL sur une base PostgreSQL déployée. Ces vérifications doivent être faites sur un environnement de recette avant d’annoncer le produit prêt aux agences. Les anciens sites de stockage ne sont pas automatiquement convertis en espaces indépendants : cela nécessite une reprise explicite des données et des équipes.

## Contrôles exécutés le 6 octobre 2026

- 29 tests backend ciblés réussis : création des espaces, synchronisation du profil, onboarding, isolation des locataires et contrats de recette LUZA. Certains tests vérifient des contrats de code, pas une base PostgreSQL réelle.
- Vérification TypeScript réussie et analyse Ruff des fichiers backend modifiés réussie.
- Le test frontend de navigation n’a pas démarré : `spawn EPERM` lors du lancement d’esbuild par Vitest. Il reste à exécuter dans un environnement autorisant ce processus.
