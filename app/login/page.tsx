import {authConfigured,googleAuthEnabled} from '../../lib/server/auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default function Page(){return <LoginForm configured={authConfigured()} googleEnabled={googleAuthEnabled()}/>;}
