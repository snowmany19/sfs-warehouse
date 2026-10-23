import { readState } from './store';
import { env } from 'cloudflare:workers';
import { getUser } from './auth';
import { AccessError, requireRole, type Member, type Role } from '../access';
import { initialState, DomainError } from '../domain';
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
export function db(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export async function identity(){const u=await getUser();if(!u)throw new AccessError('Sign in to continue.',401);return u;}
export async function access(roles:Role[]=['owner','supervisor','employee']) {
  const user=await identity();const email=user.email.trim().toLowerCase();
  const existing=await db().prepare('SELECT id FROM memberships WHERE email=?').bind(email).first();
  if(!existing&&env.WORKSPACE_OWNER_EMAIL&&email===env.WORKSPACE_OWNER_EMAIL.trim().toLowerCase()) {
    // Only the configured site owner may initialize the workspace. Never first-user-wins.
    await db().batch([
      db().prepare('INSERT OR IGNORE INTO workspaces (owner,revision,data) VALUES (?,0,?)').bind(user.userId,JSON.stringify(initialState())),
      db().prepare("INSERT OR IGNORE INTO memberships (id,email,user_id,owner,role,status,version) VALUES ('workspace-owner',?,?,?,'owner','active',1)").bind(email,user.userId,user.userId),
    ]);
  }
  await db().prepare("UPDATE memberships SET user_id=? WHERE email=? AND status='active' AND (user_id IS NULL OR user_id!=?)").bind(user.userId,email,user.userId).run();
  const member=await db().prepare("SELECT * FROM memberships WHERE user_id=? AND status='active'").bind(user.userId).first<Member>();
  return {user,member:requireRole(member,roles)};
}
export const readWorkspace=readState;
export const memberGuard="EXISTS (SELECT 1 FROM memberships WHERE id=? AND user_id=? AND version=? AND status='active')";
export function guardArgs(m:Member){return [m.id,m.user_id,m.version];}
export async function body(request:Request,max=16000){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AccessError('Cross-origin updates are not allowed.');if(request.headers.get('sec-fetch-site')==='cross-site')throw new AccessError('Cross-site updates are not allowed.');if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AccessError('JSON is required.',415);if(Number(request.headers.get('content-length'))>max)throw new AccessError('Request is too large.',413);const reader=request.body?.getReader();if(!reader)throw new AccessError('A request body is required.',400);const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw new AccessError('Request is too large.',413);}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new AccessError('Invalid request.',400);return value;}
export function failure(error:unknown){if(error instanceof AccessError)return json({error:error.message},error.status);if(error instanceof DomainError||error instanceof SyntaxError)return json({error:error.message},400);console.error('Warehouse operation failed',error instanceof Error?error.message:'Unknown error');return json({error:'Unable to complete this request. Please try again.'},503);}
