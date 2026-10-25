import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {NotificationsMenu} from './notifications-menu';
import {listNotifications,type CenterResponse} from '@/services/notification-center';

vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/permissions/permission-provider',()=>({usePermissions:()=>({permissions:[]})}));
vi.mock('@/services/notification-center',()=>({listNotifications:vi.fn(),markAllRead:vi.fn(),notificationAction:vi.fn()}));
const response:CenterResponse={items:[{id:'notice',source:'IN_APP',category:'PACKAGE_RECEIVED',title:'Colis réceptionné',message:'Le colis COL-123 a été reçu.',priority:'NORMAL',created_at:new Date().toISOString(),resource_kind:'PACKAGE',href:'/app/packages?open=123'}],total:1,page:1,page_size:20,stats:{total:1,unread:1,failed:0,urgent:0}};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listNotifications).mockResolvedValue(response);});
it('reserves its final size while loading, in the list and in details',async()=>{
  let resolve!:(value:CenterResponse)=>void;
  vi.mocked(listNotifications).mockReturnValue(new Promise(done=>{resolve=done;}));
  render(<NotificationsMenu close={vi.fn()}/>);
  const popup=screen.getByRole('dialog',{name:'Notifications'});
  expect(popup).toHaveClass('h-[440px]','w-[344px]','max-h-[calc(100dvh-76px)]');
  expect(screen.getByLabelText('Chargement des notifications')).toBeVisible();
  await act(async()=>resolve(response));
  fireEvent.click(await screen.findByRole('button',{name:/Colis réceptionné/}));
  expect(screen.getByText('Détail de la notification')).toBeVisible();
  expect(screen.getByRole('button',{name:/Voir le colis/})).toBeVisible();
  expect(screen.getByRole('dialog')).toBe(popup);
  expect(popup).toHaveClass('h-[440px]');
  fireEvent.click(screen.getByRole('button',{name:'Retour à la liste'}));
  expect(screen.getByRole('dialog')).toBe(popup);
});
it('keeps the same popup size when loading fails',async()=>{
  vi.mocked(listNotifications).mockRejectedValue(new Error('offline'));
  render(<NotificationsMenu close={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Notifications indisponibles.'));
  expect(screen.getByRole('dialog')).toHaveClass('h-[440px]');
});
