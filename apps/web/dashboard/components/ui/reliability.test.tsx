import {fireEvent,render,screen,within} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {SettingsDialog} from './settings-dialog';
import {TableSkeleton} from './page-state';

it('keeps loading columns shrinkable on narrow screens and renders exactly one cell for one column',()=>{
  const {container}=render(<TableSkeleton rows={2} columns={1}/>);
  const skeleton=screen.getByRole('status');
  expect(skeleton).toHaveClass('min-w-0','overflow-hidden');
  expect(skeleton.children).toHaveLength(3);
  for(const row of skeleton.children){
    expect(row).toHaveStyle({gridTemplateColumns:'repeat(1, minmax(0, 1fr))'});
    expect(row.children).toHaveLength(1);
  }
  expect(container.querySelector('.motion-safe\\:animate-pulse')).not.toBeNull();
});

it('traps settings focus, handles Escape and restores the opening control and scroll',()=>{
  const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();
  const close=vi.fn();
  const {unmount}=render(<SettingsDialog title="Paramètres" description="Agence" navigation={<button>Profil</button>} onClose={close}><button>Enregistrer</button></SettingsDialog>);
  const dialog=screen.getByRole('dialog');expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog,{key:'Tab'});expect(within(dialog).getByRole('button',{name:'Profil'})).toHaveFocus();
  fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});expect(within(dialog).getByRole('button',{name:'Enregistrer'})).toHaveFocus();
  fireEvent.keyDown(dialog,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);
  unmount();expect(trigger).toHaveFocus();expect(document.body.style.overflow).toBe('');trigger.remove();
});

it('does not close the settings behind a nested dialog on Escape',()=>{
  const close=vi.fn();render(<SettingsDialog title="Paramètres" description="Agence" navigation={null} onClose={close}><div role="dialog" aria-label="Confirmation"><button>Confirmer</button></div></SettingsDialog>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Confirmer'}),{key:'Escape'});
  expect(close).not.toHaveBeenCalled();
});
