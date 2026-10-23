import {authClient,googleAuthEnabled} from '../../../lib/server/auth';
export async function GET(request:Request){try{
 if(!googleAuthEnabled())throw new Error('Google sign-in unavailable');
 const client=await authClient();const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/complete',request.url).href,skipBrowserRedirect:true}});
 if(error||!data.url)throw new Error('Google sign-in unavailable');
 return Response.redirect(data.url,303);
 }catch{return Response.redirect(new URL('/login?error=google',request.url),303);}}
