import {NextResponse} from 'next/server';

export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{48}$/.test(token))return new NextResponse('Document indisponible.',{status:404});
 const base=process.env.NEXT_PUBLIC_API_BASE_URL||process.env.NEXT_PUBLIC_API_URL;
 if(!base)return new NextResponse('Document temporairement indisponible.',{status:503});
 try{
  const response=await fetch(`${base.replace(/\/$/,'')}/public/customer-documents/${token}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return new NextResponse('Ce document est indisponible ou son lien a expiré. Contactez votre agence.',{status:response.status===404?404:503});
  return new NextResponse(await response.text(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
 }catch{return new NextResponse('Document temporairement indisponible. Réessayez ultérieurement.',{status:503});}
}
