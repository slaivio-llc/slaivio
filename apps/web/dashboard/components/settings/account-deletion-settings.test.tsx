import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {AccountDeletionSettings} from './account-deletion-settings';
import {api} from '@/services/api';
vi.mock('@/services/api',()=>({api:{post:vi.fn()}}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.post).mockResolvedValue({data:{status:'ok'}});});

it('requires confirmation and submits a request, never immediate account deletion',async()=>{
 render(<AccountDeletionSettings/>);
 fireEvent.click(screen.getByText('Supprimer mon compte Slaivio'));
 const button=screen.getByRole('button',{name:'Demander la suppression de mon compte'});
 expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Tapez SUPPRIMER pour confirmer'),{target:{value:'SUPPRIMER'}});
 fireEvent.click(button);
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/organization/admin/account-deletion-request',{confirmation:'SUPPRIMER'}));
 expect(await screen.findByRole('status')).toHaveTextContent('examen par le support');
});

it('does not claim the request succeeded if the server rejected it',async()=>{
 vi.mocked(api.post).mockRejectedValue(new Error('unavailable'));
 render(<AccountDeletionSettings/>);fireEvent.click(screen.getByText('Supprimer mon compte Slaivio'));
 fireEvent.change(screen.getByLabelText('Tapez SUPPRIMER pour confirmer'),{target:{value:'SUPPRIMER'}});
 fireEvent.click(screen.getByRole('button',{name:'Demander la suppression de mon compte'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas pu être enregistrée');
 expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
