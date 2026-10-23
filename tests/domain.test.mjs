import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyCommand, available, onHand } from '../lib/domain.ts';
const run=(s,type,payload={})=>applyCommand(s,{type,payload},'test-supervisor','2026-10-12T12:00:00Z');
test('receive and put away stock preserves quantities and releases availability only in storage',()=>{
 let s=initialState();s=run(s,'receipt.receive',{id:'IN-1042',qty:40});assert.equal(onHand(s,'SKU-300'),58);assert.equal(available(s,'SKU-300'),18);
 s=run(s,'inventory.move',{sku:'SKU-300',from:'RECV',to:'A-01',qty:40});assert.equal(available(s,'SKU-300'),58);assert.equal(onHand(s,'SKU-300'),58);
 assert.equal(s.audit.length,2);
});
test('over-receiving and negative/fractional quantities are rejected without changing input',()=>{
 const s=initialState(),copy=structuredClone(s);
 for(const qty of [81,-2,0,1.5,'1e2','-1',null])assert.throws(()=>run(s,'receipt.receive',{id:'IN-1042',qty}));
 assert.deepEqual(s,copy);
});
test('stock cannot move past availability or destination capacity',()=>{
 const s=initialState();assert.throws(()=>run(s,'inventory.move',{sku:'SKU-100',from:'A-01',to:'A-02',qty:121}),/unreserved/);
 s.locations.find(l=>l.id==='A-02').capacity=90;
 assert.throws(()=>run(s,'inventory.move',{sku:'SKU-100',from:'A-01',to:'A-02',qty:10}),/capacity/);
});
test('orders reserve stock and preserve on-hand until shipping',()=>{
 let s=initialState();s=run(s,'order.advance',{id:'SO-2081',status:'open'});assert.equal(available(s,'SKU-100'),96);assert.equal(onHand(s,'SKU-100'),120);
 s=run(s,'order.advance',{id:'SO-2081',status:'picking'});assert.equal(onHand(s,'SKU-100'),120);assert.equal(s.balances.find(b=>b.sku==='SKU-100'&&b.location==='PACK').reserved,24);
 s=run(s,'order.advance',{id:'SO-2081',status:'picked'});assert.throws(()=>run(s,'order.advance',{id:'SO-2081',status:'packed',tracking:''}),/reference/);
 s=run(s,'order.advance',{id:'SO-2081',status:'packed',tracking:'SHIP-123'});assert.equal(onHand(s,'SKU-100'),96);assert.equal(s.orders[0].status,'shipped');
 assert.throws(()=>run(s,'order.advance',{id:'SO-2081',status:'shipped',tracking:'SHIP-123'}),/already shipped/);
});
test('two orders cannot reserve the same units',()=>{
 let s=run(initialState(),'order.advance',{id:'SO-2081',status:'open'});
 s=run(s,'order.create',{id:'BIG-ORDER',customer:'Test',sku:'SKU-100',qty:100});
 assert.throws(()=>run(s,'order.advance',{id:'BIG-ORDER',status:'open'}),/Not enough/);
});
test('stale order transitions are rejected',()=>{const s=run(initialState(),'order.advance',{id:'SO-2081',status:'open'});assert.throws(()=>run(s,'order.advance',{id:'SO-2081',status:'open'}),/status changed/);});
test('counts require a reason and cannot consume reservations',()=>{
 const s=run(initialState(),'order.advance',{id:'SO-2081',status:'open'});
 assert.throws(()=>run(s,'inventory.count',{sku:'SKU-100',location:'A-01',qty:20,reason:'Damaged'}),/reserved/);
 assert.throws(()=>run(s,'inventory.count',{sku:'SKU-100',location:'A-01',qty:100,reason:''}),/reason/);
 const n=run(s,'inventory.count',{sku:'SKU-100',location:'A-01',qty:100,reason:'Physical recount'});assert.equal(onHand(n,'SKU-100'),100);assert.equal(available(n,'SKU-100'),76);
});
test('assignment planning enforces presence and training',()=>{
 let s=initialState();assert.throws(()=>run(s,'assignment.plan',{employee:'EMP-002',area:'loading'}),/not trained/);
 s=run(s,'employee.presence',{id:'EMP-002',present:false});assert.throws(()=>run(s,'assignment.plan',{employee:'EMP-002',area:'picking'}),/Absent/);
});
test('draft assignment does not notify until publication and new versions reset acknowledgment',()=>{
 let s=initialState();s=run(s,'assignment.plan',{employee:'EMP-001',area:'loading'});assert.equal(s.notices.length,0);assert.equal(s.employees[0].published,'');
 s=run(s,'assignment.publish');assert.equal(s.notices.length,6);
 s=run(s,'assignment.acknowledge',{employee:'EMP-001',revision:1});assert.equal(s.employees[0].acknowledged,true);
 s=run(s,'assignment.plan',{employee:'EMP-001',area:'receiving'});assert.equal(s.employees[0].published,'loading');
 s=run(s,'assignment.publish');assert.equal(s.employees[0].acknowledged,false);assert.throws(()=>run(s,'assignment.acknowledge',{employee:'EMP-001',revision:1}),/changed/);
});
test('assignment removal also generates an update',()=>{
 let s=run(initialState(),'assignment.publish');s=run(s,'employee.presence',{id:'EMP-001',present:false});s=run(s,'assignment.publish');assert.equal(s.employees[0].published,'');assert.equal(s.notices.find(n=>n.employee==='EMP-001'&&n.revision===2).area,'');
});
test('wrong lane or trailer route cannot be accepted',()=>{
 const s=initialState();assert.throws(()=>run(s,'parcel.sort',{id:'PKG-1001',lane:'WEST'}),/Wrong lane/);
 assert.throws(()=>run(s,'parcel.load',{id:'PKG-1003',trailer:'TRL-520'}),/route/);
 assert.throws(()=>run(s,'parcel.load',{id:'PKG-1001',trailer:'TRL-410'}),/Sort the parcel/);
});
test('parcel workflow finishes in one consistent trailer manifest',()=>{
 let s=run(initialState(),'parcel.sort',{id:'PKG-1001',lane:'east'});s=run(s,'parcel.load',{id:'PKG-1001',trailer:'TRL-410'});s=run(s,'trailer.dispatch',{id:'TRL-410'});
 assert.equal(s.parcels[0].status,'dispatched');assert.equal(s.trailers[0].status,'dispatched');
 assert.throws(()=>run(s,'parcel.load',{id:'PKG-1003',trailer:'TRL-410'}),/already dispatched/);
});
test('trailer capacity, duplicate barcodes, occupied docks, and empty departures are blocked',()=>{
 let s=initialState();s.trailers[0].capacity=1;s=run(s,'parcel.load',{id:'PKG-1003',trailer:'TRL-410'});s=run(s,'parcel.sort',{id:'PKG-1001',lane:'EAST'});
 assert.throws(()=>run(s,'parcel.load',{id:'PKG-1001',trailer:'TRL-410'}),/capacity/);
 assert.throws(()=>run(s,'parcel.create',{id:'PKG-1001',route:'EAST'}),/already exists/);
 assert.throws(()=>run(s,'trailer.create',{id:'TRL-999',route:'LOCAL',dock:'Door 01',capacity:100}),/occupied/);
 assert.throws(()=>run(s,'trailer.dispatch',{id:'TRL-520'}),/at least one/);
});
test('exceptions need a resolution and remain in the audit record',()=>{
 const s=initialState();assert.throws(()=>run(s,'issue.resolve',{id:'EX-101',note:''}));
 const n=run(s,'issue.resolve',{id:'EX-101',note:'Receipt confirmed.'});assert.equal(n.issues[0].status,'resolved');assert.match(n.issues[0].note,/Receipt confirmed/);assert.equal(n.audit[0].actor,'test-supervisor');
});
test('unknown commands and missing references fail closed',()=>{assert.throws(()=>run(initialState(),'reset'));assert.throws(()=>run(initialState(),'receipt.receive',{id:'MISSING',qty:1}));});
