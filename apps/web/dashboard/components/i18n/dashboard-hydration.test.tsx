import {act} from '@testing-library/react';
import {renderToString} from 'react-dom/server';
import {hydrateRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {dashboardText,useDashboardMessages} from './dashboard-messages';

function Screen(){useDashboardMessages();return <h1>{dashboardText('Nouvelle facture')}</h1>;}

it('hydrates the server snapshot and then restores the English preference without a mismatch',async()=>{
  localStorage.setItem('slaivio-locale','en');
  const element=document.createElement('div');
  element.innerHTML=renderToString(<Screen/>);
  expect(element.textContent).toBe('Nouvelle facture');
  document.body.append(element);
  const errors:unknown[]=[];
  const spy=vi.spyOn(console,'error').mockImplementation((...args)=>errors.push(args));
  let root:ReturnType<typeof hydrateRoot>;
  await act(async()=>{root=hydrateRoot(element,<Screen/>,{onRecoverableError:error=>errors.push(error)});});
  expect(element.textContent).toBe('New invoice');
  expect(errors).toEqual([]);
  await act(async()=>root.unmount());
  element.remove();localStorage.clear();spy.mockRestore();
});
