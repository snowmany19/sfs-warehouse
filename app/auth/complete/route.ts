import { authClient } from '../../../lib/server/auth';
export async function GET(request:Request){const url=new URL(request.url),code=url.searchParams.get('code');if(code){try{const client=await authClient();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return Response.redirect(new URL(url.searchParams.get('reset')==='1'?'/login?reset=1':'/',url),303);}catch{}}
return Response.redirect(new URL('/login?error=callback',url),303);}
