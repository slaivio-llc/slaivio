/** Display labels only: API identifiers and custom permissions stay unchanged. */
import {dashboardText} from '@/components/i18n/dashboard-messages';
const roles: Record<string,string> = {
  OWNER:'Propriétaire', MANAGER:'Responsable du bureau', OPERATOR:'Agent opérationnel',
  AGENT:'Agent', WAREHOUSE:'Responsable d’entrepôt', SUPPORT:'Assistance clients',
  FINANCE:'Gestion financière', ADMIN:'Administrateur', ADMINISTRATOR:'Administrateur',
  MEMBER:'Collaborateur', VIEWER:'Consultation uniquement',
};
export function agencyRoleLabel(code:unknown,name?:unknown){
  const key=String(code||'').toUpperCase().replace(/^ORG:/,'');
  if(roles[key])return dashboardText(roles[key]);
  const custom=String(name||'').trim();
  if(roles[custom.toUpperCase()])return dashboardText(roles[custom.toUpperCase()]);
  return custom && !/^[A-Z0-9_:-]+$/.test(custom) ? custom : dashboardText('Rôle personnalisé');
}
export function agencyStatusLabel(value:unknown){
  const labels:Record<string,string>={PENDING:'En attente',ACCEPTED:'Acceptée',REVOKED:'Révoquée',EXPIRED:'Expirée',
    ACTIVE:'Actif',INACTIVE:'Inactif',SUSPENDED:'Suspendu',INVITED:'Invité',CANCELLED:'Annulée',FAILED:'Échec',COMPLETED:'Terminé',PROCESSING:'En cours'};
  return dashboardText(labels[String(value||'').toUpperCase()]||'État à vérifier');
}
