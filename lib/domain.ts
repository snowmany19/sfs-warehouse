import { scanCommand, parseBarcode, barcodeKinds, type BarcodeKind } from './barcodes.ts';
export type Area = { id: string; name: string; mode: 'shared' | 'warehouse' | 'parcel'; target: number };
export type Employee = { id: string; name: string; role: string; present: boolean; skills: string[]; planned: string; published: string; revision: number; acknowledged: boolean };
export type Item = { id: string; name: string; minimum: number };
export type Location = { id: string; zone: string; type: 'receiving' | 'storage' | 'packing' | 'quarantine'; capacity: number };
export type Balance = { sku: string; location: string; qty: number; reserved: number };
export type Receipt = { id: string; supplier: string; sku: string; expected: number; received: number; cancelled?: boolean };
export type Order = { id: string; customer: string; sku: string; qty: number; status: 'open' | 'picking' | 'picked' | 'packed' | 'shipped' | 'cancelled'; allocations: { location: string; qty: number }[]; tracking: string };
export type Parcel = { id: string; route: string; status: 'arrived' | 'sorted' | 'loaded' | 'dispatched' | 'cancelled' | 'returned'; trailer: string };
export type Trailer = { id: string; route: string; dock: string; capacity: number; status: 'loading' | 'dispatched' | 'cancelled' };
export type Issue = { id: string; title: string; area: string; priority: 'normal' | 'urgent'; status: 'open' | 'resolved'; note: string };
export type Notice = { id: string; employee: string; area: string; revision: number; status: 'pending' | 'acknowledged' | 'superseded'; at: string };
export type Audit = { id: string; at: string; actor: string; action: string; detail: string };
export type InboundLoad = {id:string;carrier:string;dock:string;status:'expected'|'arrived'|'closed'|'cancelled';arrivedAt?:string};
export type HandlingUnit = {id:string;receipt:string;sku:string;qty:number;load:string;status:'expected'|'received'|'cancelled';receivedAt?:string};
export type ReturnRecord = {id:string;source:'order'|'parcel';reference:string;sku:string;qty:number;reason:string;status:'requested'|'received'|'closed'|'cancelled';disposition?:'restock'|'scrap'|'resort'};
export type Correction = {id:string;sku:string;location:string;qty:number;before:number;reserved:number;reason:string;requestedBy:string;status:'pending'|'approved'|'rejected';reviewedBy?:string};
export type BarcodeMapping = {id:string;code:string;kind:BarcodeKind;target:string};
export type WarehouseState = { schema: 1; revision: number; mode: 'demo' | 'live'; facility: string; areas: Area[]; employees: Employee[]; items: Item[]; locations: Location[]; balances: Balance[]; receipts: Receipt[]; orders: Order[]; parcels: Parcel[]; trailers: Trailer[]; issues: Issue[]; notices: Notice[]; audit: Audit[]; loads:InboundLoad[];units:HandlingUnit[];returns:ReturnRecord[];corrections:Correction[];barcodes:BarcodeMapping[] };
export type Command = { type: string; payload: Record<string, unknown> };
export class DomainError extends Error {}
const fail = (message: string): never => { throw new DomainError(message); };
function text(value: unknown, label: string, max = 160) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (up to ${max} characters).`); return (value as string).trim(); }
function quantity(value: unknown, label = 'Quantity', zero = false) { const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN; if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1) || n > 1000000) fail(`${label} must be a whole number from ${zero ? 0 : 1} to 1,000,000.`); return n; }
function find<T extends {id: string}>(list: T[], id: unknown, label: string): T { return list.find(x => x.id === id) ?? fail(`${label} was not found.`); }
function unique<T extends {id: string}>(list: T[], id: string) { if (list.some(x => x.id === id)) fail(`The ID ${id} already exists.`); }
const id = () => crypto.randomUUID();
export const onHand = (state: WarehouseState, sku: string) => state.balances.filter(b => b.sku === sku).reduce((sum, b) => sum + b.qty, 0);
export const available = (state: WarehouseState, sku: string) => state.balances.filter(b => b.sku === sku && state.locations.some(l => l.id === b.location && l.type === 'storage')).reduce((sum,b) => sum+b.qty-b.reserved,0);
function balance(s: WarehouseState, sku: string, location: string) { let b = s.balances.find(x => x.sku === sku && x.location === location); if (!b) { b = {sku,location,qty:0,reserved:0}; s.balances.push(b); } return b; }
function room(s: WarehouseState, location: string, qty: number) { const loc = find(s.locations,location,'Location'); const total = s.balances.filter(b => b.location === location).reduce((n,b)=>n+b.qty,0); if (total + qty > loc.capacity) fail(`Location ${location} does not have enough unit capacity.`); }

export function initialState(): WarehouseState {
  return {schema:1,revision:0,mode:'demo',facility:'Northstar Distribution · Demo',
    areas:[{id:'receiving',name:'Receiving',mode:'shared',target:2},{id:'storage',name:'Put-away',mode:'warehouse',target:2},{id:'picking',name:'Picking',mode:'warehouse',target:2},{id:'packing',name:'Packing',mode:'warehouse',target:2},{id:'sort',name:'Parcel sort',mode:'parcel',target:3},{id:'loading',name:'Loading',mode:'shared',target:2}],
    employees:[
      {id:'EMP-001',name:'Alex Morgan',role:'Team lead',skills:['receiving','storage','picking','packing','sort','loading'],planned:'receiving'},
      {id:'EMP-002',name:'Jordan Lee',role:'Warehouse associate',skills:['picking','packing'],planned:'picking'},
      {id:'EMP-003',name:'Casey Rivera',role:'Equipment operator',skills:['storage','receiving','loading'],planned:'storage'},
      {id:'EMP-004',name:'Sam Brooks',role:'Sort associate',skills:['sort','loading'],planned:'sort'},
      {id:'EMP-005',name:'Taylor Chen',role:'Warehouse associate',skills:['picking','packing','receiving'],planned:'packing'},
      {id:'EMP-006',name:'Riley Davis',role:'Sort associate',skills:['sort','loading'],planned:'loading'},
    ].map(e=>({...e,present:true,published:'',revision:0,acknowledged:false})),
    items:[{id:'SKU-100',name:'Utility storage tote',minimum:30},{id:'SKU-200',name:'Work gloves · medium',minimum:40},{id:'SKU-300',name:'Packing tape · 6 pack',minimum:25},{id:'SKU-400',name:'Safety vest',minimum:20}],
    locations:[{id:'RECV',zone:'Receiving dock',type:'receiving',capacity:2000},{id:'A-01',zone:'Aisle A',type:'storage',capacity:500},{id:'A-02',zone:'Aisle A',type:'storage',capacity:500},{id:'B-01',zone:'Aisle B',type:'storage',capacity:500},{id:'PACK',zone:'Packing station',type:'packing',capacity:1000}],
    balances:[{sku:'SKU-100',location:'A-01',qty:120,reserved:0},{sku:'SKU-200',location:'A-02',qty:85,reserved:0},{sku:'SKU-300',location:'B-01',qty:18,reserved:0},{sku:'SKU-400',location:'B-01',qty:60,reserved:0}],
    receipts:[{id:'IN-1042',supplier:'Summit Supply',sku:'SKU-300',expected:80,received:0},{id:'IN-1043',supplier:'Northline Goods',sku:'SKU-100',expected:60,received:0}],
    orders:[{id:'SO-2081',customer:'Cedar Retail',sku:'SKU-100',qty:24,status:'open',allocations:[],tracking:''},{id:'SO-2082',customer:'Lakeside Supply',sku:'SKU-200',qty:40,status:'open',allocations:[],tracking:''}],
    parcels:[{id:'PKG-1001',route:'EAST',status:'arrived',trailer:''},{id:'PKG-1002',route:'WEST',status:'arrived',trailer:''},{id:'PKG-1003',route:'EAST',status:'sorted',trailer:''},{id:'PKG-1004',route:'LOCAL',status:'arrived',trailer:''}],
    trailers:[{id:'TRL-410',route:'EAST',dock:'Door 01',capacity:100,status:'loading'},{id:'TRL-520',route:'WEST',dock:'Door 02',capacity:100,status:'loading'}],
    issues:[{id:'EX-101',title:'Packing tape below reorder level',area:'packing',priority:'normal',status:'open',note:'Check the incoming shipment before the afternoon wave.'}],notices:[],audit:[],loads:[],units:[],returns:[],corrections:[],barcodes:[]};
}

export function applyCommand(current: WarehouseState, command: Command, actor: string, now = new Date().toISOString()): WarehouseState {
  if (!command || typeof command.type !== 'string' || !command.payload || Array.isArray(command.payload) || typeof command.payload !== 'object') fail('A valid action is required.');
  const s: WarehouseState = upgradeState(structuredClone(current)); const p = command.payload; let detail = '';
  if(command.type==='scan.execute'){const next=applyCommand(s,scanCommand(s,command.payload),actor,now);next.audit[0].detail=`Scan ${String(command.payload.barcode)} · ${next.audit[0].detail}`;return next;}
  switch(command.type) {
    case 'employee.create': {
      const name = text(p.name,'Employee name',80); const role = text(p.role,'Role',80); const skills = Array.isArray(p.skills) ? p.skills : [];
      if (!skills.length || skills.some(x=>typeof x !== 'string' || !s.areas.some(a=>a.id===x))) fail('Select at least one valid trained area.');
      s.employees.push({id:id(),name,role,skills:[...new Set(skills as string[])],present:true,planned:'',published:'',revision:0,acknowledged:false}); detail=`Added ${name}`; break;
    }
    case 'employee.presence': {
      const e = find(s.employees,p.id,'Employee'); if (typeof p.present !== 'boolean') fail('Presence must be true or false.');
      e.present=p.present as boolean; if (!e.present) e.planned=''; detail=`${e.name}: ${e.present?'present':'absent'}; assignment changes require publishing`; break;
    }
    case 'assignment.plan': {
      const e=find(s.employees,p.employee,'Employee'); const area=typeof p.area==='string'?p.area:fail('Choose an area.');
      if(area) { find(s.areas,area,'Area'); if(!e.present) fail('Absent employees cannot be assigned.'); if(!e.skills.includes(area)) fail(`${e.name} is not trained for this area.`); }
      e.planned=area; detail=`Draft assignment for ${e.name}: ${area||'unassigned'}`; break;
    }
    case 'assignment.publish': {
      const changed=s.employees.filter(e=>e.planned!==e.published); if(!changed.length) fail('There are no assignment changes to publish.');
      changed.forEach(e=>{ e.published=e.planned; e.revision++; e.acknowledged=false; s.notices.filter(n=>n.employee===e.id&&n.status==='pending').forEach(n=>n.status='superseded'); s.notices.unshift({id:id(),employee:e.id,area:e.published,revision:e.revision,status:'pending',at:now}); });
      detail=`Published ${changed.length} assignment updates to the in-app inbox`; break;
    }
    case 'assignment.acknowledge': {
      const e=find(s.employees,p.employee,'Employee'); if(e.revision!==p.revision||!e.revision) fail('This assignment changed. Refresh before acknowledging.'); if(e.acknowledged) fail('This assignment is already acknowledged.');
      e.acknowledged=true; s.notices.filter(n=>n.employee===e.id&&n.revision===e.revision&&n.status==='pending').forEach(n=>n.status='acknowledged'); detail=`Employee acknowledged ${e.name}'s assignment`; break;
    }
    case 'area.target': {const a=find(s.areas,p.id,'Area'); a.target=quantity(p.target,'Staffing target',true); detail=`${a.name}: staffing target ${a.target}`;break;}
    case 'item.create': {const sku=text(p.sku,'SKU',40).toUpperCase();unique(s.items,sku);s.items.push({id:sku,name:text(p.name,'Item name',100),minimum:quantity(p.minimum,'Reorder level',true)});detail=`Created item ${sku}`;break;}
    case 'location.create': {const loc=text(p.id,'Location ID',40).toUpperCase();unique(s.locations,loc);s.locations.push({id:loc,zone:text(p.zone,'Zone',80),type:'storage',capacity:quantity(p.capacity,'Capacity')});detail=`Added storage location ${loc}`;break;}
    case 'receipt.create': {const rid=text(p.id,'Receipt ID',40).toUpperCase();unique(s.receipts,rid);const item=find(s.items,p.sku,'Item');s.receipts.push({id:rid,supplier:text(p.supplier,'Supplier',100),sku:item.id,expected:quantity(p.qty),received:0});detail=`Created inbound receipt ${rid}`;break;}
    case 'receipt.receive': {
      const r=find(s.receipts,p.id,'Receipt');if(r.cancelled)fail('This receipt is cancelled.');const qty=quantity(p.qty);if(qty>r.expected-r.received-s.units.filter(u=>u.receipt===r.id&&u.status==='expected').reduce((n,u)=>n+u.qty,0)) fail('The quantity exceeds unregistered receipt units. Receive registered packages through the scan station.');
      room(s,'RECV',qty);balance(s,r.sku,'RECV').qty+=qty;r.received+=qty;detail=`Received ${qty} × ${r.sku} against ${r.id} into RECV`;break;
    }
    case 'inventory.move': {
      const item=find(s.items,p.sku,'Item');const from=find(s.locations,p.from,'Source location');const to=find(s.locations,p.to,'Destination location');const qty=quantity(p.qty);
      if(from.id===to.id) fail('Choose a different destination.'); if(!['storage','receiving'].includes(from.type)||to.type!=='storage') fail('Move unreserved stock into a storage location. Packing stock follows the order workflow.');
      const b=balance(s,item.id,from.id);if(b.qty-b.reserved<qty) fail('Not enough unreserved stock at the source location.'); room(s,to.id,qty);b.qty-=qty;balance(s,item.id,to.id).qty+=qty; detail=`Moved ${qty} × ${item.id} from ${from.id} to ${to.id}`;break;
    }
    case 'inventory.count': {
      const item=find(s.items,p.sku,'Item');const loc=find(s.locations,p.location,'Location');if(loc.type==='packing'||loc.type==='quarantine') fail('Packing stock must be reconciled through its order.');
      const qty=quantity(p.qty,'Counted quantity',true);const reason=text(p.reason,'Adjustment reason',200);const b=balance(s,item.id,loc.id);if(qty<b.reserved) fail('Count cannot fall below reserved stock. Resolve picking reservations first.');room(s,loc.id,qty-b.qty);const delta=qty-b.qty;b.qty=qty;detail=`Count ${item.id} at ${loc.id}: ${qty} (${delta>=0?'+':''}${delta}). ${reason}`;break;
    }
    case 'order.create': {const oid=text(p.id,'Order ID',40).toUpperCase();unique(s.orders,oid);const item=find(s.items,p.sku,'Item');s.orders.push({id:oid,customer:text(p.customer,'Customer',100),sku:item.id,qty:quantity(p.qty),status:'open',allocations:[],tracking:''});detail=`Created outbound order ${oid}`;break;}
    case 'order.advance': {
      const o=find(s.orders,p.id,'Order'); if(p.status!==o.status) fail('Order status changed. Refresh and try again.');
      if(o.status==='open') {if(available(s,o.sku)<o.qty) fail('Not enough available storage stock to release this order.');let remaining=o.qty;o.allocations=[];
        for(const b of s.balances.filter(b=>b.sku===o.sku&&s.locations.some(l=>l.id===b.location&&l.type==='storage')).sort((a,b)=>a.location.localeCompare(b.location))) {const qty=Math.min(remaining,b.qty-b.reserved);if(qty>0){b.reserved+=qty;o.allocations.push({location:b.location,qty});remaining-=qty;}} o.status='picking';
      } else if(o.status==='picking') {room(s,'PACK',o.qty);for(const a of o.allocations){const b=balance(s,o.sku,a.location);if(b.qty<a.qty||b.reserved<a.qty)fail('Stock reservation is inconsistent.');b.qty-=a.qty;b.reserved-=a.qty;}const pack=balance(s,o.sku,'PACK');pack.qty+=o.qty;pack.reserved+=o.qty;o.status='picked';
      } else if(o.status==='picked') o.status='packed';
      else if(o.status==='packed') {o.tracking=text(p.tracking,'Shipment reference',100);const pack=balance(s,o.sku,'PACK');if(pack.qty<o.qty||pack.reserved<o.qty)fail('Packed stock is inconsistent.');pack.qty-=o.qty;pack.reserved-=o.qty;o.status='shipped';}
      else fail('This order has already shipped.');detail=`${o.id}: ${o.status}${o.tracking?' · '+o.tracking:''}`;break;
    }
    case 'parcel.create': {const tracking=text(p.id,'Parcel barcode',80).toUpperCase();unique(s.parcels,tracking);s.parcels.unshift({id:tracking,route:text(p.route,'Route',40).toUpperCase(),status:'arrived',trailer:''});detail=`Checked in parcel ${tracking}`;break;}
    case 'parcel.sort': {const parcel=find(s.parcels,p.id,'Parcel');if(parcel.status!=='arrived')fail('Only arrived parcels can be sorted.');const lane=text(p.lane,'Sort lane',40).toUpperCase();if(lane!==parcel.route)fail(`Wrong lane. This parcel belongs to ${parcel.route}.`);parcel.status='sorted';detail=`Sorted ${parcel.id} to ${lane}`;break;}
    case 'trailer.create': {const tid=text(p.id,'Trailer ID',40).toUpperCase();unique(s.trailers,tid);const dock=text(p.dock,'Dock door',40);if(s.trailers.some(t=>t.status==='loading'&&t.dock.toLowerCase()===dock.toLowerCase()))fail('That dock is occupied by another trailer.');s.trailers.push({id:tid,route:text(p.route,'Route',40).toUpperCase(),dock,capacity:quantity(p.capacity,'Parcel capacity'),status:'loading'});detail=`Opened trailer ${tid} at ${dock}`;break;}
    case 'parcel.load': {const parcel=find(s.parcels,p.id,'Parcel');const trailer=find(s.trailers,p.trailer,'Trailer');if(parcel.status!=='sorted')fail('Sort the parcel before loading.');if(trailer.status!=='loading')fail('This trailer has already dispatched.');if(trailer.route!==parcel.route)fail('Parcel route does not match the trailer route.');if(s.parcels.filter(x=>x.trailer===trailer.id).length>=trailer.capacity)fail('The trailer is at capacity.');parcel.trailer=trailer.id;parcel.status='loaded';detail=`Loaded ${parcel.id} onto ${trailer.id}`;break;}
    case 'trailer.dispatch': {const trailer=find(s.trailers,p.id,'Trailer');if(trailer.status!=='loading')fail('This trailer has already dispatched.');const parcels=s.parcels.filter(x=>x.trailer===trailer.id&&x.status==='loaded');if(!parcels.length)fail('Load at least one parcel before dispatch.');trailer.status='dispatched';parcels.forEach(x=>x.status='dispatched');detail=`Dispatched ${trailer.id} with ${parcels.length} parcels`;break;}
    case 'issue.create': {const area=find(s.areas,p.area,'Area');if(p.priority!=='normal'&&p.priority!=='urgent')fail('Choose a valid priority.');const title=text(p.title,'Issue title',140);s.issues.unshift({id:id(),title,area:area.id,priority:p.priority as 'normal'|'urgent',status:'open',note:text(p.note,'Issue details',500)});detail=`Opened exception: ${title}`;break;}
    case 'issue.resolve': {const issue=find(s.issues,p.id,'Exception');if(issue.status==='resolved')fail('This exception is already resolved.');issue.note+=`\nResolution: ${text(p.note,'Resolution',500)}`;issue.status='resolved';detail=`Resolved exception: ${issue.title}`;break;}
    case 'barcode.map': {
      const code=parseBarcode(p.code).code;const kind=text(p.kind,'Record type') as BarcodeKind;
      if(!barcodeKinds.includes(kind))fail('Choose a supported record type.');find(s[kind] as {id:string}[],p.target,'Record');
      if(s.barcodes.some(b=>b.code===code)||barcodeKinds.some(k=>s[k].some(r=>r.id===code)))fail('This barcode already identifies a record.');
      s.barcodes.push({id:id(),code,kind,target:String(p.target)});detail=`Mapped ${code} to ${kind} ${p.target}`;break;
    }
    case 'load.create': {const lid=text(p.id,'Load ID',40).toUpperCase();unique(s.loads,lid);s.loads.push({id:lid,carrier:text(p.carrier,'Carrier',80),dock:text(p.dock,'Dock',40),status:'expected'});detail=`Expected inbound load ${lid}`;break;}
    case 'load.arrive': {const l=find(s.loads,p.id,'Load');if(l.status!=='expected')fail('This load is already arrived or closed.');l.status='arrived';l.arrivedAt=now;detail=`Load ${l.id} arrived at ${l.dock}`;break;}
    case 'load.close': {const l=find(s.loads,p.id,'Load');if(l.status!=='arrived')fail('The load must arrive before closing.');if(s.units.some(u=>u.load===l.id&&u.status==='expected'))fail('Receive every registered package before closing the load.');l.status='closed';detail=`Closed inbound load ${l.id}`;break;}
    case 'unit.create': {const uid=text(p.id,'Package / pallet ID',40).toUpperCase();unique(s.units,uid);const r=find(s.receipts,p.receipt,'Receipt');if(r.cancelled)fail('This receipt is cancelled.');const qty=quantity(p.qty);if(qty+s.units.filter(u=>u.receipt===r.id&&u.status==='expected').reduce((n,u)=>n+u.qty,0)>r.expected-r.received)fail('Registered packages exceed the remaining receipt quantity.');const load=typeof p.load==='string'?p.load:'';if(load&&!['expected','arrived'].includes(find(s.loads,load,'Load').status))fail('This load is closed.');s.units.push({id:uid,receipt:r.id,sku:r.sku,qty,load,status:'expected'});detail=`Registered package ${uid}: ${qty} × ${r.sku}`;break;}
    case 'unit.cancel': {const u=find(s.units,p.id,'Package');if(u.status!=='expected')fail('Only expected packages can be cancelled.');const reason=text(p.reason,'Reason',300);u.status='cancelled';detail=`Cancelled package ${u.id}. ${reason}`;break;}
    case 'unit.receive': {const u=find(s.units,p.id,'Package');if(u.status!=='expected')fail(u.status==='cancelled'?'This package is cancelled.':'Already received. Inventory was not changed.');if(u.load&&find(s.loads,u.load,'Load').status!=='arrived')fail('Scan the inbound load as arrived first.');const r=find(s.receipts,u.receipt,'Receipt');if(r.cancelled||u.qty>r.expected-r.received)fail('The receipt is cancelled or has insufficient outstanding quantity.');room(s,'RECV',u.qty);balance(s,u.sku,'RECV').qty+=u.qty;r.received+=u.qty;u.status='received';u.receivedAt=now;detail=`Received package ${u.id}: ${u.qty} × ${u.sku} into RECV`;break;}
    case 'receipt.cancel': {const r=find(s.receipts,p.id,'Receipt');if(r.cancelled||r.received===r.expected)fail('This receipt is already closed.');const reason=text(p.reason,'Cancellation reason',300);r.cancelled=true;s.units.filter(u=>u.receipt===r.id&&u.status==='expected').forEach(u=>u.status='cancelled');detail=`Cancelled outstanding receipt ${r.id}; ${r.received} received units retained. ${reason}`;break;}
    case 'order.cancel': {
      const o=find(s.orders,p.id,'Order');if(['shipped','cancelled'].includes(o.status))fail('Shipped orders require a return; cancelled orders cannot be cancelled again.');const reason=text(p.reason,'Cancellation reason',300);
      if(o.status==='picking')for(const a of o.allocations){const b=balance(s,o.sku,a.location);if(b.reserved<a.qty)fail('Reservation mismatch.');b.reserved-=a.qty;}
      if(['picked','packed'].includes(o.status)){const b=balance(s,o.sku,'PACK');if(b.qty<o.qty||b.reserved<o.qty)fail('Packing balance mismatch.');room(s,'RECV',o.qty);b.qty-=o.qty;b.reserved-=o.qty;balance(s,o.sku,'RECV').qty+=o.qty;}
      o.status='cancelled';o.allocations=[];detail=`Cancelled ${o.id}; reservations released, picked stock returned to RECV. ${reason}`;break;
    }
    case 'parcel.unload': {const pck=find(s.parcels,p.id,'Parcel');if(pck.status!=='loaded')fail('Only loaded, undispatched parcels may be unloaded.');const reason=text(p.reason,'Correction reason',300);pck.status='sorted';pck.trailer='';detail=`Unloaded ${pck.id}. ${reason}`;break;}
    case 'parcel.correct': {const pck=find(s.parcels,p.id,'Parcel');if(!['arrived','sorted'].includes(pck.status))fail('Unload the parcel before correcting its route. Dispatched parcels require a return.');const reason=text(p.reason,'Correction reason',300);pck.route=text(p.route,'Route',40).toUpperCase();pck.status='arrived';detail=`Corrected ${pck.id} route to ${pck.route}; sort verification required. ${reason}`;break;}
    case 'parcel.cancel': {const pck=find(s.parcels,p.id,'Parcel');if(!['arrived','sorted','loaded'].includes(pck.status))fail('This parcel cannot be cancelled. Dispatched parcels require a return.');const reason=text(p.reason,'Cancellation reason',300);pck.status='cancelled';pck.trailer='';detail=`Cancelled parcel ${pck.id}. ${reason}`;break;}
    case 'load.cancel': {const l=find(s.loads,p.id,'Load');if(l.status!=='expected')fail('Only expected loads may be cancelled.');const reason=text(p.reason,'Cancellation reason',300);if(s.units.some(u=>u.load===l.id&&u.status!=='cancelled'))fail('This load has registered packages. Resolve the receipt before cancelling the load.');l.status='cancelled';detail=`Cancelled inbound load ${l.id}. ${reason}`;break;}
    case 'trailer.cancel': {const t=find(s.trailers,p.id,'Trailer');if(t.status!=='loading')fail('This trailer is already closed.');if(s.parcels.some(p=>p.trailer===t.id&&p.status==='loaded'))fail('Unload the parcels before cancelling this trailer.');const reason=text(p.reason,'Cancellation reason',300);t.status='cancelled';detail=`Cancelled trailer ${t.id}. ${reason}`;break;}
    case 'receipt.correct': {const r=find(s.receipts,p.id,'Receipt');if(r.cancelled)fail('Cancelled receipts cannot be edited.');const expected=quantity(p.qty);const outstanding=s.units.filter(u=>u.receipt===r.id&&u.status==='expected').reduce((n,u)=>n+u.qty,0);if(expected<r.received+outstanding)fail('Expected quantity cannot be below received and registered units.');const reason=text(p.reason,'Correction reason',300);r.expected=expected;detail=`Corrected receipt ${r.id} expected quantity to ${expected}. ${reason}`;break;}
    case 'return.create': {
      const rid=text(p.id,'Return ID',40).toUpperCase();unique(s.returns,rid);const reason=text(p.reason,'Return reason',300);let sku='',qty=1;
      if(p.source==='order'){const o=find(s.orders,p.reference,'Order');if(o.status!=='shipped')fail('Only shipped orders can be returned.');qty=quantity(p.qty);const already=s.returns.filter(r=>r.source==='order'&&r.reference===o.id&&r.status!=='cancelled').reduce((n,r)=>n+r.qty,0);if(already+qty>o.qty)fail('Returns exceed the shipped quantity.');sku=o.sku;}
      else if(p.source==='parcel'){const parcel=find(s.parcels,p.reference,'Parcel');if(parcel.status!=='dispatched')fail('Only dispatched parcels can be returned.');if(s.returns.some(r=>r.source==='parcel'&&r.reference===parcel.id&&r.status!=='cancelled'&&r.status!=='closed'))fail('A return is already open for this parcel.');}
      else fail('Choose an order or parcel return.');
      s.returns.unshift({id:rid,source:p.source as 'order'|'parcel',reference:String(p.reference),sku,qty,reason,status:'requested'});detail=`Requested return ${rid} for ${p.reference}. ${reason}`;break;
    }
    case 'return.cancel': {const r=find(s.returns,p.id,'Return');if(r.status!=='requested')fail('Only unreceived returns can be cancelled.');const reason=text(p.reason,'Reason',300);r.status='cancelled';detail=`Cancelled return ${r.id}. ${reason}`;break;}
    case 'return.receive': {const r=find(s.returns,p.id,'Return');if(r.status!=='requested')fail('This return has already been received or closed.');if(r.source==='order'){if(!s.locations.some(l=>l.id==='RETURN-Q'))s.locations.push({id:'RETURN-Q',zone:'Returns inspection',type:'quarantine',capacity:1000000});room(s,'RETURN-Q',r.qty);balance(s,r.sku,'RETURN-Q').qty+=r.qty;}else{const pck=find(s.parcels,r.reference,'Parcel');if(pck.status!=='dispatched')fail('Parcel status changed.');pck.status='returned';pck.trailer='';}r.status='received';detail=`Received return ${r.id} into inspection hold`;break;}
    case 'return.dispose': {const r=find(s.returns,p.id,'Return');if(r.status!=='received')fail('Receive the return before inspection.');const reason=text(p.reason,'Inspection result',300);if(r.source==='order'){if(!['restock','scrap'].includes(String(p.disposition)))fail('Choose restock or scrap.');const b=balance(s,r.sku,'RETURN-Q');if(b.qty<r.qty)fail('Quarantine stock mismatch.');if(p.disposition==='restock'){const l=find(s.locations,p.location,'Restock location');if(l.type!=='storage')fail('Choose a storage location.');room(s,l.id,r.qty);balance(s,r.sku,l.id).qty+=r.qty;}b.qty-=r.qty;}else{if(p.disposition!=='resort')fail('Return the parcel to sortation.');const pck=find(s.parcels,r.reference,'Parcel');if(pck.status!=='returned')fail('Parcel is no longer on return hold.');pck.status='arrived';}r.status='closed';r.disposition=p.disposition as ReturnRecord['disposition'];detail=`Inspected return ${r.id}: ${r.disposition}. ${reason}`;break;}
    case 'correction.request': {const item=find(s.items,p.sku,'Item');const l=find(s.locations,p.location,'Location');if(!['storage','receiving'].includes(l.type))fail('Packing and returns stock must follow their order or return workflow.');const b=balance(s,item.id,l.id);const qty=quantity(p.qty,'Physical count',true);if(qty<b.reserved)fail('Count is below reserved stock. Resolve picking first.');if(s.corrections.some(c=>c.sku===item.id&&c.location===l.id&&c.status==='pending'))fail('A count correction is already pending for this location and item.');s.corrections.unshift({id:id(),sku:item.id,location:l.id,qty,before:b.qty,reserved:b.reserved,reason:text(p.reason,'Correction reason',300),requestedBy:actor,status:'pending'});detail=`Requested count correction ${item.id} at ${l.id}: ${b.qty} → ${qty}; awaiting a second supervisor`;break;}
    case 'correction.review': {const c=find(s.corrections,p.id,'Correction');if(c.status!=='pending')fail('This correction has already been reviewed.');if(c.requestedBy===actor)fail('A different supervisor must review this correction.');if(typeof p.approve!=='boolean')fail('Choose approve or reject.');const reason=text(p.reason,'Review reason',300);if(p.approve){const b=balance(s,c.sku,c.location);if(b.qty!==c.before||b.reserved!==c.reserved)fail('Stock changed since the count. Reject this request and recount.');if(c.qty<b.reserved)fail('Count is below reservations.');room(s,c.location,c.qty-b.qty);b.qty=c.qty;}c.status=p.approve?'approved':'rejected';c.reviewedBy=actor;detail=`${c.status} correction ${c.id}. ${reason}`;break;}
    case 'label.print': {const kind=text(p.kind,'Label type') as BarcodeKind;if(!barcodeKinds.includes(kind))fail('Unsupported label type.');find(s[kind] as {id:string}[],p.id,'Label record');detail=`Prepared ${kind} label ${p.id} for print / reprint`;break;}
    default: fail('Unknown action.');
  }
  if(s.balances.some(b=>!Number.isSafeInteger(b.qty)||b.qty<0||b.reserved<0||b.reserved>b.qty))fail('Stock integrity check failed. No changes were saved.');
  s.revision++;s.audit.unshift({id:id(),at:now,actor,action:command.type,detail});return s;
}

export function upgradeState(state:WarehouseState):WarehouseState {return {...state,loads:state.loads??[],units:state.units??[],returns:state.returns??[],corrections:state.corrections??[],barcodes:state.barcodes??[]};}
