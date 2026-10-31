import {act,render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {ApiMutationFeedback} from './api-mutation-feedback';
import {API_MUTATION_FAILED_EVENT,API_MUTATION_SUCCEEDED_EVENT} from '@/services/api';

it('uses the invitation title and restores the normal success title afterwards',()=>{
  render(<ApiMutationFeedback/>);
  act(()=>{window.dispatchEvent(new CustomEvent(API_MUTATION_FAILED_EVENT,{detail:{title:'Invitation non envoyée',message:'Vérifiez les accès.'}}));});
  expect(screen.getByText('Invitation non envoyée')).toBeVisible();
  expect(screen.queryByText('Échec de l’action')).not.toBeInTheDocument();
  act(()=>{window.dispatchEvent(new CustomEvent(API_MUTATION_SUCCEEDED_EVENT,{detail:{message:'Enregistré.'}}));});
  expect(screen.getByText('Terminé')).toBeVisible();
  expect(screen.queryByText('Invitation non envoyée')).not.toBeInTheDocument();
});
