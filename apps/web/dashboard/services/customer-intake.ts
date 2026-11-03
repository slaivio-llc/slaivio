export type Dropoff = {warehouse_id:string;recipient:string;address:string;country:string|null;city:string|null;phone:string|null;instructions:string|null};
export type IntakeOffering = {id:string;service_name:string;route_name:string;origin_country:string;origin_city:string;destination_country:string;destination_city:string;shipping_mode:string;dropoff:Dropoff|null};
export type IntakeReceipt = {reference:string;shipping_mark:string;agency_name:string;full_name:string;service_name:string;route_name:string;dropoff:Dropoff|null;dropoff_withdrawn?:boolean;package_count:number;estimated_weight_kg:number|null};
export type IntakeContext = {agency_name:string;phone:string;offerings:IntakeOffering[];receipt:IntakeReceipt|null};

export function supplierInstructions(receipt:IntakeReceipt):string {
 const d=receipt.dropoff;
 if(!d)return '';
 // Stable supplier labels: Chinese addresses and instructions are preserved verbatim.
 return [`Shipping mark / 唛头: ${receipt.shipping_mark}`,`Customer / 客户: ${receipt.full_name}`,
  `Recipient / 收件人: ${d.recipient}`,`Address / 地址: ${d.address}`,
  [d.city,d.country].filter(Boolean).join(', '),d.phone?`Phone / 电话: ${d.phone}`:'',
  d.instructions?`Instructions / 备注: ${d.instructions}`:''].filter(Boolean).join('\n');
}

export async function publicIntake(token:string,payload?:unknown):Promise<IntakeContext|IntakeReceipt> {
 const response=await fetch('/api/customer-intake',{method:payload?'POST':'GET',cache:'no-store',
  headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})});
 if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(typeof value.detail==='string'?value.detail:'intake_unavailable');}
 return response.json();
}
