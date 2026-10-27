const businessLabels: Record<string, string> = {
  OWNER: "Propriétaire", MANAGER: "Responsable", OPERATOR: "Agent opérationnel",
  WAREHOUSE: "Entrepôt", FINANCE: "Gestion financière", SUPPORT: "Assistance clients",
  AIR: "Aérien", SEA: "Maritime", ROAD: "Routier", RAIL: "Ferroviaire",
  PER_KG: "Au kilogramme", PER_CBM: "Au mètre cube", FLAT: "Forfait",
  CREDIT_NOTE: "Avoir", RECEIPT: "Reçu", MANIFEST: "Manifeste", OTHER: "Autre",
  PARTIAL: "Partiel", OVERDUE: "En retard", VOID: "Annulé", ISSUED: "Émis",
  SUCCESS: "Confirmé", ACCEPTED: "Accepté", RESOLVED: "Résolu", AUTO: "Automatique",
  DOCUMENT_MISSING: "Document manquant",
  PAYMENT_DUE: "Paiement à régulariser",
  QUOTE_FOLLOWUP: "Devis sans réponse",
  PACKAGE_DROP_REMINDER: "Colis à déposer",
  PICKUP_REMINDER: "Retrait à effectuer",
  CLIENT_INACTIVE: "Client inactif",
  DUE: "À effectuer",
  SCHEDULED: "Programmée",
  QUEUED: "En file d’attente",
  SENDING: "En cours d’envoi",
  SENT: "Envoyée",
  DELIVERED: "Délivrée",
  READ: "Lue",
  WAITING_RESPONSE: "En attente de réponse",
  RESPONDED: "Réponse reçue",
  FAILED: "Échec",
  ESCALATED: "Transmise à un responsable",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  DRAFT: "Brouillon",
  OPEN: "Ouvert",
  PREPARING: "En préparation",
  NEAR_CAPACITY: "Presque plein",
  FULL: "Complet",
  PENDING_VALIDATION: "À valider",
  READY_FOR_SHIPMENT: "Prêt à expédier",
  READY_FOR_BATCH: "Prêt au groupage",
  READY_FOR_DISPATCH: "Prêt au départ",
  READY_FOR_PICKUP: "Prêt au retrait",
  CONVERTED_TO_SHIPMENT: "Converti en expédition",
  BLOCKED: "Bloqué",
  ARCHIVED: "Archivé",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  LIMITED: "Capacité limitée",
  SUSPENDED: "Suspendu",
  MAINTENANCE: "En maintenance",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  EXPIRED: "Expiré",
  PUBLISHED: "Publié",
  NEEDS_REVIEW: "À vérifier",
  CONFIRMED: "Confirmé",
  RECEIVED: "Reçu",
  RECEIVED_AT_ORIGIN: "Reçu à l’origine",
  WAREHOUSED: "En entrepôt",
  WAREHOUSE_PROCESSING: "En traitement à l’entrepôt",
  BATCHED: "Groupé",
  SHIPPED: "Expédié",
  DISPATCHED: "Expédiée",
  IN_TRANSIT: "En transit",
  ARRIVED: "Arrivé",
  ARRIVED_DESTINATION: "Arrivé à destination",
  CLEARED: "Dédouané",
  RETURNED: "Retourné",
  PLANNED: "Planifié",
  DELAYED: "En retard",
  DEPARTED: "Parti",
  CHECKED_IN: "Client accueilli",
  VERIFIED: "Vérifié",
  RELEASED: "Remis au client",
  PAID: "Payé",
  UNPAID: "Non payé",
  PARTIALLY_PAID: "Partiellement payé",
  PASSED: "Validé",
  WARNING: "À vérifier",
  PENDING: "En attente",
  MISSING: "Manquant",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  IN_APP: "Tâche interne",
  PHONE: "Appel manuel",
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
  CLIENT: "Client",
  DOSSIER: "Dossier",
  PACKAGE: "Colis",
  INVOICE: "Facture",
  PAYMENT: "Paiement",
  QUOTE: "Devis",
  PICKUP: "Retrait",
  CREATED: "Créé",
  UPDATED: "Mis à jour",
  DEPARTURE: "Départ",
  ARRIVAL: "Arrivée",
  LOADING: "Chargement",
  UNLOADING: "Déchargement",
  CUSTOMS: "Douane",
  CONTROL: "Contrôle",
  INCIDENT: "Incident",
  DELIVERY: "Livraison",
  ETA_UPDATE: "Mise à jour de l’arrivée estimée",
};

export function businessLabel(value: unknown, fallback = "Non renseigné") {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = String(value).trim();
  const key = raw.toUpperCase();
  if (businessLabels[key]) return businessLabels[key];

  // Unknown machine identifiers are not translations. Keep custom, readable
  // agency labels intact, but never turn a backend code into English prose.
  if (/^[a-z\d]+(?:[_.:][a-z\d]+)+$/i.test(raw)) return fallback;
  return raw
    .replaceAll("_", " ")
    .toLocaleLowerCase("fr-FR")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("fr-FR"));
}

const eventLabels: Record<string,string> = {
  'CLIENT.CREATED':'Client créé', 'CLIENT.UPDATED':'Fiche client modifiée',
  'CLIENT.ARCHIVED':'Client archivé', 'CLIENT.RESTORED':'Client restauré',
  'CLIENT.MERGED':'Doublon fusionné', 'CLIENT.MERGED_INTO':'Client fusionné',
  'MESSAGE.INBOUND':'Message reçu', 'MESSAGE.OUTBOUND':'Message envoyé',
  PACKAGE_CREATED:'Colis enregistré', PARCEL_CREATED:'Colis enregistré',
  PACKAGE_UPDATED:'Informations du colis modifiées', PACKAGE_RECEIVED:'Colis reçu',
  PARCEL_INFORMATION_CORRECTED:'Informations du colis corrigées',
  PACKAGE_MEDIA_ADDED:'Photo ou document ajouté', PACKAGE_DOCUMENT_ADDED:'Document ajouté',
  PACKAGE_WEIGHED:'Poids vérifié', PACKAGE_NOTE_ADDED:'Note ajoutée',
  PACKAGE_CHECKLIST_UPDATED:'Contrôles mis à jour', QUALITY_CONTROL:'Contrôle qualité',
  SHIPMENT_CREATED:'Expédition créée', EXPEDITION_CREATED:'Expédition prévue',
  SHIPMENT_UPDATED:'Expédition modifiée', SHIPMENT_PLANNING_CHANGED:'Départ prévu modifié',
  SHIPMENT_DELAY_CHANGED:'Situation du retard modifiée', EXPEDITION_CANCELLED:'Expédition annulée',
  STATUS_CHANGED:'Statut mis à jour', PAYMENT_RECEIVED:'Paiement reçu',
  PAYMENT_CONFIRMED:'Paiement confirmé', PAYMENT_REVERSED:'Paiement annulé',
  PAYMENT_RECORDED:'Paiement enregistré', CREDIT_APPLIED:'Avoir appliqué', CREDIT_RECEIVED:'Avoir reçu',
  CREATED:'Document créé', UPDATED:'Document modifié', ISSUED:'Document émis', VOIDED:'Document annulé',
  QUOTE_ACCEPTED:'Devis accepté', QUOTE_REJECTED:'Devis refusé', QUOTE_CONVERTED:'Devis converti en facture',
  DOCUMENT_ADDED:'Document ajouté', NOTE_ADDED:'Note ajoutée',
  NOTIFICATION_QUEUED:'Message client préparé', PRICING_CALCULATED:'Tarif calculé',
  PRICING_REVIEW_REQUIRED:'Tarif à compléter', ANOMALY_CREATED:'Anomalie signalée',
  ANOMALY_RESOLVED:'Anomalie résolue', FINANCE_LINE_ADDED:'Ligne financière ajoutée',
};

/** Presentation only: stored history, actor IDs and audit evidence stay intact. */
export function businessHistoryTitle(value: unknown, eventType?: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const known = eventLabels[raw.toUpperCase()];
  if (known) return known;
  const translated = raw.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g, token => businessLabels[token] || token);
  if (translated && !/\b[A-Za-z\d]+(?:[_.:][A-Za-z\d]+)+\b/.test(translated) && !/^[A-Z\d _:-]+$/.test(translated)) return translated;
  return eventLabels[String(eventType || '').toUpperCase()] || 'Mise à jour enregistrée';
}
