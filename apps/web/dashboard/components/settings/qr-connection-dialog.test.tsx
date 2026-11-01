import {useState} from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {QRConnectionDialog} from './pilot-settings-page';

it('shows QR instructions without the pilot banner and still requires authorisation',()=>{
 const generate=vi.fn();
 function Dialog(){
  const [accepted,setAccepted]=useState(false);
  return <QRConnectionDialog connection={null} accepted={accepted} setAccepted={setAccepted} busy={false} error="" close={()=>{}} generate={generate}/>;
 }
 render(<Dialog/>);
 expect(screen.queryByText('Information importante')).not.toBeInTheDocument();
 expect(screen.queryByText(/API officielle Meta|accepte ce risque|mode pilote/)).not.toBeInTheDocument();
 expect(screen.getByText('WhatsApp → Appareils connectés → Connecter un appareil')).toBeVisible();
 const button=screen.getByRole('button',{name:'Afficher le QR code'});
 expect(button).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox',{name:'Je confirme être autorisé à connecter ce numéro WhatsApp à Slaivio.'}));
 expect(button).toBeEnabled();
 fireEvent.click(button);
 expect(generate).toHaveBeenCalledTimes(1);
});
