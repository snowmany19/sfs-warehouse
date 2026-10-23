import { access,json,failure } from '../../../lib/server/workspace';
export const dynamic='force-dynamic';
export async function GET(){try{const {member}=await access();return json({role:member.role,email:member.email});}catch(e){return failure(e);}}
