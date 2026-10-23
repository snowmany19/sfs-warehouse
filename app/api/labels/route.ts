import { access,failure,readWorkspace } from '../../../lib/server/workspace';
import { barcodeKinds,type BarcodeKind } from '../../../lib/barcodes';
import { labelCode,zebraLabel } from '../../../lib/labels';
import { AccessError } from '../../../lib/access';
import bwipjs from 'bwip-js/generic';
export async function GET(request:Request){try{
  const {member}=await access(['owner','supervisor']),{state}=await readWorkspace(member.owner),url=new URL(request.url);
  const kind=url.searchParams.get('kind') as BarcodeKind,id=url.searchParams.get('id')||'';
  if(!barcodeKinds.includes(kind)||!state[kind].some(r=>r.id===id))throw new AccessError('Label record not found.',404);
  const code=labelCode(kind,id);const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"};
  if(url.searchParams.get('format')==='zpl')return new Response(zebraLabel(kind,id,state.facility,url.searchParams.get('dpi')==='300'?300:203),{headers:{...headers,'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="sfs-${kind}-label.zpl"`}});
  const svg=bwipjs.toSVG({bcid:'code128',text:code,scale:2,height:20,includetext:true,padding:12});
  return new Response(svg,{headers:{...headers,'Content-Type':'image/svg+xml'}});
}catch(e){return failure(e);}}
