import {expect,it} from 'vitest';
import {businessLabel,businessHistoryTitle} from './business-labels';

it('translates operational codes instead of displaying English technical identifiers',()=>{
  expect(businessLabel('READY_FOR_PICKUP')).toBe('Prêt au retrait');
  expect(businessLabel('PER_CBM')).toBe('Au mètre cube');
  expect(businessLabel('OWNER')).toBe('Propriétaire');
  expect(businessLabel('new_backend_state','État à vérifier')).toBe('État à vérifier');
});
it('makes legacy history titles readable without modifying agency explanations',()=>{
  expect(businessHistoryTitle('Statut : READY_FOR_PICKUP')).toBe('Statut : Prêt au retrait');
  expect(businessHistoryTitle('client.updated')).toBe('Fiche client modifiée');
  expect(businessHistoryTitle('INTERNAL_UNKNOWN_ACTION')).toBe('Mise à jour enregistrée');
  expect(businessHistoryTitle('technical_event','PAYMENT_CONFIRMED')).toBe('Paiement confirmé');
  expect(businessHistoryTitle('Départ reporté à la demande du client')).toBe('Départ reporté à la demande du client');
});
