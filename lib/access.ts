import type { WarehouseState } from './domain';
export type Role = 'owner' | 'supervisor' | 'employee';
export type Member = {id:string;email:string;user_id:string|null;owner:string;role:Role;employee:string|null;status:string;version:number};
export class AccessError extends Error { status:number; constructor(message:string,status=403){super(message);this.status=status;} }
export function requireRole(member:Member|null,roles:Role[]) {
  if(!member||member.status!=='active'||!roles.includes(member.role))throw new AccessError('You do not have access to this action.');
  return member;
}
export function employeeView(state:WarehouseState,member:Member) {
  requireRole(member,['employee']);
  const e=state.employees.find(e=>e.id===member.employee);
  if(!e)throw new AccessError('Your employee record is unavailable. Contact your supervisor.');
  const notice=state.notices.find(n=>n.employee===e.id&&n.revision===e.revision);
  return {name:e.name,facility:state.facility,assignment:e.published?state.areas.find(a=>a.id===e.published)?.name||'Unassigned':'Unassigned',revision:e.revision,acknowledged:e.acknowledged,publishedAt:notice?.at||null};
}
export function assignmentCommand(member:Member,body:unknown) {
  requireRole(member,['employee']);
  if(!member.employee||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='revision')||!Number.isSafeInteger((body as {revision:number}).revision))throw new AccessError('Only your current assignment revision can be acknowledged.',400);
  return {type:'assignment.acknowledge',payload:{employee:member.employee,revision:(body as {revision:number}).revision}};
}
export function validateSubscription(value:unknown) {
  const s=value as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
  if(!s||typeof s.endpoint!=='string'||s.endpoint.length>4096)throw new AccessError('Invalid notification subscription.',400);
  let u:URL;try{u=new URL(s.endpoint);}catch{throw new AccessError('Invalid notification endpoint.',400);}
  const host=u.hostname.toLowerCase();
  const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!allowed)throw new AccessError('Unsupported phone notification service.',400);
  const p=s.keys?.p256dh,a=s.keys?.auth;
  if(typeof p!=='string'||typeof a!=='string'||!/^B[A-Za-z0-9_-]{86}$/.test(p)||! /^[A-Za-z0-9_-]{22}$/.test(a))throw new AccessError('Invalid notification encryption keys.',400);
  return {endpoint:u.href,expirationTime:null,keys:{p256dh:p,auth:a}};
}
