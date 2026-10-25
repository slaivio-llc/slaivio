import { api } from "./api";

export type SubscriptionPlan = { code:string;name:string;monthly_price_minor:number;currency_code:string;included_features?:string[];max_users?:number|null;max_whatsapp_numbers?:number|null;max_monthly_messages?:number|null };
export type BillingOverview = {
  billing_account_id:string;trial_days:number;access_active:boolean;checkout_available:boolean;
  payer?:{email:string;name:string}|null;
  subscription:{plan_code:string;plan_name:string;status:string;monthly_price_minor:number;currency_code:string;trial_ends_at:string|null;ends_at:string|null}|null;
  invoices:Array<{id:string;invoice_number:string;status:string;total_minor:number;currency_code:string;created_at?:string}>;
  usage:Record<string,number>;
  pending_checkout:{id:string;plan_code:string;status:string;amount_minor?:number;currency_code?:string}|null;
};
export const getSubscriptionBilling=async()=>(await api.get<{billing:BillingOverview}>('/billing')).data.billing;
export const getSubscriptionStatus=async()=>(await api.get<{subscription:{status:string;trial_ends_at:string|null;ends_at:string|null}}>('/billing/status')).data.subscription;
export const getSubscriptionPlans=async()=>(await api.get<{plans:SubscriptionPlan[]}>('/billing/plans')).data.plans;
export const createSubscriptionCheckout=async(payload:{plan_code:string})=>(await api.post<{id:string;checkout_url:string;status:string}>('/billing/checkout',payload)).data;
export const verifySubscriptionCheckout=async(id:string)=>(await api.post<{id:string;status:string}>(`/billing/checkout/${encodeURIComponent(id)}/verify`)).data;
export const cancelSubscriptionCheckout=async(id:string)=>(await api.post<{id:string;status:string}>(`/billing/checkout/${encodeURIComponent(id)}/cancel`)).data;
export function openSubscriptionCheckout(url:string){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['pay.saspay.me','checkout.saspay.me'].includes(parsed.hostname)||parsed.username||parsed.password||parsed.port)throw new Error('invalid_checkout_url');
  window.location.assign(url);
}
