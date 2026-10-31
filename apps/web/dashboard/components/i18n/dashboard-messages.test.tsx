import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {useState} from 'react';
import {dashboardText,translateDashboardMessage,useDashboardMessages,dashboardFormatLocale} from './dashboard-messages';
import {readDashboardLocale,setAgencyDashboardLocale,setDashboardLocale} from './dashboard-language';
import {businessLabel,businessHistoryTitle} from '@/components/ui/business-labels';
import {agencyRoleLabel} from '@/services/agency-labels';
import english from '@/messages/dashboard.en.json';

function Form(){
  useDashboardMessages();
  const [value,setValue]=useState('Client de Tanzanie');
  return <><h1>{dashboardText('Nouvelle facture')}</h1><label>{dashboardText('Nom')}<input value={value} onChange={event=>setValue(event.target.value)}/></label><button>{dashboardText('Enregistrer')}</button><span>{businessLabel('READY_FOR_PICKUP')}</span></>;
}

beforeEach(()=>{localStorage.clear();sessionStorage.clear();document.cookie='NEXT_LOCALE=; path=/; max-age=0';});
afterEach(cleanup);

describe('dashboard translations',()=>{
  it('switches internal labels live in both directions without losing customer input',()=>{
    render(<Form/>);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Marchandises reçues — customer note'}});
    act(()=>setDashboardLocale('en'));
    expect(screen.getByRole('heading')).toHaveTextContent('New invoice');
    expect(screen.getByRole('button')).toHaveTextContent('Save');
    expect(screen.getByText('Ready for pickup')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Marchandises reçues — customer note');
    act(()=>setDashboardLocale('fr'));
    expect(screen.getByRole('heading')).toHaveTextContent('Nouvelle facture');
    expect(screen.getByRole('button')).toHaveTextContent('Enregistrer');
    expect(screen.getByRole('textbox')).toHaveValue('Marchandises reçues — customer note');
  });
  it('uses the agency default unless the person has selected a language',()=>{
    act(()=>setAgencyDashboardLocale('en'));
    expect(readDashboardLocale()).toBe('en');
    act(()=>setDashboardLocale('fr'));
    act(()=>setAgencyDashboardLocale('en'));
    expect(readDashboardLocale()).toBe('fr');
  });
  it('uses the landing language cookie when no dashboard preference is saved',()=>{
    document.cookie='NEXT_LOCALE=en; path=/';
    expect(readDashboardLocale()).toBe('en');
    expect(dashboardFormatLocale()).toBe('en-GB');
  });
  it('substitutes parameters without translating customer content or interpreting markup',()=>{
    expect(translateDashboardMessage('Ouvrir la fiche {0}','en',['Nom français <img>'])).toBe('Open record Nom français <img>');
    expect(translateDashboardMessage('Texte privé inconnu','en')).toBe('Texte privé inconnu');
    expect(translateDashboardMessage('  ','en')).toBe('  ');
    expect(translateDashboardMessage(' Enregistrer ','en')).toBe(' Save ');
  });
  it('translates structured server feedback while preserving the source for French',()=>{
    const source='Votre offre a atteint la limite de 500 colis créés ce mois-ci. Passez à une offre supérieure pour en ajouter. Les éléments existants restent accessibles.';
    expect(translateDashboardMessage(source,'en')).toContain('500 packages created this month');
    expect(translateDashboardMessage(source,'fr')).toBe(source);
    expect(translateDashboardMessage('Certaines données sont invalides ou incompatibles. Adresse email invalide','en')).toBe('Some data is invalid or incompatible. Invalid email address');
    expect(translateDashboardMessage('L’opération a échoué (erreur 503).','en')).toBe('The operation failed (error 503).');
  });
  it('translates business and role labels but preserves custom role names',()=>{
    setDashboardLocale('en');
    expect(businessLabel('PAID')).toBe('Paid');
    expect(agencyRoleLabel('MANAGER')).toBe('Office manager');
    expect(agencyRoleLabel('CUSTOM','Équipe de Dar es Salaam')).toBe('Équipe de Dar es Salaam');
    expect(businessHistoryTitle('CLIENT_MERGED')).not.toContain('CLIENT_MERGED');
  });
  it('does not invent numbered placeholders in English',()=>{
    for(const [source,target] of Object.entries(english)){
      const placeholders=(value:string)=>[...value.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort();
      // French agreement suffixes may be unnecessary in English.
      for(const parameter of placeholders(target))expect(placeholders(source),source).toContain(parameter);
    }
  });
});
