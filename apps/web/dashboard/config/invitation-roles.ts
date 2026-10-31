// Simple invitation choices only. Existing specialised/custom grants stay intact.
export const INVITATION_ROLE_OPTIONS = [
  {code:'MANAGER',label:'Responsable du bureau'},
  {code:'OPERATOR',label:'Opérations'},
  {code:'WAREHOUSE',label:'Entrepôt'},
  {code:'SUPPORT',label:'Service client'},
  {code:'FINANCE',label:'Finance'},
] as const;

export const INVITATION_ROLE_SUMMARIES:Record<string,string>={
  MANAGER:'Gère les opérations, la finance et l’équipe du bureau, sans administrer le réseau ni l’abonnement.',
  OPERATOR:'Crée et suit les colis, prépare les expéditions et applique les tarifs du bureau.',
  WAREHOUSE:'Réceptionne, pèse et organise les colis en entrepôt, sans gérer les encaissements.',
  SUPPORT:'Répond aux clients et consulte le suivi des colis, sans modifier les opérations ni les paiements.',
  FINANCE:'Prépare les factures, enregistre les paiements et exporte les données financières.',
};
