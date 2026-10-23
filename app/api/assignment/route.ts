import { access,body,failure,json,readWorkspace } from '../../../lib/server/workspace';
import { employeeView,assignmentCommand,AccessError } from '../../../lib/access';
import { applyCommand } from '../../../lib/domain';
import { commitState,commandHash } from '../../../lib/server/store';
export const dynamic='force-dynamic';
export async function GET(){try{const {member}=await access(['employee']);const {state}=await readWorkspace(member.owner);return json(employeeView(state,member));}catch(e){return failure(e);}}
export async function POST(request:Request){try{const {member,user}=await access(['employee']);const command=assignmentCommand(member,await body(request));for(let i=0;i<3;i++){const {state}=await readWorkspace(member.owner);const next=applyCommand(state,command,user.userId);if(await commitState(member,state,next,crypto.randomUUID(),await commandHash(command)))return json(employeeView(next,member));await access(['employee']);}throw new AccessError('Your assignment changed. Refresh and try again.',409);}catch(e){return failure(e);}}
