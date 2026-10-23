import { db } from './workspace';
import { AccessError } from '../access';
export async function authRateLimit(request:Request,email:string){
 const bucket=Math.floor(Date.now()/600000);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 const keys=await Promise.all([`email:${email.toLowerCase().trim()}`,`ip:${ip}`].map(async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('')));
 const result=await db().batch(keys.map(key=>db().prepare('INSERT INTO auth_rate_limits(key,bucket,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET bucket=excluded.bucket,count=CASE WHEN auth_rate_limits.bucket=excluded.bucket THEN auth_rate_limits.count+1 ELSE 1 END RETURNING count').bind(key,bucket)));
 if(Number((result[0].results[0] as {count:number})?.count)>10||Number((result[1].results[0] as {count:number})?.count)>60)throw new AccessError('Too many sign-in attempts. Try again in ten minutes.',429);
 await db().prepare('DELETE FROM auth_rate_limits WHERE bucket<?').bind(bucket-144).run();
}
