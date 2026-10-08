# CRM : déploiement et incident de création

## Cause du journal du 8 octobre 2026

`POST /clients` échoue parce que PostgreSQL ne trouve pas `client_creation_requests`.
La migration 126 n'est pas visible dans la base/search_path utilisés par le backend.
Un push Git déploie le code : il n'exécute pas les fichiers SQL.

## Débloquer la production

1. Identifier dans Railway la base effectivement référencée par le backend
   (`DATABASE_URL`), sans partager la valeur ni les identifiants.
2. Ouvrir l'éditeur SQL de **cette base**, puis exécuter intégralement et dans l'ordre :
   `infra/sql/126_client_creation_requests.sql`, puis
   `infra/sql/127_client_company_contacts.sql`.
   Ces migrations utilisent `IF NOT EXISTS` et ne suppriment pas de données.
3. Vérifier depuis la connexion utilisée par le backend :

   ```sql
   select current_database(), current_schema();
   select to_regclass('client_creation_requests'), to_regclass('client_company_contacts');
   ```

   Les deux références doivent être non nulles. Si elles restent nulles, vérifier la base
   ciblée et le `search_path` ; ne pas créer une autre copie dans un schéma arbitraire.
4. Depuis `apps/api`, avec la configuration de déploiement appropriée :

   ```powershell
   python -m app.clients.schema_checks
   ```

   Ce contrôle est en lecture seule. Il termine avec le code 1 si une table manque.
   Il vérifie la présence des tables, pas l'intégralité des colonnes/contraintes.
5. Refaire une création de particulier puis d'entreprise. Tester les contacts entreprise.
   Après une erreur réseau, rejouer la même saisie : un seul client doit exister.

Le garde-fou API retourne désormais 503 avec `crm_migration_required` si la table
requise est absente. Il conserve les protections d'idempotence et ne crée aucune table
pendant une requête. **Il ne remplace pas l'application des migrations.**

## Recette avant clôture

- Tester avec des comptes distincts : lecture clients seule, exploitation, finance, direction.
- Vérifier qu'aucune section ou activité financière n'est retournée sans `finance.read`.
- Vérifier les devises séparées, la pagination et les liens vers les objets métier.
- Tester deux modifications concurrentes d'un contact principal.
- Vérifier l'export filtré (nom, type, dates) et la protection des cellules CSV.
- Effectuer les essais sur PostgreSQL et dans un navigateur connecté, pas seulement avec des mocks.
