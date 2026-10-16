import {api} from "./api";
export async function assignFinanceOffice(documentId:string,office_id:string,expected_version:number){return (await api.post(`/finance/${documentId}/office`,{office_id,expected_version})).data}
export type FinanceDocument={id:string;document_type:"QUOTE"|"INVOICE"|"CREDIT_NOTE";document_number:string;client_id:string;client_name:string;dossier_reference?:string;status:string;currency:string;subtotal:number;discount_total:number;tax_total:number;total:number;amount_paid:number;balance_due:number;due_date?:string;row_version:number;created_at:string;lines?:FinanceLine[];payments?:FinancePayment[];events?:Array<{id:string;event_type:string;actor_name?:string;created_at:string}>};
export type FinanceLine={description:string;quantity:number;unit_price:number;discount_rate:number;tax_rate:number;line_total?:number};
export type FinancePayment={id:string;receipt_number:string;amount:number;currency:string;method:string;reference?:string;paid_at:string;status:"CONFIRMED"|"REVERSED";receipt_snapshot?:{version:number}|null;provider?:string|null;provider_amount?:number|null;provider_fee?:number|null;provider_charged?:number|null;provider_net_amount?:number|null;fee_charge_mode?:"ADD_ON"|"DEDUCTED"|null};
export async function paymentReceipt(documentId:string,paymentId:string){return (await api.get<Blob>(`/finance/${documentId}/payments/${paymentId}/receipt`,{responseType:"blob"})).data}
export async function getPackageInvoice(packageId:string){return (await api.get<FinanceDocument|null>(`/finance/packages/${packageId}/invoice`)).data}
export async function createPackageInvoice(packageId:string,expected_version:number){return (await api.post<FinanceDocument>(`/finance/packages/${packageId}/invoice`,{expected_version})).data}
export type FinanceStats={invoices:number;drafts:number;overdue:number;by_currency:{currency:string;invoiced:number;collected:number;outstanding:number}[]};
export async function listFinance(params:Record<string,unknown>={}){return (await api.get<{items:FinanceDocument[];pagination:{total:number}}>("/finance",{params})).data}
export async function financeStats(){return (await api.get<FinanceStats>("/finance/stats")).data}
export type FinancePaymentRow={id:string;receipt_number:string;document_id:string;document_number:string;client_id:string;client_name:string;amount:number;currency:string;method:string;reference:string|null;paid_at:string;status:"CONFIRMED"|"REVERSED";recorded_by_name:string|null;office_id:string|null};
export type FinanceBalanceRow={client_id:string;client_name:string;currency:string;invoice_count:number;invoiced:number;paid:number;balance:number;due_now:number;next_due:string|null};
export async function listFinancePayments(params:Record<string,unknown>={}){return (await api.get<{items:FinancePaymentRow[];pagination:{page:number;page_size:number;total:number;total_pages:number}}>("/finance/payments",{params})).data}
export async function listFinanceBalances(params:Record<string,unknown>={}){return (await api.get<{items:FinanceBalanceRow[];pagination:{page:number;page_size:number;total:number;total_pages:number}}>("/finance/balances",{params})).data}
export async function createFinance(payload:{document_type:string;client_id:string;currency:string;due_date?:string|null;notes?:string|null;terms?:string|null;lines:FinanceLine[]}){return (await api.post<FinanceDocument>("/finance",payload)).data}
export async function getFinance(id:string){return (await api.get<FinanceDocument>(`/finance/${id}`)).data}
export async function issueFinance(id:string,expected_version:number){return (await api.post<FinanceDocument>(`/finance/${id}/issue`,{expected_version})).data}
export async function payFinance(id:string,payload:{amount:number;currency:string;method:string;reference?:string|null;paid_at:string;idempotency_key:string}){return (await api.post<FinancePayment>(`/finance/${id}/payments`,payload)).data}
export type SasPayAttempt={id:string;status:"CREATING"|"PENDING"|"AMBIGUOUS"|"SUCCEEDED"|"FAILED"|"CANCELLED";requested_amount:string;currency:string;checkout_url:string|null;created_at:string};
export async function startSasPayCheckout(documentId:string,idempotency_key:string){return (await api.post<SasPayAttempt>(`/finance/${documentId}/saspay-checkout`,{idempotency_key})).data}
export async function getOpenSasPayAttempt(documentId:string){return (await api.get<SasPayAttempt|null>(`/finance/${documentId}/saspay-attempts`)).data}
export async function getSasPayAttempt(documentId:string,attemptId:string){return (await api.get<SasPayAttempt>(`/finance/${documentId}/saspay-attempts/${attemptId}`)).data}
export async function reconcileSasPayCheckout(documentId:string,attemptId:string){return (await api.post<{status:string;payment_id?:string}>(`/finance/${documentId}/saspay-attempts/${attemptId}/reconcile`)).data}
export async function voidFinance(id:string,expected_version:number,reason:string){return (await api.post<FinanceDocument>(`/finance/${id}/void`,{expected_version,reason})).data}
export async function exportFinance(){return (await api.get<Blob>("/finance/export",{responseType:"blob"})).data}
export type FinanceSettings={legal_name:string|null;tax_identifier:string|null;billing_address:string|null;default_currency:string;default_tax_rate:number;default_payment_terms_days:number;document_footer:string|null};
export type FinanceDuePolicy={id?:string;name:string;shipping_service_id?:string|null;trigger_event:"DEPARTURE"|"RECEPTION"|"ARRIVAL"|"DELIVERY"|"MANUAL";rule_type:"PERCENTAGE"|"FIXED_AMOUNT";percentage?:number|null;fixed_amount?:number|null;currency:string;is_active:boolean;row_version?:number};
export async function getFinanceSettings(){return (await api.get<FinanceSettings>("/finance/settings")).data}
export async function saveFinanceSettings(p:FinanceSettings){return (await api.put<FinanceSettings>("/finance/settings",p)).data}
export async function listFinanceDuePolicies(){return (await api.get<FinanceDuePolicy[]>("/finance/due-policies")).data}
export async function saveFinanceDuePolicy(policy:FinanceDuePolicy){return (await api.post<FinanceDuePolicy>("/finance/due-policies",policy)).data}
export async function getFinanceDueObligations(documentId:string){return (await api.get<Array<{id:string;amount:number;currency:string;trigger_event:string;status:string}>>(`/finance/${documentId}/due-obligations`)).data}
export async function refreshFinanceDueObligations(documentId:string,trigger_event?:string){return (await api.post<Array<{id:string;amount:number;currency:string;trigger_event:string;status:string}>>(`/finance/${documentId}/due-obligations`,trigger_event?{trigger_event}:{})).data}
export async function decideQuote(id:string,expected_version:number,accepted:boolean,reason?:string|null){return (await api.post(`/finance/${id}/decision`,{expected_version,accepted,reason})).data}
export async function convertQuote(id:string,expected_version:number,due_date?:string|null){return (await api.post<FinanceDocument>(`/finance/${id}/convert`,{expected_version,due_date})).data}
export async function applyCredit(id:string,expected_version:number,invoice_id:string){return (await api.post(`/finance/${id}/apply-credit`,{expected_version,invoice_id})).data}
export async function reverseFinancePayment(documentId:string,paymentId:string,reason:string){return (await api.post(`/finance/${documentId}/payments/${paymentId}/reverse`,{reason})).data}
export async function financePrint(id:string){return (await api.get<string>(`/finance/${id}/print`,{responseType:"text"})).data}
export async function refreshFinanceOverdue(){return (await api.post<{updated:number}>("/finance/overdue/refresh")).data}
