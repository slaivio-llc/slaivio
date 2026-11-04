import {fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {InvoiceWhatsApp} from './invoice-whatsapp';
import {InvoiceWhatsAppSettings} from './invoice-whatsapp-settings';
const service=vi.hoisted(()=>({invoiceWhatsAppStatus:vi.fn(),sendInvoiceWhatsApp:vi.fn(),getFinanceSettings:vi.fn(),configureInvoiceWhatsApp:vi.fn()}));
vi.mock('@/services/finance',()=>service);
vi.mock('@/components/permissions/permission-guard',()=>({PermissionGuard:({children}:{children:React.ReactNode})=>children}));
vi.mock('@/components/i18n/dashboard-messages',()=>({dashboardText:(value:string)=>value}));
describe('private invoice PDF',()=>{
  beforeEach(()=>{vi.clearAllMocks();service.invoiceWhatsAppStatus.mockResolvedValue({state:'NOT_SENT',automatic:false,sent_at:null});});
  afterEach(()=>cleanup());
  it('reading the invoice never sends a message',async()=>{
    render(<InvoiceWhatsApp documentId="invoice"/>);
    expect(await screen.findByText('PDF non envoyé')).toBeInTheDocument();
    expect(service.sendInvoiceWhatsApp).not.toHaveBeenCalled();
  });
  it('queues the PDF once and disables sending while queued',async()=>{
    service.sendInvoiceWhatsApp.mockResolvedValue({state:'QUEUED',automatic:false,sent_at:null});
    render(<InvoiceWhatsApp documentId="invoice"/>);
    await screen.findByText('PDF non envoyé');
    fireEvent.click(screen.getByRole('button',{name:'Envoyer le PDF'}));
    await screen.findByText('PDF en attente d’envoi');
    expect(screen.getByRole('button',{name:'Envoyer le PDF'})).toBeDisabled();
    expect(service.sendInvoiceWhatsApp).toHaveBeenCalledWith('invoice',expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
  it('reuses the request key after a lost response',async()=>{
    service.sendInvoiceWhatsApp.mockRejectedValue(new Error('network'));
    render(<InvoiceWhatsApp documentId="invoice"/>);
    await screen.findByText('PDF non envoyé');
    fireEvent.click(screen.getByRole('button',{name:'Envoyer le PDF'}));
    await screen.findByRole('alert');
    await waitFor(()=>expect(screen.getByRole('button',{name:'Envoyer le PDF'})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button',{name:'Envoyer le PDF'}));
    await waitFor(()=>expect(service.sendInvoiceWhatsApp).toHaveBeenCalledTimes(2));
    expect(service.sendInvoiceWhatsApp.mock.calls[0][1]).toBe(service.sendInvoiceWhatsApp.mock.calls[1][1]);
  });
  it('does not permit a new send if WhatsApp acceptance is uncertain',async()=>{
    service.invoiceWhatsAppStatus.mockResolvedValue({state:'CHECK_REQUIRED',automatic:true,sent_at:null});
    render(<InvoiceWhatsApp documentId="invoice"/>);
    await screen.findByText(/Le résultat de l’envoi/);
    expect(screen.getByRole('button',{name:'Envoyer le PDF'})).toBeDisabled();
  });
  it('asks before resending an accepted invoice',async()=>{
    service.invoiceWhatsAppStatus.mockResolvedValue({state:'SENT',automatic:true,sent_at:'2026-11-04'});
    const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);
    render(<InvoiceWhatsApp documentId="invoice"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Renvoyer le PDF'}));
    expect(confirmation).toHaveBeenCalled();expect(service.sendInvoiceWhatsApp).not.toHaveBeenCalled();
    confirmation.mockRestore();
  });
  it('activation is explicit and never sends old invoices',async()=>{
    service.getFinanceSettings.mockResolvedValue({invoice_whatsapp_enabled:false});
    service.configureInvoiceWhatsApp.mockResolvedValue({automatic:true});
    render(<InvoiceWhatsAppSettings/>);
    const checkbox=screen.getByRole('checkbox');
    await waitFor(()=>expect(checkbox).not.toBeDisabled());
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(()=>expect(service.configureInvoiceWhatsApp).toHaveBeenCalledWith(true));
    expect(checkbox).toBeChecked();expect(service.sendInvoiceWhatsApp).not.toHaveBeenCalled();
  });
});
