import {NextResponse} from 'next/server';

const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
async function proxy(request:Request) {
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))return NextResponse.json({detail:'intake_link_unavailable'},{status:404,headers});
 const base=process.env.NEXT_PUBLIC_API_BASE_URL||process.env.NEXT_PUBLIC_API_URL;
 if(!base)return NextResponse.json({detail:'intake_unavailable'},{status:503,headers});
 try {
  let body:string|undefined;
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>16384)return NextResponse.json({detail:'intake_invalid'},{status:413,headers});
   const reader=request.body?.getReader(),chunks:Uint8Array[]=[];
   let size=0;
   if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
    if(size>16384){await reader.cancel();return NextResponse.json({detail:'intake_invalid'},{status:413,headers});}
    chunks.push(chunk.value);}}
   const bytes=new Uint8Array(size);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   body=new TextDecoder().decode(bytes);
  }
  const result=await fetch(`${base.replace(/\/$/,'')}/public/customer-intake`,{method:request.method,
   headers:{Authorization:authorization,'Content-Type':'application/json'},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  const value=await result.json().catch(()=>({detail:'intake_unavailable'}));
  // Never forward a database trace, proxy HTML, cookies or technical error text.
  if(!result.ok)return NextResponse.json({detail:typeof value.detail==='string'&&/^intake_[a-z_]+$/.test(value.detail)?value.detail:result.status===422?'intake_invalid':'intake_unavailable'},{status:result.status,headers});
  return NextResponse.json(value,{headers});
 }catch{return NextResponse.json({detail:'intake_unavailable'},{status:503,headers});}
}
export const GET=proxy;
export const POST=proxy;
