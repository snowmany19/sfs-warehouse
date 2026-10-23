import { requireUser } from '../../lib/server/auth';
import { access } from '../../lib/server/workspace';
import { redirect } from 'next/navigation';
import EmployeeApp from './employee-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireUser('/my-assignment');let role;try{role=(await access()).member.role;}catch{redirect('/');}if(role!=='employee')redirect('/');return <EmployeeApp/>;}
