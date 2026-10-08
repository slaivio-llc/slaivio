import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CompanyContacts } from './company-contacts';
const mocks = vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('@/services/api',()=>({api:{get:(...args:unknown[])=>mocks.get(...args),post:(...args:unknown[])=>mocks.post(...args)}}));
beforeEach(()=>{mocks.get.mockReset();mocks.post.mockReset();mocks.get.mockResolvedValue({data:{items:[]}});});
afterEach(cleanup);

it('does not offer contact mutations to a read-only member', async()=>{
  render(<CompanyContacts clientId="company" editable={false}/>);
  await screen.findByText('Aucun contact enregistré.');
  expect(screen.queryByRole('button',{name:'Ajouter un contact'})).not.toBeInTheDocument();
});

it('preserves the company contact form after a failed save', async()=>{
  mocks.post.mockRejectedValue(new Error('offline'));
  render(<CompanyContacts clientId="company" editable/>);
  await screen.findByText('Aucun contact enregistré.');
  fireEvent.click(screen.getByRole('button',{name:'Ajouter un contact'}));
  fireEvent.change(screen.getByLabelText('Nom du contact'),{target:{value:'Marie'}});
  fireEvent.click(screen.getByLabelText('Contact principal'));
  fireEvent.submit(screen.getByLabelText('Nom du contact').closest('form')!);
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith('/clients/company/contacts',expect.objectContaining({name:'Marie',is_primary:true})));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible');
  expect(screen.getByLabelText('Nom du contact')).toHaveValue('Marie');
});
