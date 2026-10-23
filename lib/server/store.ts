import { db, memberGuard, guardArgs } from './workspace';
import { stateDelta, recordKinds, canonical } from '../persistence';
import { upgradeState, type WarehouseState, type Command } from '../domain';
import { AccessError, type Member } from '../access';
export async function readState(facility:string){
  // D1 batch is a transaction: metadata and records are a consistent snapshot.
  const result=await db().batch([
    db().prepare('SELECT revision,data FROM workspaces WHERE owner=?').bind(facility),
    db().prepare('SELECT kind,data FROM operational_records WHERE facility=? ORDER BY id').bind(facility),
    db().prepare('SELECT sku,location,qty,reserved FROM inventory_balances WHERE facility=?').bind(facility),
    db().prepare('SELECT id,at,actor,action,detail FROM audit_events WHERE facility=? ORDER BY at DESC,id DESC LIMIT 200').bind(facility),
  ]);
  const row=result[0].results[0] as {revision:number;data:string}|undefined;if(!row)throw new AccessError('Workspace unavailable.',404);
  const state=upgradeState({...JSON.parse(row.data),...Object.fromEntries(recordKinds.map(k=>[k,[]])),revision:row.revision,balances:result[2].results,audit:result[3].results} as WarehouseState);
  for(const r of result[1].results as {kind:typeof recordKinds[number];data:string}[])(state[r.kind] as unknown[]).push(JSON.parse(r.data));
  return {row,state};
}
export async function commandHash(command:Command){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(command))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function checkReplay(member:Member,request:string,hash:string){
  const prior=await db().prepare('SELECT actor,hash FROM operation_receipts WHERE facility=? AND request=?').bind(member.owner,request).first<{actor:string;hash:string}>();
  if(prior&&(prior.actor!==member.id||prior.hash!==hash))throw new AccessError('This request ID was already used for a different action.',409);
  return Boolean(prior);
}
export async function commitState(member:Member,before:WarehouseState,next:WarehouseState,request:string,hash:string){
  const token=crypto.randomUUID(),facility=member.owner,event=next.audit[0],delta=stateDelta(before,next);
  const guarded='EXISTS (SELECT 1 FROM workspaces WHERE owner=? AND write_token=?)';
  const statements=[
    db().prepare(`UPDATE workspaces SET revision=?,write_token=? WHERE owner=? AND revision=? AND ${memberGuard} AND NOT EXISTS (SELECT 1 FROM operation_receipts WHERE facility=? AND request=?)`).bind(next.revision,token,facility,before.revision,...guardArgs(member),facility,request),
    db().prepare(`INSERT INTO operational_records(facility,kind,id,data) SELECT ?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.data') FROM json_each(?) WHERE ${guarded} ON CONFLICT(facility,kind,id) DO UPDATE SET data=excluded.data`).bind(facility,JSON.stringify(delta.records),facility,token),
    db().prepare(`INSERT INTO inventory_balances SELECT ?,json_extract(value,'$.sku'),json_extract(value,'$.location'),json_extract(value,'$.qty'),json_extract(value,'$.reserved') FROM json_each(?) WHERE ${guarded} ON CONFLICT(facility,sku,location) DO UPDATE SET qty=excluded.qty,reserved=excluded.reserved`).bind(facility,JSON.stringify(delta.balances),facility,token),
    db().prepare(`INSERT INTO audit_events(facility,id,revision,at,actor,action,detail) SELECT ?,?,?,?,?,?,? WHERE ${guarded}`).bind(facility,event.id,next.revision,event.at,event.actor,event.action,event.detail,facility,token),
    db().prepare(`INSERT INTO stock_ledger SELECT ?,?,json_extract(value,'$.sku'),json_extract(value,'$.location'),json_extract(value,'$.delta'),json_extract(value,'$.reservedDelta'),json_extract(value,'$.qty'),json_extract(value,'$.reserved') FROM json_each(?) WHERE ${guarded}`).bind(facility,event.id,JSON.stringify(delta.balances),facility,token),
    db().prepare(`INSERT INTO operation_receipts SELECT ?,?,?,?,?,? WHERE ${guarded}`).bind(facility,request,member.id,hash,next.revision,event.at,facility,token),
    db().prepare(`INSERT OR IGNORE INTO push_deliveries(id,subscription_id,notice,owner,status,attempts,updated)
      SELECT lower(hex(randomblob(16))),p.id,r.id,r.facility,'pending',0,? FROM operational_records r JOIN memberships m ON m.owner=r.facility AND m.employee=json_extract(r.data,'$.employee') AND m.role='employee' AND m.status='active' JOIN push_subscriptions p ON p.member=m.id
      WHERE r.facility=? AND r.kind='notices' AND json_extract(r.data,'$.status')='pending' AND r.id IN (SELECT value FROM json_each(?)) AND ${guarded}`)
      .bind(event.at,facility,JSON.stringify(next.notices.filter(n=>!before.notices.some(o=>o.id===n.id)).map(n=>n.id)),facility,token),
  ];
  const result=await db().batch(statements);return result[0].meta.changes===1;
}
