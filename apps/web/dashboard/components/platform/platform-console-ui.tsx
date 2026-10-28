import axios from 'axios';
import type { ReactNode } from 'react';
import { OperationStatus } from '@/components/ui/operation-controls';

export const fieldClass='min-h-10 w-full rounded-lg border border-[#d8dadd] bg-white px-3 text-sm text-[#30363d] outline-none focus:border-[#087a46] focus:ring-2 focus:ring-[#e8f8ef] disabled:bg-slate-50';
export const labels:Record<string,string>={
  ACTIVE:'Actif',SUSPENDED:'Suspendu',CLOSED:'Clôturé',TRIAL:'Essai gratuit',PAST_DUE:'Paiement en retard',CANCELLED:'Annulé',
  OPEN:'Ouvert',REOPENED:'Rouvert',IN_PROGRESS:'En cours',WAITING_CUSTOMER:'En attente de l’agence',RESOLVED:'Résolu',
  LOW:'Faible',NORMAL:'Normale',HIGH:'Élevée',URGENT:'Urgente',DRAFT:'Brouillon',ISSUED:'Émise',PAID:'Payée',VOID:'Annulée',OVERDUE:'Échue',
  CREATING:'Création en cours',PENDING:'En attente',UNKNOWN:'À vérifier',SUCCESS:'Réussi',FAILED:'Échec',SENT:'Envoyé',DELIVERED:'Remis',DONE:'Traité',PROCESSING:'En cours de traitement',
  QUARANTINED:'À examiner',PENDING_REPLAY:'Reprise en attente',REPLAY_FAILED:'Reprise échouée',REPLAYING:'Reprise en cours',MANUALLY_RESOLVED:'Affecté à une agence',ROUTED:'Affecté',REJECTED:'Rejeté',EXPIRED:'Expiré',PROCESSED:'Traité',
  MONTHLY:'Mensuel',QUARTERLY:'Trimestriel',SEMIANNUAL:'Semestriel',YEARLY:'Annuel',OWNER:'Propriétaire',MANAGER:'Responsable',STAFF:'Collaborateur',WAREHOUSE:'Entrepôt',OFFICE:'Bureau',
  AGENCY_STATUS_CHANGED:'Statut d’une agence modifié',SUBSCRIPTION_CHANGED:'Abonnement modifié',AGENCY_NOTE_ADDED:'Note interne ajoutée',SUPPORT_REPLIED:'Réponse du support',PLATFORM_PERMISSIONS_CHANGED:'Accès opérateur modifié',DEMO_REQUEST_UPDATED:'Suivi d’une démo modifié',
  organization:'Agence',subscription:'Abonnement',support_ticket:'Ticket support',platform_operator:'Opérateur',demo_request:'Demande de démo',
};
export const label=(value:unknown)=>value==null||value===''?'—':labels[String(value)]||'Autre état';
export const text=(value:unknown)=>value==null||value===''?'—':String(value);
export function date(value:unknown){if(!value)return '—';const parsed=new Date(String(value));return Number.isNaN(parsed.valueOf())?'—':new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(parsed);}
export function money(value:unknown,currency:unknown){try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:String(currency)}).format(Number(value||0)/100);}catch{return 'Montant à vérifier';}}
export function Status({value}:{value:unknown}){const key=String(value);return <OperationStatus label={label(value)} tone={['ACTIVE','PAID','SUCCESS','RESOLVED','DONE','SENT','DELIVERED'].includes(key)?'success':['FAILED','SUSPENDED','PAST_DUE','REPLAY_FAILED','OVERDUE'].includes(key)?'danger':['PENDING','TRIAL','QUARANTINED','UNKNOWN'].includes(key)?'warning':'neutral'}/>;}
export function Panel({title,description,children}:{title:string;description?:string;children:ReactNode}){return <section className="min-w-0 rounded-xl border border-[#dfe3e4] bg-white p-4 sm:p-5"><h2 className="text-sm font-semibold text-[#242a30]">{title}</h2>{description&&<p className="mt-1 text-xs leading-5 text-[#69747f]">{description}</p>}<div className="mt-4">{children}</div></section>;}
export function Alert({children}:{children:ReactNode}){return <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{children}</p>;}
export function message(error:unknown){
  const code=axios.isAxiosError(error)?error.response?.data?.detail:undefined;
  const known:Record<string,string>={platform_self_permissions_protected:'Vous ne pouvez pas modifier vos propres accès. Demandez à un autre administrateur autorisé.',platform_last_admin_protected:'Le dernier accès administrateur ne peut pas être retiré.',platform_permissions_were_modified:'Les accès ont changé. Rechargez la fiche avant de réessayer.',subscription_future_expiry_required:'Renseignez une échéance future pour activer cet abonnement ou cet essai.'};
  if(typeof code==='string'&&known[code])return known[code];
  if(axios.isAxiosError(error)&&error.response?.status===409)return 'Cette fiche a été modifiée. Fermez-la puis ouvrez-la à nouveau ; votre action n’a pas été enregistrée.';
  if(axios.isAxiosError(error)&&error.response?.status===403)return 'Votre compte n’est pas autorisé à effectuer cette action.';
  return 'L’action n’a pas pu être effectuée. Réessayez ; votre saisie est conservée.';
}
export const permissionLabels:Record<string,string>={
 'platform.admin.read':'Consulter la console et les agences',
 'platform.agencies.manage':'Gérer les agences et les demandes de démo',
 'platform.billing.manage':'Consulter la facturation et gérer les abonnements',
 'platform.support.manage':'Consulter les tickets et répondre aux agences',
 'platform.audit.read':'Consulter le journal des actions',
 'platform.permissions.manage':'Administrer les accès de l’équipe SLAIVIO',
 'quarantine.read':'Consulter le suivi technique',
 'quarantine.resolve':'Affecter les événements à une agence',
 'quarantine.replay':'Autoriser la reprise des événements',
};
