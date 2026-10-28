import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { KnowledgePage } from './knowledge-page';
import { getPilotKnowledge, getPilotKnowledgeStats, listPilotKnowledge, publishPilotKnowledge, type PilotKnowledgeItem } from '@/services/knowledge';

const access=vi.hoisted(()=>({publish:true}));
vi.mock('@/components/permissions/permission-guard',()=>({PermissionGuard:({permission,children}:{permission:string;children:ReactNode})=>permission==='pilot.knowledge.publish'&&!access.publish?null:children}));
vi.mock('@/services/tenant',()=>({getTenantContext:()=>Promise.resolve({active_tenant:{organization_type:'PARCEL_FREIGHT'}})}));
vi.mock('@/services/knowledge',async original=>({...await original<typeof import('@/services/knowledge')>(),getPilotKnowledge:vi.fn(),getPilotKnowledgeStats:vi.fn(),listPilotKnowledge:vi.fn(),publishPilotKnowledge:vi.fn()}));
const draft:PilotKnowledgeItem={id:'knowledge',reference:'CON-1',subject:'Dépôt en Chine',answer:'Déposez les colis à notre entrepôt.',kind:'CLIENT_ANSWER',category:'GENERAL',client_visible:true,status:'DRAFT',internal_status:'DRAFT',language:'FR',version:4,updated_at:'2026-10-24T12:00:00Z'};
beforeEach(()=>{
  vi.clearAllMocks();access.publish=true;
  vi.mocked(listPilotKnowledge).mockResolvedValue({items:[draft],total:1});
  vi.mocked(getPilotKnowledge).mockResolvedValue(draft);
  vi.mocked(getPilotKnowledgeStats).mockResolvedValue({total:1,published:0,drafts:1,needs_review:0,available_to_ai:0,archived:0,default_language:'FR',pilot_default_review_days:30});
  vi.mocked(publishPilotKnowledge).mockResolvedValue({...draft,status:'PUBLISHED',version:5});
});
async function open(){render(<KnowledgePage embedded/>);fireEvent.click(await screen.findByRole('button',{name:/Dépôt en Chine/}));await screen.findByRole('dialog',{name:'Fiche connaissance'});}
it('requires confirmation and sends the current version to publish a draft',async()=>{
  await open();
  fireEvent.click(screen.getByRole('button',{name:'Vérifier et publier'}));
  expect(publishPilotKnowledge).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button',{name:'Publier'}));
  await waitFor(()=>expect(publishPilotKnowledge).toHaveBeenCalledWith('knowledge',4));
});
it('does not offer publication without the publication permission',async()=>{
  access.publish=false;await open();
  expect(screen.queryByRole('button',{name:'Vérifier et publier'})).not.toBeInTheDocument();
});
it('keeps the confirmation open when the server refuses the version',async()=>{
  vi.mocked(publishPilotKnowledge).mockRejectedValueOnce(new Error('version conflict'));
  await open();fireEvent.click(screen.getByRole('button',{name:'Vérifier et publier'}));
  fireEvent.click(await screen.findByRole('button',{name:'Publier'}));
  await waitFor(()=>expect(publishPilotKnowledge).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Rechargez la fiche puis réessayez/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Publier'})).toBeInTheDocument();
});
