"use client";

import english from '@/messages/dashboard.en.json';
import {readDashboardPresentationLocale,useDashboardLocale,type DashboardLocale} from './dashboard-language';

const messages:Readonly<Record<string,string>>=english;

/** UI messages only: never apply this to customer names, notes or API values. */
export function translateDashboardMessage(source:string,locale:DashboardLocale,values:readonly unknown[]=[]):string {
  const text=source.trim();
  if(!text)return source;
  if(locale==='en'&&!messages[text]){
    // Documented system feedback can contain numbers or another error message.
    // Keep its French source in state so switching back never loses the original.
    const quota=/^Votre offre a atteint la limite de (\d+) (colis créés ce mois-ci|membres et invitations en attente|bureaux|entrepôts|numéros WhatsApp)\. Passez à une offre supérieure pour en ajouter\. Les éléments existants restent accessibles\.$/.exec(text);
    if(quota)return translateDashboardMessage('Votre offre a atteint la limite de {0} {1}. Passez à une offre supérieure pour en ajouter. Les éléments existants restent accessibles.',locale,[quota[1],translateDashboardMessage(quota[2],locale)]);
    for(const prefix of ['Cette opération entre en conflit avec l’état actuel.','Certaines données sont invalides ou incompatibles.']){
      if(text.startsWith(prefix+' '))return translateDashboardMessage(prefix,locale)+' '+translateDashboardMessage(text.slice(prefix.length+1),locale);
    }
    const failure=/^L’opération a échoué \(erreur (\d{3})\)\.$/.exec(text);
    if(failure)return translateDashboardMessage('L’opération a échoué (erreur {0}).',locale,[failure[1]]);
    const sync=/^(\d+) opération\(s\) doivent être vérifiée\(s\)\.$/.exec(text);
    if(sync)return translateDashboardMessage('{0} opération(s) doivent être vérifiée(s).',locale,[sync[1]]);
    const followups=/^(\d+) relance\(s\) ont échoué durant les 30 derniers jours\. Vérifiez-les avant le lancement\.$/.exec(text);
    if(followups)return translateDashboardMessage('{0} relance(s) ont échoué durant les 30 derniers jours. Vérifiez-les avant le lancement.',locale,[followups[1]]);
  }
  const translated=locale==='en'?(messages[text]||text):text;
  const result=translated.replace(/\{(\d+)\}/g,(match,index)=>Number(index)<values.length?String(values[Number(index)]??''):match);
  return source.slice(0,source.length-source.trimStart().length)+result+source.slice(source.trimEnd().length);
}

export function dashboardText(source:string,...values:unknown[]):string;
export function dashboardText<T>(source:T):T;
export function dashboardText(source:unknown,...values:unknown[]):unknown {
  return typeof source==='string'?translateDashboardMessage(source,readDashboardPresentationLocale(),values):source;
}

/** Subscribe a component without remounting it or discarding unsaved input. */
export function useDashboardMessages(){return useDashboardLocale();}
export function dashboardFormatLocale(){return readDashboardPresentationLocale()==='en'?'en-GB':'fr-FR';}
