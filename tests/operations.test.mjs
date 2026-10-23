import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,applyCommand,onHand,available} from '../lib/domain.ts';
import {parseBarcode} from '../lib/barcodes.ts';import {zebraLabel,labelCode} from '../lib/labels.ts';
const run=(s,type,payload={},actor='supervisor-a')=>applyCommand(s,{type,payload},actor);
function shipped(){let s=initialState();for(const status of ['open','picking','picked','packed'])s=run(s,'order.advance',{id:'SO-2081',status,tracking:'SHIP-1'});return s;}
test('load arrival and package scans update stock exactly once',()=>{
 let s=run(initialState(),'load.create',{id:'LOAD-1',carrier:'Carrier',dock:'Door 03'});s=run(s,'unit.create',{id:'PALLET-1',receipt:'IN-1042',qty:20,load:'LOAD-1'});
 assert.throws(()=>run(s,'scan.execute',{workflow:'receive',barcode:'PALLET-1'}),/arrived first/);
 s=run(s,'scan.execute',{workflow:'arrive',barcode:'SFS:L:LOAD-1\r\n'});assert.equal(s.loads[0].status,'arrived');
 assert.throws(()=>run(s,'load.close',{id:'LOAD-1'}),/every registered/);
 s=run(s,'scan.execute',{workflow:'receive',barcode:'SFS:U:PALLET-1'});assert.equal(onHand(s,'SKU-300'),38);assert.equal(s.receipts[0].received,20);
 assert.throws(()=>run(s,'scan.execute',{workflow:'receive',barcode:'PALLET-1'}),/Already received/);assert.equal(onHand(s,'SKU-300'),38);
 s=run(s,'load.close',{id:'LOAD-1'});assert.equal(s.loads[0].status,'closed');
});
test('scan rejects wrong record types, unknown tasks, controls and invalid GS1 check digits',()=>{
 const s=initialState();assert.throws(()=>run(s,'scan.execute',{workflow:'arrive',barcode:'SFS:U:PALLET-1'}));
 assert.throws(()=>parseBarcode('bad\x00input'));assert.throws(()=>parseBarcode(']C100123456789012345678'),/check digit/);
 assert.equal(parseBarcode('(01)09521101530001').code,'09521101530001');
 assert.throws(()=>run(s,'scan.execute',{workflow:'delete',barcode:'anything'}));
});
test('package registration cannot overcommit receipt quantities',()=>{let s=run(initialState(),'unit.create',{id:'P1',receipt:'IN-1042',qty:70});assert.throws(()=>run(s,'unit.create',{id:'P2',receipt:'IN-1042',qty:11}),/exceed/);s=run(s,'receipt.cancel',{id:'IN-1042',reason:'Supplier cancelled'});assert.throws(()=>run(s,'unit.receive',{id:'P1'}),/cancelled/);});
test('cancelling open, reserved and picked orders preserves physical stock and releases holds',()=>{
 for(const steps of [[],['open'],['open','picking'],['open','picking','picked']]){let s=initialState();for(const status of steps)s=run(s,'order.advance',{id:'SO-2081',status});s=run(s,'order.cancel',{id:'SO-2081',reason:'Customer cancellation'});assert.equal(onHand(s,'SKU-100'),120);assert.equal(s.balances.filter(b=>b.sku==='SKU-100').reduce((n,b)=>n+b.reserved,0),0);assert.equal(s.orders[0].status,'cancelled');assert.throws(()=>run(s,'order.advance',{id:'SO-2081',status:'cancelled'}));}
 assert.throws(()=>run(shipped(),'order.cancel',{id:'SO-2081',reason:'Undo'}),/require a return/);
});
test('returns stay quarantined until inspected and cannot exceed shipment or be received twice',()=>{
 let s=shipped();s=run(s,'return.create',{id:'R1',source:'order',reference:'SO-2081',qty:10,reason:'Wrong size'});
 assert.throws(()=>run(s,'return.create',{id:'R2',source:'order',reference:'SO-2081',qty:15,reason:'Too many'}),/exceed/);
 s=run(s,'return.receive',{id:'R1'});assert.equal(onHand(s,'SKU-100'),106);assert.equal(available(s,'SKU-100'),96);
 assert.throws(()=>run(s,'inventory.move',{sku:'SKU-100',from:'RETURN-Q',to:'A-01',qty:10}));assert.throws(()=>run(s,'return.receive',{id:'R1'}));
 s=run(s,'return.dispose',{id:'R1',disposition:'restock',location:'A-01',reason:'Sealed and inspected'});assert.equal(available(s,'SKU-100'),106);assert.throws(()=>run(s,'return.dispose',{id:'R1',disposition:'restock',location:'A-01',reason:'Again'}));
});
test('damaged returns can be scrapped without creating available inventory',()=>{let s=run(shipped(),'return.create',{id:'R1',source:'order',reference:'SO-2081',qty:4,reason:'Damage'});s=run(s,'return.receive',{id:'R1'});s=run(s,'return.dispose',{id:'R1',disposition:'scrap',reason:'Destroyed packaging and contents'});assert.equal(onHand(s,'SKU-100'),96);assert.equal(available(s,'SKU-100'),96);});
test('correction requires a second actor and rejects counts when stock changed',()=>{
 let s=run(initialState(),'correction.request',{sku:'SKU-100',location:'A-01',qty:118,reason:'Two damaged'});const id=s.corrections[0].id;
 assert.equal(onHand(s,'SKU-100'),120);assert.throws(()=>run(s,'correction.review',{id,approve:true,reason:'Agreed'}),/different supervisor/);
 let approved=run(s,'correction.review',{id,approve:true,reason:'Recounted'},'supervisor-b');assert.equal(onHand(approved,'SKU-100'),118);
 s=run(s,'order.advance',{id:'SO-2081',status:'open'});assert.throws(()=>run(s,'correction.review',{id,approve:true,reason:'Agreed'},'supervisor-b'),/Stock changed/);
});
test('parcel unloading frees capacity and route correction requires re-sort',()=>{let s=run(initialState(),'parcel.load',{id:'PKG-1003',trailer:'TRL-410'});assert.throws(()=>run(s,'trailer.cancel',{id:'TRL-410',reason:'No departure'}),/Unload/);s=run(s,'parcel.unload',{id:'PKG-1003',reason:'Wrong physical truck'});s=run(s,'parcel.correct',{id:'PKG-1003',route:'WEST',reason:'Corrected destination'});assert.equal(s.parcels.find(p=>p.id==='PKG-1003').status,'arrived');assert.throws(()=>run(s,'parcel.load',{id:'PKG-1003',trailer:'TRL-520'}),/Sort/);});
test('parcel returns release dispatched linkage and restart route verification',()=>{let s=run(initialState(),'parcel.load',{id:'PKG-1003',trailer:'TRL-410'});s=run(s,'trailer.dispatch',{id:'TRL-410'});s=run(s,'return.create',{id:'R1',source:'parcel',reference:'PKG-1003',reason:'Undeliverable'});s=run(s,'return.receive',{id:'R1'});s=run(s,'return.dispose',{id:'R1',disposition:'resort',reason:'Address corrected'});assert.equal(s.parcels.find(p=>p.id==='PKG-1003').status,'arrived');});
test('labels have stable scanner identities and ZPL field data cannot inject printer commands',()=>{assert.equal(labelCode('units','PALLET-001'),'SFS:U:PALLET-001');const zpl=zebraLabel('units','PALLET-001','Facility ^XZ ^XA ^JUS',203);assert.equal(zpl.match(/\^XA/g).length,1);assert.equal(zpl.match(/\^XZ/g).length,1);assert.match(zpl,/\^PW812/);assert.match(zpl,/\^BY2/);assert.throws(()=>labelCode('units','evil^XZ'));assert.match(zebraLabel('loads','LOAD-1','SFS',300),/\^PW1200/);});
