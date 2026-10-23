import { NextResponse,type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from 'cloudflare:workers';
export async function middleware(request:NextRequest){
 let response=NextResponse.next();
 if(env.AUTH_PROVIDER==='supabase'&&env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY){
  const client=createServerClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{for(const {name,value}of values)request.cookies.set(name,value);response=NextResponse.next({request});for(const {name,value,options}of values)response.cookies.set(name,value,options);}}});
  await client.auth.getUser();
 }
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','same-origin');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('Content-Security-Policy',"base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'");
 if(request.nextUrl.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|icons/).*)']};
