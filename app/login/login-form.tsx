'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,Box,Check,ShieldCheck} from 'lucide-react';
import Link from 'next/link';

type Action='signin'|'signup'|'reset'|'password';
export default function LoginForm({configured,googleEnabled}:{configured:boolean;googleEnabled:boolean}){
 const[action,setAction]=useState<Action>('signin'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[visible,setVisible]=useState(false);
 useEffect(()=>{void Promise.resolve().then(async()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.has('reset'))setAction('password');
  if(params.has('error')){setError(true);setMessage(params.get('error')==='google'?'Google sign-in is unavailable. Please use your email and password.':'This sign-in link could not be verified. Request a new link.');}
  if(params.has('signout')&&configured){try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signout'})});setError(!r.ok);setMessage(r.ok?'You’re signed out.':'Sign-out failed. Please try again.');}catch{setError(true);setMessage('Could not connect. Please try signing out again.');}}
 });},[configured]);
 function change(next:Action){setAction(next);setMessage('');setError(false);setVisible(false);}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('');setError(false);
  try{
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...Object.fromEntries(new FormData(e.currentTarget))})});
   const data=await r.json() as {error?:string;ok?:boolean;message?:string};
   if(!r.ok)throw new Error(data.error||'Unable to sign in. Please try again.');
   if(data.ok)window.location.assign(new URL('/',window.location.origin));else setMessage(data.message||'Check your email.');
  }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Could not connect. Please try again.');}finally{setBusy(false);}
 }
 const title={signin:'Welcome back',signup:'Create your account',reset:'Forgot your password?',password:'Choose a new password'}[action];
 const detail={signin:'Sign in to get your shift moving.',signup:'Use your work email or a personal email address.',reset:'We’ll send you a link to reset it.',password:'Use at least 12 characters to protect your account.'}[action];
 return <main className="login-page">
  <aside className="login-story"><div className="login-brand"><span><Box size={25}/></span><div>SFS<small>WAREHOUSE</small></div></div><div><p className="login-kicker">A CLEAR START TO EVERY SHIFT</p><h1>Your team.<br/>Your floor.<br/>In sync.</h1><p>One place for the work ahead, from the receiving dock to your next assignment.</p><div className="login-benefits"><span><Check size={16}/>The right assignment, in your pocket</span><span><Check size={16}/>A connected team, across the floor</span></div></div><p className="login-story-footer">Built for the people who keep things moving.</p></aside>
  <section className="login-main" aria-label="Account sign in"><div className="login-card"><div className="login-mobile-brand"><Box size={21}/> SFS WAREHOUSE</div><p className="eyebrow">YOUR WORKSPACE STARTS HERE</p><h2>{title}</h2><p className="login-description">{detail}</p>
   {!configured&&<p className="login-setup" role="status">Account sign-in is being set up. Registration and sign-in will be available once setup is complete.</p>}
   {message&&<p className={`feedback${error?' error':''}`} role={error?'alert':'status'}>{message}</p>}
   {(action==='signin'||action==='signup')&&<><button type="button" className="button secondary login-google" disabled={!googleEnabled||busy} onClick={()=>window.location.assign(new URL('/auth/google',window.location.origin))}><span aria-hidden="true" className="google-letter">G</span>Continue with Google</button>{configured&&!googleEnabled&&<p className="login-help">Google sign-in is being set up. You can use email below.</p>}<div className="login-divider"><span>or use your email</span></div></>}
   <form key={action} onSubmit={submit}><fieldset disabled={!configured||busy}>
    {action!=='password'&&<label className="field">Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" autoCapitalize="none" spellCheck={false}/></label>}
    {action!=='reset'&&<label className="field">{action==='password'?'New password':'Password'}<span className="login-password"><input name="password" type={visible?'text':'password'} minLength={action==='signin'?1:12} maxLength={128} required autoComplete={action==='signin'?'current-password':'new-password'} placeholder={action==='signin'?'Enter your password':'At least 12 characters'}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide':'Show'}</button></span></label>}
    <button className="button primary login-submit" type="submit">{busy?'Please wait…':{signin:'Sign in',signup:'Create account',reset:'Send reset link',password:'Save password'}[action]}{!busy&&<ArrowRight size={17}/>}</button>
   </fieldset></form>
   {action==='signin'&&<button className="text-button login-forgot" disabled={busy} onClick={()=>change('reset')}>Forgot password?</button>}
   <p className="login-switch">{action==='signin'?<>New here? <button className="text-button" disabled={busy} onClick={()=>change('signup')}>Create an account</button></>:<>Already have an account? <button className="text-button" disabled={busy} onClick={()=>change('signin')}>Sign in</button></>}</p>
   <div className="login-access"><ShieldCheck size={18}/><p>Your account only opens the areas your facility owner has assigned to you.</p></div>
  </div><p className="login-footer">SFS Warehouse · Every shift, connected. <Link href="/privacy">Privacy</Link></p></section>
 </main>;
}
