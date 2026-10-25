import {api} from './api';
export type CenterItem={id:string;source:'IN_APP'|'DELIVERY';category:string;title:string;message:string;priority:string;created_at:string;read_at?:string;archived_at?:string;resource_id?:string;resource_kind?:string;href?:string;delivery_status?:string;error_message?:string};
export type CenterResponse={items:CenterItem[];total:number;page:number;page_size:number;stats:{total:number;unread:number;failed:number;urgent:number}};
export type NotificationPreference={category:string;in_app:boolean;email:boolean;whatsapp:boolean;quiet_hours_start?:string;quiet_hours_end?:string;digest_frequency:string};
export function agencyNotification(item:CenterItem):CenterItem{
  const technical=/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
  const legacy=/fournisseur|provider|notification_updated/i.test(`${item.title} ${item.message}`);
  if(legacy&&(item.source==='DELIVERY'||item.category==='NOTIFICATION_UPDATED')){
    const copy:Record<string,[string,string]>={SENT:['Message client envoyé','Le message a été envoyé au destinataire.'],DELIVERED:['Message reçu par le destinataire','La réception du message a été confirmée.'],READ:['Message lu','Le destinataire a lu le message.'],FAILED:['Message client non envoyé','Vérifiez le numéro du destinataire et la connexion de messagerie avant de réessayer.'],PENDING:['Message client en attente','L’envoi de ce message n’est pas encore confirmé.'],CANCELLED:['Envoi du message annulé','L’envoi de ce message a été annulé.']};
    const [title,message]=copy[item.delivery_status||'']||['Suivi d’un message client','Une mise à jour de l’envoi d’un message client est disponible.'];
    return {...item,title,message,error_message:undefined};
  }
  return {...item,title:technical.test(item.title)?'Mise à jour de votre activité':item.title,message:technical.test(item.message)?'Une mise à jour est disponible. Consultez l’élément concerné pour plus de détails.':item.message,error_message:undefined};
}
export async function listNotifications(params:Record<string,unknown>={}){const result=(await api.get<CenterResponse>('/notification-center',{params})).data;return {...result,items:result.items.map(agencyNotification)}}
export async function notificationAction(item:CenterItem,action:string,minutes?:number){return (await api.patch(`/notification-center/${item.source}/${item.id}`,{action,minutes})).data}
export async function markAllRead(){return (await api.post('/notification-center/read-all')).data}
export async function retryDelivery(id:string){return (await api.post(`/notification-center/delivery/${id}/retry`)).data}
export async function getNotificationPreferences(){return (await api.get<{preferences:NotificationPreference[]}>('/notification-center/preferences')).data.preferences}
export async function saveNotificationPreference(payload:NotificationPreference){return (await api.put('/notification-center/preferences',payload)).data}
