# ClamAV privé sur Render

Ce service analyse les images et documents importés dans la base de
connaissances. Il reste privé : aucun port ClamAV ne doit être publié sur
Internet.

## Création du service

Dans le même workspace Render que l'API :

1. créer un **Private Service** depuis le dépôt SLAIVIO ;
2. choisir exactement la **même région** que le service API ;
3. sélectionner le runtime **Docker** ;
4. garder la racine du dépôt comme Root Directory ;
5. définir `infra/render/clamav/Dockerfile` comme Dockerfile Path ;
6. choisir le plan `2 CPU / 4 GB` (`2c-4g`) ;
7. nommer le service `slaivio-clamav` et lancer le déploiement.

Le premier démarrage peut prendre plusieurs minutes pendant le téléchargement
des signatures. Le service est prêt lorsque Render détecte le port TCP `3310`
et que les logs indiquent que `clamd` accepte les connexions.

## Liaison avec l'API

Dans `slaivio-clamav`, ouvrir **Connect > Internal** et copier seulement
l'**Internal Hostname**. Dans les variables d'environnement du service API,
définir :

```text
CLAMAV_HOST=<internal-hostname-copié-depuis-render>
CLAMAV_PORT=3310
KNOWLEDGE_ANTIVIRUS_REQUIRED=true
```

Ne pas mettre `https://`, `:3310` ou un chemin dans `CLAMAV_HOST`. Ne pas
utiliser `localhost`, `127.0.0.1`, l'URL publique de l'API, ni le simple nom
Docker `clamav`.

Enregistrer les variables puis redéployer l'API. Tester d'abord un petit fichier
TXT, ensuite une image JPG/PNG et enfin un PDF. Une fois l'antivirus passé, les
images et PDF nécessitent aussi `MISTRAL_API_KEY` pour l'OCR et le bucket privé
Supabase `knowledge-files`. Exécuter la migration
`infra/sql/114_pilot_knowledge_files_bucket.sql` pour créer ce bucket avec la
limite et les formats attendus par l'API.

Depuis **Shell** sur le service API, la liaison peut être validée avant l'import :

```bash
python scripts/check_clamav.py
```

## Diagnostic

Si l'import retourne encore `503`, chercher la ligne
`knowledge_antivirus_unavailable` dans les logs API. Elle contient désormais
l'hôte, le port et le type d'erreur réseau :

- `Name or service not known` : mauvais hostname interne ;
- `Connection refused` : `clamd` n'est pas encore prêt ou n'écoute pas sur 3310 ;
- `timed out` : services dans des régions différentes ou service ClamAV arrêté ;
- arrêt mémoire/OOM dans les logs ClamAV : augmenter son plan.

Les réponses `401` observées avant la restauration de la session utilisateur ne
causent pas cette panne : les appels Knowledge suivants passent en `200`, puis
seul `POST /knowledge/pilot/files` retourne `503` pendant l'analyse antivirus.
