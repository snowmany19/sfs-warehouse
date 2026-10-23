import {authRateLimit} from '../../../lib/server/rate-limit';
import {body,failure,json} from '../../../lib/server/workspace';
import {authClient} from '../../../lib/server/auth';
import {AccessError} from '../../../lib/access';

export async function POST(request:Request){try{
 const b=await body(request,4096),client=await authClient(),origin=new URL(request.url).origin;
 if(b.action==='signout'){
  const {error}=await client.auth.signOut({scope:'local'});
  if(error)throw new AccessError('Unable to sign out. Please try again.',503);
  return json({ok:true});
 }
 if(b.action==='password'){
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user?.email_confirmed_at)throw new AccessError('Sign in through your reset link first.',401);
  await authRateLimit(request,`user:${user.id}`);
  validatePassword(b.password,true);
  const result=await client.auth.updateUser({password:b.password});
  if(result.error)throw new AccessError('Unable to update the password.',400);
  return json({ok:true});
 }
 if(!['signin','signup','reset'].includes(b.action))throw new AccessError('Unknown sign-in action.',400);
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AccessError('Enter a valid email address.',400);
 await authRateLimit(request,email);
 if(b.action==='reset'){
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:origin+'/auth/complete?reset=1'});
  if(error)throw new AccessError('Unable to send a reset link right now. Please try again later.',503);
  return json({message:'If the account exists, a password reset link will be sent. Check your inbox and spam folder.'});
 }
 validatePassword(b.password,b.action==='signup');
 if(b.action==='signup'){
  // Registration never creates membership or accepts roles from the request.
  const result=await client.auth.signUp({email,password:b.password,options:{emailRedirectTo:origin+'/auth/complete'}});
  if(result.error)throw new AccessError('Unable to create this account. Try signing in or reset your password.',400);
  return json({message:'Check your email to verify your account, then sign in. Your facility owner must add your email before you can access the warehouse.'});
 }
 const result=await client.auth.signInWithPassword({email,password:b.password});
 if(result.error)throw new AccessError('Email or password is incorrect, or the account needs verification.',401);
 return json({ok:true});
 }catch(e){return failure(e);}}

function validatePassword(value:unknown,newPassword:boolean):asserts value is string{
 if(typeof value!=='string'||value.length<(newPassword?12:1)||value.length>128)throw new AccessError(newPassword?'Use a password between 12 and 128 characters.':'Enter your password (up to 128 characters).',400);
}
