import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { LandingPageClient } from './landing-page-client';
import { createDemoRequest } from '@/services/landing';

const locale=vi.hoisted(()=>({value:'fr'}));
vi.mock('next-intl',()=>({useLocale:()=>locale.value}));
vi.mock('@/services/landing',()=>({createDemoRequest:vi.fn()}));
vi.mock('@/components/ui/slaivio-brand',()=>({SlaivioBrand:()=> <span>Slaivio</span>}));
beforeEach(()=>{vi.clearAllMocks();locale.value='fr';vi.mocked(createDemoRequest).mockResolvedValue({id:'request'});});

function openForm(){
  fireEvent.click(screen.getAllByRole('button',{name:'Demander une démo'})[0]);
  return screen.getByRole('dialog');
}
function fillForm(dialog:HTMLElement){
  fireEvent.change(within(dialog).getByLabelText('Nom complet'),{target:{value:' Awa Sossou '}});
  fireEvent.change(within(dialog).getByLabelText('Email professionnel'),{target:{value:'awa@example.com'}});
  fireEvent.change(within(dialog).getByLabelText('Nom de l’agence'),{target:{value:'Cargo Express'}});
  fireEvent.change(within(dialog).getByLabelText('Pays'),{target:{value:'Bénin'}});
}

it('presents only parcels and freight, login and demo requests without invented integrations or sign-up offers',()=>{
  render(<LandingPageClient/>);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Vos colis avancent.Votre agence aussi.');
  expect(screen.getAllByRole('link',{name:'Connexion'})[0]).toHaveAttribute('href','/sign-in');
  expect(document.querySelector('a[href*="sign-up"]')).toBeNull();
  expect(screen.queryByText(/TikTok|Gmail|99,9|clients satisfaits/)).not.toBeInTheDocument();
  expect(createDemoRequest).not.toHaveBeenCalled();
  expect(screen.getAllByText('Aperçu illustratif · Données d’exemple')).toHaveLength(2);
});

it('makes the illustrative product tabs work without loading private APIs',()=>{
  render(<LandingPageClient/>);
  const button=screen.getByRole('button',{name:'Expéditions'});
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('table')).toHaveTextContent('EXP-2026-0008');
});

it('shows the real monthly prices and capacity differences with demo actions',()=>{
  render(<LandingPageClient/>);
  expect(screen.getByRole('link',{name:'Tarifs'})).toHaveAttribute('href','#tarifs');
  const pricing=screen.getByRole('region',{name:/Un cadre pour démarrer/});
  for(const [name,price,capacity] of [['Starter','119','500 colis / mois'],['Pro','229','2 500 colis / mois'],['Business','799','15 000 colis / mois']]){
    const card=within(pricing).getByRole('article',{name});
    expect(card).toHaveTextContent(`${price} $`);
    expect(card).toHaveTextContent(capacity);
    expect(card).toHaveTextContent('USD · Facturation mensuelle');
  }
  expect(within(pricing).getByRole('article',{name:'Starter'})).not.toHaveTextContent('relances répétées');
  fireEvent.click(within(pricing).getByRole('button',{name:'Demander une démo · Pro'}));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(createDemoRequest).not.toHaveBeenCalled();
});

it('opens the accessible demo form and restores focus when closed using Escape',()=>{
  render(<LandingPageClient/>);
  const trigger=screen.getAllByRole('button',{name:'Demander une démo'})[0];
  trigger.focus();
  const dialog=openForm();
  expect(within(dialog).getByLabelText('Nom complet')).toHaveFocus();
  fireEvent.keyDown(dialog,{key:'Escape'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('records one actual demo request and shows success only after the API confirms it',async()=>{
  let finish!:(value:unknown)=>void;
  vi.mocked(createDemoRequest).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  render(<LandingPageClient/>);const dialog=openForm();fillForm(dialog);
  const form=within(dialog).getByRole('button',{name:'Demander une démo'}).closest('form')!;
  fireEvent.submit(form);fireEvent.submit(form);
  expect(createDemoRequest).toHaveBeenCalledTimes(1);
  expect(createDemoRequest).toHaveBeenCalledWith({full_name:'Awa Sossou',email:'awa@example.com',agency_name:'Cargo Express',country:'Bénin',phone:'',message:''});
  expect(screen.queryByRole('heading',{name:'Votre demande est enregistrée.'})).not.toBeInTheDocument();
  finish({id:'request'});
  expect(await screen.findByRole('heading',{name:'Votre demande est enregistrée.'})).toBeVisible();
});

it('preserves the form if the API fails and allows retrying',async()=>{
  vi.mocked(createDemoRequest).mockRejectedValueOnce(new Error('offline'));
  render(<LandingPageClient/>);const dialog=openForm();fillForm(dialog);
  fireEvent.submit(within(dialog).getByRole('button',{name:'Demander une démo'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Votre saisie est conservée');
  expect(within(dialog).getByLabelText('Nom de l’agence')).toHaveValue('Cargo Express');
  fireEvent.submit(within(dialog).getByRole('button',{name:'Demander une démo'}).closest('form')!);
  await waitFor(()=>expect(createDemoRequest).toHaveBeenCalledTimes(2));
});

it('keeps the English landing and language switch available',()=>{
  locale.value='en';render(<LandingPageClient/>);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Your parcels move forward.');
  expect(screen.getAllByRole('link',{name:'Log in'})[0]).toHaveAttribute('href','/sign-in');
  expect(screen.getByRole('link',{name:'Lire en français'})).toHaveAttribute('href','/fr');
});
