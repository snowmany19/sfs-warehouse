import { access,body,db,failure,json,readWorkspace,guardArgs,memberGuard } from '../../../lib/server/workspace';
import { AccessError } from '../../../lib/access';
export const dynamic='force-dynamic';
export async function GET(){try{const {member}=await access(['owner']);const members=await db().prepare('SELECT id,email,role,employee,status,version,user_id IS NOT NULL AS joined FROM memberships WHERE owner=?').bind(member.owner).all();const {state}=await readWorkspace(member.owner);return json({members:members.results,employees:state.employees.map(e=>({id:e.id,name:e.name}))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const {member}=await access(['owner']);const b=await body(request);
 if(b.action==='revoke') {
  const r=await db().batch([
   db().prepare(`UPDATE memberships SET status='revoked',version=version+1 WHERE id=? AND owner=? AND role!='owner' AND ${memberGuard}`).bind(b.id,member.owner,...guardArgs(member)),
   db().prepare("DELETE FROM push_deliveries WHERE subscription_id IN (SELECT p.id FROM push_subscriptions p JOIN memberships m ON m.id=p.member WHERE m.id=? AND m.owner=? AND m.status='revoked')").bind(b.id,member.owner),
   db().prepare("DELETE FROM push_subscriptions WHERE member IN (SELECT id FROM memberships WHERE id=? AND owner=? AND status='revoked')").bind(b.id,member.owner),
  ]);if(r[0].meta.changes!==1)throw new AccessError('This account cannot be revoked.',400);
 } else if(b.action==='invite') {
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new AccessError('Enter a valid sign-in email.',400);
  if(!['employee','supervisor'].includes(b.role))throw new AccessError('Choose an employee or supervisor role.',400);
  const {state}=await readWorkspace(member.owner);const employee=b.role==='employee'?b.employee:null;if(b.role==='employee'&&!state.employees.some(e=>e.id===employee))throw new AccessError('Choose the employee record to link.',400);
  const existing=await db().prepare('SELECT id FROM memberships WHERE email=? OR (employee IS NOT NULL AND employee=?)').bind(email,employee).first();if(existing)throw new AccessError('This email or employee already has an access record. Contact the owner to review it.',409);
  await db().prepare(`INSERT INTO memberships (id,email,owner,role,employee,status,version) SELECT ?,?,?,?,?,'active',1 WHERE ${memberGuard}`).bind(crypto.randomUUID(),email,member.owner,b.role,employee,...guardArgs(member)).run();
 } else throw new AccessError('Unknown access action.',400);
 return json({ok:true});}catch(e){return failure(e);}}
