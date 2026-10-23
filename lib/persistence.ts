import type { WarehouseState } from './domain.ts';
export const recordKinds=['areas','employees','items','locations','receipts','orders','parcels','trailers','issues','notices','loads','units','returns','corrections','barcodes'] as const;
export function stateDelta(before:WarehouseState,next:WarehouseState){
  const records=recordKinds.flatMap(kind=>next[kind].filter(r=>JSON.stringify(before[kind].find(b=>b.id===r.id))!==JSON.stringify(r)).map(r=>({kind,id:r.id,data:r})));
  const balances=next.balances.filter(b=>{const old=before.balances.find(o=>o.sku===b.sku&&o.location===b.location);return !old||old.qty!==b.qty||old.reserved!==b.reserved;}).map(b=>{const old=before.balances.find(o=>o.sku===b.sku&&o.location===b.location);return {...b,delta:b.qty-(old?.qty??0),reservedDelta:b.reserved-(old?.reserved??0)};});
  return {records,balances};
}
export function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
