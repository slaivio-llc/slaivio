# Paramètres de l’agence

## Mise en service

1. Appliquer `infra/sql/165_settings_account_requests.sql` après les migrations précédentes.
2. Déployer l’API et le dashboard ensemble.
3. Tester une sauvegarde de profil, un format de référence et une création d’expédition.

La migration n’efface aucune donnée, ne remplace aucun format existant et ne
réinitialise aucun compteur. Elle est nécessaire avant la nouvelle API : elle
ajoute l’allocateur de références d’expédition et le type de demande de suppression.

## Organisation

- Profil : identité utile, coordonnées, recherche de pays avec drapeaux, langue et devise.
- Réception & horaires : règles d’entrée, horaires et fuseau horaire.
- Livraison & conditions clients : livraison, retrait et crédit client.
- Références : formats des colis, clients, expéditions et dossiers ; création d’un compteur absent.
- Notifications : confirmations séparées des relances, délais et frais de garde.
- Abonnement : même conteneur que les autres sections, chargement sans shimmer.

Les anciens liens `hours`, `clients`, `general` et `preferences` ouvrent les
sections regroupées. Les champs légaux et le slogan sont retirés du formulaire,
pas de la base ; une sauvegarde ne les efface pas.

Les règles de marchandises sont conservées en option avancée : le contrôle utilise
le nom exact ou la catégorie et peut interdire une marchandise ou demander une
validation avant chargement. Il ne s’agit pas d’un moteur douanier par pays.

## Suppression du compte

La section Sécurité permet une **demande**, confirmée par `SUPPRIMER`, pour
l’utilisateur connecté uniquement. Elle ne supprime pas immédiatement le compte
Clerk, ses appartenances ou les données de l’agence.

Chaque nouvelle demande crée un ticket visible dans le Support du Super Admin et
une entrée `DELETE_ACCOUNT` dans `organization_data_requests`. Les répétitions
réutilisent la demande en cours. Une propriété unique d’agence est signalée dans
`scope.ownership_review_required` ; la fermeture ou le transfert doit être examiné
explicitement avant toute exécution manuelle. Aucun exécuteur automatique de
suppression n’est ajouté par cette modification.
