// Simple invitation choices only. Existing specialised/custom grants stay intact.
export const INVITATION_ROLE_OPTIONS = [
  {code:'MANAGER',label:'Responsable du bureau'},
  {code:'OPERATOR',label:'Opérations'},
  {code:'WAREHOUSE',label:'Entrepôt'},
  {code:'SUPPORT',label:'Service client'},
  {code:'FINANCE',label:'Finance'},
] as const;
