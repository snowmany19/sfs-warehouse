import { env } from 'cloudflare:workers';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { db } from './workspace';
import { validateSubscription } from '../access';
export const pushReady=()=>Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);
export async function deliverySummary(owner:string){const rows=await db().prepare("SELECT status,count(*) AS count FROM push_deliveries WHERE owner=? GROUP BY status").bind(owner).all<{status:string;count:number}>();const devices=await db().prepare("SELECT count(*) AS count FROM push_subscriptions p JOIN memberships m ON p.member=m.id WHERE m.owner=? AND m.status='active'").bind(owner).first<{count:number}>();return {configured:pushReady(),devices:devices?.count||0,...Object.fromEntries(rows.results.map(r=>[r.status,r.count]))};}
export async function flushPush(owner:string){
 if(!pushReady())return;
 await db().prepare("UPDATE push_deliveries SET status='failed' WHERE owner=? AND status='sending' AND updated<?").bind(owner,new Date(Date.now()-120000).toISOString()).run();
 await db().prepare(`UPDATE push_deliveries SET status='cancelled' WHERE owner=? AND status IN ('pending','failed') AND NOT EXISTS (SELECT 1 FROM push_subscriptions p JOIN memberships m ON p.member=m.id JOIN operational_records n ON n.facility=m.owner AND n.kind='notices' WHERE p.id=push_deliveries.subscription_id AND m.status='active' AND m.role='employee' AND n.id=push_deliveries.notice AND json_extract(n.data,'$.status')='pending')`).bind(owner).run();
 const jobs=await db().prepare(`SELECT d.id,d.attempts,p.subscription FROM push_deliveries d
 JOIN push_subscriptions p ON p.id=d.subscription_id JOIN memberships m ON m.id=p.member
 
 WHERE d.owner=? AND m.status='active' AND m.role='employee' AND d.status IN ('pending','failed') AND d.attempts<5
 AND EXISTS (SELECT 1 FROM operational_records n WHERE n.facility=m.owner AND n.kind='notices' AND n.id=d.notice AND json_extract(n.data,'$.status')='pending')
 ORDER BY d.updated LIMIT 20`).bind(owner).all<{id:string;attempts:number;subscription:string}>();
 await Promise.allSettled(jobs.results.map(async job=>{
  // Claim once; a short lease allows a later retry after an interrupted request.
  const claim=await db().prepare("UPDATE push_deliveries SET status='sending',attempts=attempts+1,updated=? WHERE id=? AND status IN ('pending','failed') AND attempts=?").bind(new Date().toISOString(),job.id,job.attempts).run();if(claim.meta.changes!==1)return;
  try{
   const sub=validateSubscription(JSON.parse(job.subscription));
   const payload=await buildPushPayload({data:JSON.stringify({title:'SFS Warehouse',body:'Your assignment has changed. Open the app to review it.',url:'/my-assignment'}),options:{ttl:300}},sub,{subject:'https://sfs-warehouse.zuckabezos.chatgpt.site',publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!});
   const response=await fetch(sub.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(8000)});
   await db().prepare('UPDATE push_deliveries SET status=?,updated=? WHERE id=?').bind(response.ok?'sent':response.status===410||response.status===404?'expired':'failed',new Date().toISOString(),job.id).run();
   if(response.status===410||response.status===404)await db().prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
  }catch{await db().prepare("UPDATE push_deliveries SET status='failed',updated=? WHERE id=?").bind(new Date().toISOString(),job.id).run();}
 }));
}
