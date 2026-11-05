# Relances WhatsApp respectueuses des informations déjà connues

Déployer l’API et les jobs relances/annonces sur le même code. Appliquer la migration
`172_stop_generic_conversation_followups.sql` avant de reprendre les passages périodiques.

La règle fondée sur un message brut datant de plus de 30 minutes ne génère plus de
relance au client. Les conversations demandant une reprise humaine restent dans
la boîte de réception ; aucune nouvelle tâche client n’est créée sur ce seul motif.
Le contrôle avant envoi refuse également les anciens messages de cette catégorie.

Le profil utilisé combine la fiche CRM identifiée par un numéro international
unique dans l’agence, les informations déjà mémorisées dans le parcours et les
nouvelles déclarations explicites du client. Une valeur absente ne supprime pas
une information connue. Les numéros ambigus, groupes, JID et fiches supprimées ne
permettent pas de sélectionner arbitrairement un client. Aucun autre client, secret
ou solde n’est transmis au modèle pour cette reconnaissance.

La qualification et les réponses connaissent le nom, le pays, la ville et le type
de client déjà disponibles. Le téléphone provient du canal et n’est pas redemandé.
Les relances de qualification sont revérifiées avant envoi : le texte ne demande
que le premier champ obligatoire encore manquant. Un profil complet, un parcours
clos/converti/traité par un humain ou une nouvelle réponse après la mise en file
invalident l’ancien rappel. Les relances métier de paiement, retrait ou dépôt ne
sont pas désactivées simplement parce que l’identité du client est complète.

Les nouvelles relances automatiques utilisent des phrases destinées au client,
sans exposer le motif technique ou l’UUID du dossier/message.

La migration annule uniquement les anciens rappels automatiques génériques dont
l’envoi n’a pas commencé. Elle ne remet jamais en file les envois UNKNOWN/CLAIMED,
ne modifie pas les messages déjà envoyés et n’efface aucun historique. Les six
résultats incertains précédemment identifiés nécessitent toujours une vérification
de la conversation et ne sont pas automatiquement réessayés.

Les tests locaux sont simulés et ne contactent ni la production ni WhatsApp.
