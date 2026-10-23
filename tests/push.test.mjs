import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPushPayload} from '@block65/webcrypto-web-push';
test('Web Push creates encrypted, authenticated requests without exposing assignment details',async()=>{
 const server=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const device=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const b64=b=>Buffer.from(b).toString('base64url');
 const pub=b64(await crypto.subtle.exportKey('raw',server.publicKey));const priv=await crypto.subtle.exportKey('jwk',server.privateKey);
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/local-test',expirationTime:null,keys:{p256dh:b64(await crypto.subtle.exportKey('raw',device.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};
 const text='Your assignment has changed. Open the app to review it.';
 const request=await buildPushPayload({data:JSON.stringify({title:'SFS Warehouse',body:text,url:'/my-assignment'}),options:{ttl:300}},sub,{subject:'https://sfs-warehouse.zuckabezos.chatgpt.site',publicKey:pub,privateKey:priv.d});
 assert.equal(request.method.toUpperCase(),'POST');const headers=new Headers(request.headers);assert.equal(headers.get('content-encoding'),'aes128gcm');assert.match(headers.get('authorization'),/^vapid /);assert.equal(headers.get('ttl'),'300');assert.equal(Buffer.from(request.body).includes(Buffer.from(text)),false);assert.ok(Buffer.from(request.body).length<=4096);
});
