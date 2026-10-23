import WarehouseApp from './warehouse-app';
import { requireUser } from '../lib/server/auth';
import { access } from '../lib/server/workspace';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){await requireUser('/');let role;try{role=(await access()).member.role;}catch{return <main className="employee-shell"><h1>Access required</h1><p>Your account has not been invited to this warehouse. Ask the owner to add your sign-in email.</p><a href="/logout">Sign out</a></main>;}if(role==='employee')redirect('/my-assignment');return <WarehouseApp role={role}/>;}
