import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { getChatGPTUser,chatGPTSignInPath } from '../../app/chatgpt-auth';
import { AccessError } from '../access';
export const standardAuth=()=>env.AUTH_PROVIDER==='supabase';
export function authConfigured(){
 if(!standardAuth()||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return false;
 try{const url=new URL(env.SUPABASE_URL);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/';}catch{return false;}
}
export const googleAuthEnabled=()=>authConfigured()&&env.GOOGLE_AUTH_ENABLED==='true';
export async function authClient(){
 if(!authConfigured())throw new AccessError('Account sign-in is being set up. Please try again later.',503);
 const jar=await cookies();
 return createServerClient(env.SUPABASE_URL!,env.SUPABASE_PUBLISHABLE_KEY!,{cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},cookies:{getAll:()=>jar.getAll(),setAll:values=>{for(const {name,value,options} of values)jar.set(name,value,options);}}});
}
export async function getUser(){
 if(!env.AUTH_PROVIDER||env.AUTH_PROVIDER==='sites')return getChatGPTUser();
 if(!authConfigured())return null;
 const supabase=await authClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user||!user.email||!user.email_confirmed_at)return null;
 return {userId:`supabase:${user.id}`,email:user.email,displayName:user.email,fullName:null};
}
export async function requireUser(returnTo:string){const user=await getUser();if(user)return user;redirect(!env.AUTH_PROVIDER||env.AUTH_PROVIDER==='sites'?chatGPTSignInPath(returnTo):'/login');}
