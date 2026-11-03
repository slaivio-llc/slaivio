import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ApiMutationFeedback} from './api-mutation-feedback';
import {API_MUTATION_FAILED_EVENT,API_MUTATION_SUCCEEDED_EVENT} from '@/services/api';
import {PlanLimitNotice} from './plan-limit-notice';
afterEach(cleanup);

it('shows a calm informational quota notification without failure wording',()=>{
 render(<ApiMutationFeedback/>);
 act(()=>window.dispatchEvent(new CustomEvent(API_MUTATION_FAILED_EVENT,{detail:{tone:'info',title:'Capacité de votre offre',message:'Votre offre inclut 1 entrepôt.'}})));
 expect(screen.getByRole('status')).not.toHaveClass('text-red-800');
 expect(screen.queryByText('Échec de l’action')).not.toBeInTheDocument();
 expect(screen.getByText('Capacité de votre offre')).toBeVisible();
});

it('provides a subscription link in the form without an alarming error alert',()=>{
 render(<PlanLimitNotice message="Votre offre inclut 1 bureau."/>);
 expect(screen.getByRole('status')).toHaveTextContent('Votre offre inclut 1 bureau.');
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Consulter les offres'})).toHaveAttribute('href','/app/settings?section=subscription');
});

it('uses the invitation title and restores the normal success title afterwards',()=>{
  render(<ApiMutationFeedback/>);
  act(()=>{window.dispatchEvent(new CustomEvent(API_MUTATION_FAILED_EVENT,{detail:{title:'Invitation non envoyée',message:'Vérifiez les accès.'}}));});
  expect(screen.getByText('Invitation non envoyée')).toBeVisible();
  expect(screen.queryByText('Échec de l’action')).not.toBeInTheDocument();
  act(()=>{window.dispatchEvent(new CustomEvent(API_MUTATION_SUCCEEDED_EVENT,{detail:{message:'Enregistré.'}}));});
  expect(screen.getByText('Terminé')).toBeVisible();
  expect(screen.queryByText('Invitation non envoyée')).not.toBeInTheDocument();
});
