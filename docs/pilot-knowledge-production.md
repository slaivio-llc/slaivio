# Base de connaissances Pilot — mise en production

Le parcours Pilot accepte trois sources : saisie directe, image et document. Les fichiers ne deviennent jamais une instruction IA brute. Ils suivent le circuit suivant :

1. contrôle du format et de la taille (20 Mo maximum) ;
2. analyse antivirus ;
3. stockage dans le bucket privé `knowledge-files` ;
4. OCR pour les images et PDF, ou extraction locale pour DOCX, XLSX, CSV et TXT ;
5. affichage du texte extrait au responsable ;
6. correction et confirmation humaine ;
7. enregistrement en brouillon ou publication ;
8. utilisation par l’IA uniquement si la connaissance est publiée, communicable, à jour et non sensible.

## Configuration API requise

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MISTRAL_API_KEY` pour les images et PDF
- `KNOWLEDGE_OCR_MODEL=mistral-ocr-latest`
- `CLAMAV_HOST` pointant vers un service ClamAV privé
- `CLAMAV_PORT=3310`
- `KNOWLEDGE_ANTIVIRUS_REQUIRED=true`

Le bucket Supabase `knowledge-files` doit exister et rester privé. Aucun lien public permanent n’est enregistré.

En production, l’absence de ClamAV bloque volontairement l’import. Ne désactivez pas ce contrôle pour contourner une erreur de déploiement.

### Diagnostic de l’erreur `knowledge_antivirus_unavailable`

Cette erreur signifie que `CLAMAV_HOST` est renseigné, mais que l’API ne peut pas joindre `CLAMAV_HOST:CLAMAV_PORT`. Le nom `clamav` ne fonctionne que si l’API et le service ClamAV partagent le même réseau Docker privé.

Avant de redéployer l’API :

1. démarrer ClamAV et attendre que son healthcheck soit sain (le premier chargement des signatures peut prendre environ 90 secondes) ;
2. depuis le conteneur API, résoudre le nom défini dans `CLAMAV_HOST` et ouvrir une connexion TCP vers le port `3310` ;
3. sur une plateforme multi-services, utiliser le nom DNS privé fourni par la plateforme, pas `localhost` ni une adresse publique ;
4. conserver `KNOWLEDGE_ANTIVIRUS_REQUIRED=true`, puis redémarrer l’API après la correction des variables ;
5. importer un petit fichier TXT sain avant de tester les images et les PDF.

En Docker Compose, démarrer le service fourni avec `docker compose -f infra/docker-compose.antivirus.yml up -d` et utiliser `CLAMAV_HOST=clamav` uniquement si l’API est attachée au même réseau Compose. Si l’API tourne directement sur la machine hôte, utiliser l’adresse locale appropriée au système d’exploitation et garder `CLAMAV_PORT=3310`.

Sur Render, déployer le service privé décrit dans
[`infra/render/clamav/README.md`](../infra/render/clamav/README.md), dans la même
région que l’API. Copier son **Internal Hostname** dans `CLAMAV_HOST`, puis
exécuter `python scripts/check_clamav.py` depuis le Shell du service API. Le test
doit afficher `PONG` avant d’ouvrir les imports aux agences.

## Formats pris en charge

- images : JPG, PNG, WebP ;
- documents : PDF, DOCX, XLSX, CSV, TXT.

Un format non reconnu, un fichier vide, infecté, supérieur à 20 Mo ou sans texte exploitable est refusé avec un message compréhensible. « Tous les formats » ne doit pas signifier exécuter ou accepter aveuglément des fichiers dangereux.

## Test réel avant ouverture aux agences

1. Importer une image contenant une information connue et vérifier le texte OCR.
2. Corriger volontairement une ligne puis enregistrer en brouillon.
3. Poser la question dans WhatsApp : le brouillon ne doit pas être utilisé.
4. Publier l’information comme communicable aux clients.
5. Reposer la question : la réponse doit provenir du passage publié.
6. Retirer la publication puis vérifier que l’IA cesse immédiatement de l’utiliser.
7. Répéter avec un PDF de plusieurs pages, un DOCX et un CSV.
8. Vérifier avec deux organisations que les fichiers et résultats ne se croisent jamais.
