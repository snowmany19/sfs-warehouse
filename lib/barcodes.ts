import { DomainError, type WarehouseState, type Command } from './domain.ts';
export type BarcodeKind = 'items'|'units'|'loads'|'parcels'|'locations'|'trailers'|'receipts'|'orders';
export const barcodeKinds: BarcodeKind[] = ['items','units','loads','parcels','locations','trailers','receipts','orders'];
export function parseBarcode(input: unknown): {code:string;kind?:BarcodeKind} {
  if(typeof input!=='string'||input.length>200)throw new DomainError('Scan a valid barcode (maximum 200 characters).');
  let code=input.replace(/[\r\n]+$/,'').trim();
  if(code.startsWith(']C0'))code=code.slice(3);
  // Support standalone GS1 SSCC / GTIN identifiers. Composite GS1 data requires a configured mapping.
  if(code.startsWith(']C1')||/^\((00|01)\)/.test(code)) {
    code=code.replace(/^\]C1/,'');
    const match=code.match(/^(?:\(00\)|00)(\d{18})$/)||code.match(/^(?:\(01\)|01)(\d{14})$/);
    if(!match)throw new DomainError('This GS1 barcode needs a mapping. Standalone SSCC (00) and GTIN (01) are supported.');
    const digits=match[1];let sum=0;for(let i=digits.length-2,w=3;i>=0;i--,w=w===3?1:3)sum+=Number(digits[i])*w;
    if((10-sum%10)%10!==Number(digits.at(-1)))throw new DomainError('The GS1 check digit is invalid.');
    code=digits;
  }
  if(!code||!/^[\x20-\x7e]+$/.test(code))throw new DomainError('Barcode contains unsupported characters.');
  const match=code.match(/^SFS:([a-zA-Z]+):(.+)$/);
  if(match){const short:Record<string,BarcodeKind>={I:'items',U:'units',L:'loads',P:'parcels',B:'locations',T:'trailers',R:'receipts',O:'orders'};match[1]=short[match[1]]??match[1];if(!barcodeKinds.includes(match[1] as BarcodeKind))throw new DomainError('Unknown SFS label type.');return {kind:match[1] as BarcodeKind,code:match[2]};}
  return {code};
}
export function resolveBarcode(state:WarehouseState,input:unknown,kind:BarcodeKind){
  const parsed=parseBarcode(input);if(parsed.kind&&parsed.kind!==kind)throw new DomainError(`Scan a ${kind} label for this task.`);
  const alias=state.barcodes.find(b=>b.code===parsed.code);
  if(alias&&alias.kind!==kind)throw new DomainError('This barcode is mapped to a different record type.');
  const id=alias?.target??parsed.code;
  if(!state[kind].some(r=>r.id===id))throw new DomainError(`Unknown barcode: register the ${kind} record or map its barcode first.`);
  return id;
}
export function scanCommand(state:WarehouseState,p:Record<string,unknown>):Command{
  const workflows:Record<string,{kind:BarcodeKind;type:string}>= {
    receive:{kind:'units',type:'unit.receive'},arrive:{kind:'loads',type:'load.arrive'},
    sort:{kind:'parcels',type:'parcel.sort'},load:{kind:'parcels',type:'parcel.load'},
  };
  const workflow=Object.hasOwn(workflows,String(p.workflow))?workflows[String(p.workflow)]:undefined;if(!workflow)throw new DomainError('Choose a scan task.');
  const id=resolveBarcode(state,p.barcode,workflow.kind);
  const payload:Record<string,unknown>={id};
  if(p.workflow==='sort')payload.lane=p.lane;
  if(p.workflow==='load')payload.trailer=resolveBarcode(state,p.trailer,'trailers');
  return {type:workflow.type,payload};
}
