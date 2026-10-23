import { requireUser,standardAuth } from '../../lib/server/auth';
import { access } from '../../lib/server/workspace';
import { redirect } from 'next/navigation';
import AccessApp from './access-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireUser('/access');try{await access(['owner']);}catch{redirect('/');}return <AccessApp platformPrivate={!standardAuth()}/>;}
