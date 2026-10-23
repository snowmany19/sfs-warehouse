import { DomainError } from './domain.ts';
import { barcodeKinds, type BarcodeKind } from './barcodes.ts';
export function labelCode(kind:BarcodeKind,id:string){
  if(!barcodeKinds.includes(kind)||!(/^[A-Za-z0-9._/-]{1,24}$/).test(id))throw new DomainError('Label IDs must use 1–24 letters, numbers, dots, hyphens, underscores, or slashes.');
  const codes:Record<BarcodeKind,string>={items:'I',units:'U',loads:'L',parcels:'P',locations:'B',trailers:'T',receipts:'R',orders:'O'};return `SFS:${codes[kind]}:${id}`;
}
const zplField=(value:string)=>Array.from(new TextEncoder().encode(value)).map(b=>'\\'+b.toString(16).padStart(2,'0').toUpperCase()).join('');
export function zebraLabel(kind:BarcodeKind,id:string,facility:string,dpi:203|300=203){
  const code=labelCode(kind,id),scale=dpi/203,n=(v:number)=>Math.round(v*scale);
  // Hex-encode all field data so user-supplied text cannot inject ZPL commands.
  return `^XA\n^PW${dpi*4}\n^LL${dpi*6}\n^CI28\n^FO${n(48)},${n(60)}^A0N,${n(38)},${n(38)}^FDSFS WAREHOUSE^FS\n^FO${n(48)},${n(125)}^A0N,${n(24)},${n(24)}^FH\\^FD${zplField(facility.slice(0,42))}^FS\n^FO${n(48)},${n(225)}^A0N,${n(30)},${n(30)}^FH\\^FD${zplField(kind.toUpperCase())}^FS\n^FO${n(48)},${n(290)}^A0N,${n(36)},${n(28)}^FH\\^FD${zplField(id)}^FS\n^FO${n(32)},${n(420)}^BY${n(2)},3,${n(150)}^BCN,${n(150)},N,N,N^FH\\^FD${zplField(code)}^FS\n^FO${n(48)},${n(615)}^A0N,${n(20)},${n(20)}^FH\\^FD${zplField(code)}^FS\n^FO${n(48)},${n(1050)}^A0N,${n(20)},${n(20)}^FDSFS internal logistics label^FS\n^PQ1\n^XZ`;
}
