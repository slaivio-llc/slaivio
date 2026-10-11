# Socle visuel — référence vidéo, 11 octobre 2026

Référence fournie : « Modern Fintech SaaS Payments Dashboard UI Design / Admin
Panel & Transaction Management System ». Images examinées de la navigation et
de la page Payments. La vidéo est une maquette fintech, pas une spécification
fonctionnelle SLAIVIO : ne pas ajouter ses fonctions bancaires ni ses données fictives.

## Règles communes

- Navigation desktop avec icônes et libellés sur une ligne ; 232 px pour les
  parcours agences. Navigation mobile dans le panneau existant.
- Un seul sélecteur d'espace pour les parcours agences, en tête de navigation.
  Un écran métier ne change pas le bureau actif à l'ouverture d'une fiche.
- Inter, surfaces claires, bordures discrètes, accents verts SLAIVIO,
  contrôles de 36 px, coins arrondis et ombres légères pour les menus flottants.
- Titres, outils et contenu suivent le même conteneur de 1200 px maximum.
  Marges desktop de 32 px sur les côtés et au-dessus des titres partagés.
- Réutiliser OperationPageHeader, OperationButton, OperationFilterPopover,
  OperationContent et OperationTable. Éviter de dupliquer leurs styles par module.
- Les filtres s'appliquent automatiquement ; une plage personnalisée n'est
  envoyée qu'une fois complète et valide. Les formulaires de création conservent
  un bouton de confirmation : filtrer n'est pas enregistrer une mutation.
- Utiliser un squelette adapté au contenu pour le chargement ; ne pas afficher
  des étapes internes comme « Vérification du bureau actif ».
- Garder noms accessibles, focus clavier, Échap et états d'erreur explicites.

## Implémentation de ce lot

- Navigation agence élargie, sélecteur d'espace déplacé de la barre haute à la
  navigation, anciens exemplaires desktop/mobile retirés.
- Clients : suppression du sélecteur réseau local et de switchTenant ; recherche,
  tri, filtre partagé et export regroupés ; liste allégée et squelette de chargement.
  Les API réseau existantes restent sécurisées et disponibles pour les vues réseau.
- Accueil Cargo : suppression d'Appliquer, filtres automatiques, contrôle des
  plages personnalisées, suppression des dates périmées lors du retour à un preset.
  Export et actualisation compacts dans l'en-tête, état hors-ligne conservé.
- Composants partagés : contrôles plus compacts, espacement d'en-tête, navigation
  horizontale des libellés, filtre flottant plus léger et fermeture clavier.

## Recette et périmètre restant

Ce lot ne prouve pas une copie pixel par pixel de toutes les pages. Les écrans
historiques avec des composants locaux doivent être examinés lors de chaque module.
Le module 3 Colis sera la prochaine déclinaison détaillée ; ne pas modifier ses
règles métier en déduisant des comportements d'une vidéo fintech.

Vérifier sur l'application connectée : largeur 1440/1024/390 px, navigation longue,
menu d'espace accessible sur mobile, Clients après changement d'espace, filtres
au clavier, dates invalides, absence de doublon du sélecteur, droits et états vides.
Pas de migration de base de données pour ce lot. Déploiement frontend nécessaire.

Validation locale : 37 tests ciblés passent (Clients, Accueil, primitives,
navigation et contrat typographique), ainsi que TypeScript et ESLint ciblé.
La recette visuelle sur sessions connectées et la revue de chaque module historique
ne sont pas couvertes par ces tests et restent nécessaires.
