import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InlineClientCreator } from './inline-client-creator';
import { createClient } from '@/services/clients';

vi.mock('@/services/clients',async original=>({...await original<typeof import('@/services/clients')>(),createClient:vi.fn()}));
beforeEach(()=>{vi.mocked(createClient).mockReset();});
afterEach(cleanup);

it('keeps the package draft and never submits its parent form during client creation',async()=>{
  const saved={id:'new-client',name:'Jean'};
  vi.mocked(createClient).mockResolvedValue(saved as Awaited<ReturnType<typeof createClient>>);
  const parentSubmit=vi.fn(event=>event.preventDefault());const selected=vi.fn();
  render(<form onSubmit={parentSubmit}><input aria-label="Poids du colis" defaultValue="12.5"/><InlineClientCreator onCreated={selected}/></form>);
  fireEvent.click(screen.getByRole('button',{name:'Nouveau client'}));
  fireEvent.change(screen.getByLabelText(/^Nom complet/),{target:{value:'Jean'}});
  fireEvent.change(screen.getByLabelText('Téléphone *'),{target:{value:'+33612345678'}});
  fireEvent.submit(screen.getByLabelText(/^Nom complet/).closest('form')!);
  await waitFor(()=>expect(selected).toHaveBeenCalledWith(saved));
  expect(parentSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Poids du colis')).toHaveValue('12.5');
});

it('Escape only closes nested creation and keeps the caller draft',()=>{
  const outerEscape=vi.fn();window.addEventListener('keydown',outerEscape);
  try {
    render(<><input aria-label="Brouillon" defaultValue="fragile"/><InlineClientCreator onCreated={vi.fn()}/></>);
    fireEvent.click(screen.getByRole('button',{name:'Nouveau client'}));
    fireEvent.keyDown(window,{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Brouillon')).toHaveValue('fragile');
    expect(outerEscape).not.toHaveBeenCalled();
  } finally {window.removeEventListener('keydown',outerEscape);}
});

it('prefills the WhatsApp number and reuses its request key after failure',async()=>{
  vi.mocked(createClient).mockRejectedValue(new Error('offline'));
  render(<InlineClientCreator initialPhone="+33612345678" source="whatsapp" onCreated={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Nouveau client'}));
  expect(screen.getByLabelText('Téléphone *')).toHaveValue('+33612345678');
  fireEvent.change(screen.getByLabelText(/^Nom complet/),{target:{value:'Jean'}});
  const form=screen.getByLabelText(/^Nom complet/).closest('form')!;
  fireEvent.submit(form);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Créer le client'})).toBeEnabled());
  fireEvent.submit(form);
  await waitFor(()=>expect(createClient).toHaveBeenCalledTimes(2));
  const calls=vi.mocked(createClient).mock.calls;
  expect(calls[0][0].source).toBe('whatsapp');
  expect(calls[0][0].idempotency_key).toBeTruthy();
  expect(calls[0][0].idempotency_key).toBe(calls[1][0].idempotency_key);
});
