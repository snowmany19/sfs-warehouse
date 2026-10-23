import { standardAuth } from '../../lib/server/auth';
export async function GET(request:Request){return Response.redirect(new URL(standardAuth()?'/login?signout=1':'/signout-with-chatgpt?return_to=/',request.url),303);}
