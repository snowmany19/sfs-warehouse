import { env } from 'cloudflare:workers';
import { access,body,db,failure,json,guardArgs,memberGuard } from '../../../lib/server/workspace';
import { AccessError,validateSubscription } from '../../../lib/access';
import { pushReady,flushPush,deliverySummary } from '../../../lib/server/push';
export const dynamic='force-dynamic';
export async function GET(){try{const {member}=await access(['employee']);const row=await db().prepare('SELECT count(*) AS count FROM push_subscriptions WHERE member=?').bind(member.id).first<{count:number}>();return json({configured:pushReady(),publicKey:env.VAPID_PUBLIC_KEY||null,devices:row?.count||0});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const {member}=await access();const b=await body(request);
 if(b.action==='retry'){if(member.role==='employee')throw new AccessError('Only supervisors can retry assignment alerts.');await db().prepare("UPDATE push_deliveries SET status='failed' WHERE owner=? AND status='sending' AND updated<?").bind(member.owner,new Date(Date.now()-120000).toISOString()).run();await db().prepare("UPDATE push_deliveries SET attempts=0 WHERE owner=? AND status='failed' AND attempts>=5").bind(member.owner).run();await flushPush(member.owner);return json(await deliverySummary(member.owner));}
 if(member.role!=='employee')throw new AccessError('Phone alerts are available for employee accounts.');
 if(b.action==='unsubscribe'){if(typeof b.endpoint!=='string')throw new AccessError('A device endpoint is required.',400);await db().prepare('DELETE FROM push_subscriptions WHERE member=? AND endpoint=?').bind(member.id,b.endpoint).run();return json({ok:true});}
 if(b.action!=='subscribe'||!pushReady())throw new AccessError('Phone notifications are not configured.',503);
 const sub=validateSubscription(b.subscription);const count=await db().prepare('SELECT count(*) AS count FROM push_subscriptions WHERE member=?').bind(member.id).first<{count:number}>();if((count?.count||0)>=5)throw new AccessError('Five phones are already enabled. Disable one before adding another.',400);
 // Endpoint uniqueness prevents another account from claiming a previously registered device.
 const existing=await db().prepare('SELECT member FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).first<{member:string}>();if(existing&&existing.member!==member.id)throw new AccessError('This phone is registered to another employee. Disable alerts in that account first.',409);
 await db().prepare(`INSERT INTO push_subscriptions (id,member,endpoint,subscription) SELECT ?,?,?,? WHERE ${memberGuard} ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription WHERE push_subscriptions.member=excluded.member`).bind(crypto.randomUUID(),member.id,sub.endpoint,JSON.stringify(sub),...guardArgs(member)).run();return json({ok:true});
 }catch(e){return failure(e);}}
