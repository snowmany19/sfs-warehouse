import { applyCommand } from '../../../lib/domain';
import { AccessError } from '../../../lib/access';
import { access,body,failure,json,readWorkspace } from '../../../lib/server/workspace';
import { commitState,commandHash,checkReplay } from '../../../lib/server/store';
import { flushPush,deliverySummary } from '../../../lib/server/push';
export const dynamic='force-dynamic';
export async function GET(){try{const {member}=await access(['owner','supervisor']);const {state}=await readWorkspace(member.owner);return json({...state,delivery:await deliverySummary(member.owner)});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {user,member}=await access(['owner','supervisor']);const b=await body(request);
 if(!Number.isSafeInteger(b.revision))throw new AccessError('A workspace revision is required.',400);
 if(typeof b.requestId!=='string'||!(/^[a-zA-Z0-9-]{16,80}$/).test(b.requestId))throw new AccessError('A unique request ID is required.',400);
 if(b.command?.type==='assignment.acknowledge')throw new AccessError('Employees must acknowledge their own assignments.');
 if(b.command?.type==='inventory.count')throw new AccessError('Submit a correction for a second supervisor to review.');
 if(!b.command||typeof b.command.type!=='string')throw new AccessError('A valid command is required.',400);
 const hash=await commandHash(b.command);let replay=await checkReplay(member,b.requestId,hash);
 const {row,state}=await readWorkspace(member.owner);
 if(replay)return json({...state,replayed:true,delivery:await deliverySummary(member.owner)});
 if(b.revision!==row.revision)throw new AccessError('Another supervisor updated this facility. Refresh and try again.',409);
 const next=applyCommand(state,b.command,user.userId);
 if(!await commitState(member,state,next,b.requestId,hash)){
   replay=await checkReplay(member,b.requestId,hash);if(!replay)throw new AccessError('Your access or this workspace changed. Refresh and try again.',409);
   const latest=await readWorkspace(member.owner);return json({...latest.state,replayed:true});
 }
 if(next.notices.some(n=>!state.notices.some(o=>o.id===n.id)))await flushPush(member.owner).catch(()=>undefined);
 return json({...next,delivery:await deliverySummary(member.owner)});
 }catch(e){return failure(e);}}
