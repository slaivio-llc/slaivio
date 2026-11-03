import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { AnnouncementDelivery } from './announcement-delivery';
import { getCampaign, snapshotCampaign, campaignAction, type Campaign } from '@/services/broadcasts';
import { api } from '@/services/api';
import { setDashboardLocale } from '@/components/i18n/dashboard-language';

vi.mock('@/services/broadcasts', () => ({getCampaign: vi.fn(), snapshotCampaign: vi.fn(), campaignAction: vi.fn()}));
vi.mock('@/services/api', () => ({api: {post: vi.fn()}, apiErrorDetail: () => 'Cette annonce a été modifiée. Vérifiez sa fiche actualisée avant de confirmer.'}));
vi.mock('@/components/permissions/permission-guard', () => ({PermissionGuard: ({children}: {children: ReactNode}) => <>{children}</>}));

const draft = {id:'campaign', title:'Départ', message:'Départ demain', status:'DRAFT', row_version:1,
  channels:['WHATSAPP'], recipient_summary:{eligible:0,excluded:0}} as unknown as Campaign;
const ready = {...draft,row_version:2,recipient_summary:{eligible:3,excluded:1}};
function Subject() {
  const [value,setValue] = useState(draft);
  return <AnnouncementDelivery campaign={value} changed={setValue}/>;
}
beforeEach(() => {vi.clearAllMocks(); localStorage.clear(); setDashboardLocale('fr'); vi.mocked(snapshotCampaign).mockResolvedValue({}); vi.mocked(getCampaign).mockResolvedValue({campaign:ready});});
afterEach(cleanup);

describe('guided announcement delivery', () => {
  it('never approves or sends while preparing, then confirms with the fresh version', async () => {
    vi.mocked(api.post).mockResolvedValue({data:{campaign:{...ready,status:'QUEUED',row_version:3}}});
    render(<Subject/>);
    expect(screen.queryByRole('button',{name:'Lancer'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Préparer l’envoi'}));
    await screen.findByRole('button',{name:'Confirmer l’envoi'});
    expect(screen.getByText('3 destinataire(s) retenu(s)')).toBeInTheDocument();
    expect(screen.getByText('1 contact(s) non retenu(s)')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled(); expect(campaignAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Confirmer l’envoi'}));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/broadcasts/campaign/launch',{expected_version:2}));
    await screen.findByRole('status');
    expect(screen.queryByRole('button',{name:'Confirmer l’envoi'})).not.toBeInTheDocument();
  });
  it('blocks an empty recipient list with clear guidance', async () => {
    vi.mocked(getCampaign).mockResolvedValue({campaign:draft});
    render(<Subject/>); fireEvent.click(screen.getByRole('button',{name:'Préparer l’envoi'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aucun destinataire');
    expect(screen.queryByRole('button',{name:'Confirmer l’envoi'})).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('shows schedule confirmation for a future date', async () => {
    vi.mocked(getCampaign).mockResolvedValue({campaign:{...ready, scheduled_at:'2099-01-01T10:00:00Z'}});
    render(<Subject/>); fireEvent.click(screen.getByRole('button',{name:'Préparer l’envoi'}));
    await screen.findByRole('button',{name:'Confirmer la programmation'});
    expect(api.post).not.toHaveBeenCalled();
  });
  it('does not retry a failed launch automatically', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('conflict'));
    render(<Subject/>); fireEvent.click(screen.getByRole('button',{name:'Préparer l’envoi'}));
    fireEvent.click(await screen.findByRole('button',{name:'Confirmer l’envoi'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette annonce a été modifiée.');
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('prevents double confirmation while a request is pending', async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));
    render(<Subject/>); fireEvent.click(screen.getByRole('button',{name:'Préparer l’envoi'}));
    const button = await screen.findByRole('button',{name:'Confirmer l’envoi'});
    fireEvent.click(button); fireEvent.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
