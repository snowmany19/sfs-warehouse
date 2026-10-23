import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {AccessError} from '../lib/access.ts';

const environment={};globalThis.__authTestEnv=environment;
const calls=[];let result={},rateBlocked=false,verified=null;
globalThis.__authTestClient={auth:Object.fromEntries(['signUp','signInWithPassword','signOut','updateUser','resetPasswordForEmail','signInWithOAuth','exchangeCodeForSession','getUser'].map(name=>[name,async (args,options)=>{calls.push({name,args,...(options?{options}:{})});return name==='getUser'?{data:{user:verified},error:null}:result;}]))};
globalThis.__authTestRateLimit=async()=>{if(rateBlocked)throw new AccessError('Too many attempts.',429);};
globalThis.__authTestCookies={getAll:()=>[],set:()=>{}};
const mock=source=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='cloudflare:workers')return mock('export const env=globalThis.__authTestEnv;');
 if(specifier==='next/headers')return mock('export const cookies=async()=>globalThis.__authTestCookies;');
 if(specifier==='next/navigation')return mock('export const redirect=url=>{throw new Error("redirect:"+url);};');
 if(specifier==='@supabase/ssr')return mock('export const createServerClient=()=>globalThis.__authTestClient;');
 if(specifier.endsWith('/app/chatgpt-auth'))return mock('export const getChatGPTUser=()=>({userId:"sites:user",email:"old@test.invalid"});export const chatGPTSignInPath=()=>"/signin-with-chatgpt";');
 if(specifier.endsWith('/lib/server/rate-limit'))return mock('export const authRateLimit=(...args)=>globalThis.__authTestRateLimit(...args);');
 if(specifier.endsWith('/lib/server/workspace'))return mock('export const body=r=>r.json();export const json=value=>Response.json(value);export const failure=e=>Response.json({error:e.status?e.message:"Service unavailable."},{status:e.status||503});export const db=()=>{throw new Error("Authentication must not change membership");};');
 if(specifier.startsWith('.')&&context.parentURL?.endsWith('.ts')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);
 return next(specifier,context);
}});
const auth=await import('../lib/server/auth.ts');
const {POST}=await import('../app/api/auth/route.ts');
const {GET:google}=await import('../app/auth/google/route.ts');
const {GET:complete}=await import('../app/auth/complete/route.ts');
hook.deregister();
const request=payload=>new Request('https://warehouse.test/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
function reset(){for(const key of Object.keys(environment))delete environment[key];Object.assign(environment,{AUTH_PROVIDER:'supabase',SUPABASE_URL:'https://identity.test',SUPABASE_PUBLISHABLE_KEY:'test-publishable'});calls.length=0;rateBlocked=false;verified=null;result={data:{},error:null};}

test('missing or invalid provider configuration fails closed without the legacy identity',async()=>{
 reset();delete environment.SUPABASE_URL;assert.equal(auth.authConfigured(),false);assert.equal(await auth.getUser(),null);await assert.rejects(auth.authClient(),/being set up/);await assert.rejects(auth.requireUser('/'),/redirect:\/login/);
 environment.AUTH_PROVIDER='typo';assert.equal(await auth.getUser(),null);
 environment.AUTH_PROVIDER='supabase';environment.SUPABASE_URL='http://identity.test';assert.equal(auth.authConfigured(),false);
});
test('only a provider-verified email becomes an SFS identity; profile role is ignored',async()=>{
 reset();verified={id:'new-id',email:'worker@test.invalid',user_metadata:{role:'owner'}};assert.equal(await auth.getUser(),null);
 verified.email_confirmed_at='2026-10-13T12:00:00Z';assert.deepEqual(await auth.getUser(),{userId:'supabase:new-id',email:'worker@test.invalid',displayName:'worker@test.invalid',fullName:null});
});
test('registration works without a membership and never forwards requested owner permissions',async()=>{
 reset();const response=await POST(request({action:'signup',email:' New@Example.com ',password:'twelve-or-more-characters',role:'owner',owner:'other-facility'}));
 assert.equal(response.status,200);assert.match((await response.json()).message,/verify your account/);
 assert.deepEqual(calls,[{name:'signUp',args:{email:'new@example.com',password:'twelve-or-more-characters',options:{emailRedirectTo:'https://warehouse.test/auth/complete'}}}]);
});
test('registration enforces new-password policy but existing accounts can sign in with their original password',async()=>{
 reset();assert.equal((await POST(request({action:'signup',email:'new@example.com',password:'eight123'}))).status,400);assert.equal(calls.length,0);
 assert.equal((await POST(request({action:'signin',email:'new@example.com',password:'eight123'}))).status,200);assert.equal(calls[0].name,'signInWithPassword');
});
test('invalid inputs and rate limiting prevent provider calls; provider details remain private',async()=>{
 reset();assert.equal((await POST(request({action:'signup',email:'bad@email',password:'long-password-example'}))).status,400);assert.equal(calls.length,0);
 rateBlocked=true;assert.equal((await POST(request({action:'signin',email:'new@example.com',password:'valid'}))).status,429);assert.equal(calls.length,0);
 rateBlocked=false;result={error:{message:'internal-secret-detail'}};const response=await POST(request({action:'signin',email:'new@example.com',password:'valid'}));assert.equal(response.status,401);assert.doesNotMatch(await response.text(),/internal-secret-detail/);
});
test('password changes require a verified session; reset callbacks stay on the application origin',async()=>{
 reset();assert.equal((await POST(request({action:'password',password:'new-password-example'}))).status,401);assert.equal(calls.filter(c=>c.name==='updateUser').length,0);
 verified={id:'worker',email:'worker@test.invalid',email_confirmed_at:'yes'};assert.equal((await POST(request({action:'password',password:'new-password-example'}))).status,200);
 calls.length=0;assert.equal((await POST(request({action:'reset',email:'worker@test.invalid',redirectTo:'https://evil.test'}))).status,200);assert.equal(calls[0].options.redirectTo,'https://warehouse.test/auth/complete?reset=1');assert.equal(calls[0].name,'resetPasswordForEmail');
});
test('signout is available despite sign-in throttling and reports provider failures',async()=>{
 reset();rateBlocked=true;assert.equal((await POST(request({action:'signout'}))).status,200);assert.deepEqual(calls[0],{name:'signOut',args:{scope:'local'}});
 result={error:{message:'failed'}};assert.equal((await POST(request({action:'signout'}))).status,503);
});
test('Google and confirmation callbacks do not accept caller-controlled return destinations',async()=>{
 reset();let response=await google(new Request('https://warehouse.test/auth/google'));assert.equal(response.headers.get('location'),'https://warehouse.test/login?error=google');assert.equal(calls.length,0);
 environment.GOOGLE_AUTH_ENABLED='true';result={data:{url:'https://identity.test/authorize'},error:null};response=await google(new Request('https://warehouse.test/auth/google?next=https://evil.test'));assert.equal(response.status,303);assert.equal(calls[0].args.options.redirectTo,'https://warehouse.test/auth/complete');
 result={error:null};response=await complete(new Request('https://warehouse.test/auth/complete?code=valid&next=https://evil.test'));assert.equal(response.headers.get('location'),'https://warehouse.test/');
 result={error:{message:'expired'}};response=await complete(new Request('https://warehouse.test/auth/complete?code=expired'));assert.equal(response.headers.get('location'),'https://warehouse.test/login?error=callback');
});
