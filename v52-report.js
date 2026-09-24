/* V5.2 compact reimbursement PDF — searchable Traditional Chinese output. Uses the already-calculated V4.6 result; all processing stays local. */
(()=>{'use strict';
const $=id=>document.getElementById(id),toolbar=document.querySelector('.export-actions');if(!toolbar)return;
const button=document.createElement('button');button.id='v52ReportPdfBtn';button.type='button';button.className='primary-btn v52-report-primary';button.textContent='報帳版 PDF';button.disabled=true;
const full=$('exportPdfBtn');toolbar.insertBefore(button,full);
const note=toolbar.querySelector('.export-note');if(note)note.textContent='建議優先使用「報帳版 PDF」；需要保留完整畫面時再使用整頁 PDF。';
const status=document.createElement('p');status.className='export-status';status.id='v52ReportStatus';status.setAttribute('aria-live','polite');toolbar.append(status);
const link=document.createElement('a');link.className='export-download';link.id='v52ReportDownload';link.hidden=true;link.textContent='報帳 PDF 已產生，點此儲存';toolbar.append(link);
let busy=false,lastUrl=null,fontPromise=null;const scripts=new Map(),base=new URL('.',document.currentScript?.src||document.baseURI);
function ready(){return $('results').classList.contains('show')&&!$('calculateBtn').disabled;}
function sync(){button.disabled=busy||!ready();}
new MutationObserver(sync).observe($('results'),{attributes:true,attributeFilter:['class']});new MutationObserver(sync).observe($('calculateBtn'),{attributes:true,attributeFilter:['disabled']});sync();
function load(path,name){if(window[name])return Promise.resolve(window[name]);if(scripts.has(path))return scripts.get(path);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,base).href;s.onload=()=>window[name]?resolve(window[name]):reject(new Error('報帳元件載入失敗'));s.onerror=()=>reject(new Error('報帳元件載入失敗'));document.head.append(s);});scripts.set(path,p);return p;}
function font(){if(!fontPromise)fontPromise=fetch(new URL('vendor/trip-report-tc.ttf',base)).then(r=>{if(!r.ok)throw new Error('報帳字型載入失敗');return r.arrayBuffer();}).then(b=>new Uint8Array(b)).catch(e=>{fontPromise=null;throw e;});return fontPromise;}
function snapshot(){
 const rows=[...document.querySelectorAll('#dayList .day-row:not(.day-header)')].map(row=>[...row.children].map(c=>c.textContent.trim()));
 const breakdown=[...document.querySelectorAll('#breakdown .breakdown-item')].map(x=>({label:x.querySelector('span')?.textContent.trim()||'',value:x.querySelector('strong')?.textContent.trim()||''}));
 return{place:$('summaryPlace').textContent.replace(/^⚠\s*/,''),arrival:$('arrDate').value+' '+$('arrTime').value,departure:$('depDate').value+' '+$('depTime').value,total:$('totalAmount').textContent.trim(),counts:{B:$('countB').textContent,L:$('countL').textContent,D:$('countD').textContent},rows,breakdown,basis:$('basis').innerText.trim()};
}
async function make(data){
 const [lib,kit,bytes]=await Promise.all([load('vendor/pdf-lib-1.17.1.min.js','PDFLib'),load('vendor/fontkit-1.1.1.umd.min.js','fontkit'),font()]);
 const {PDFDocument,rgb}=lib,doc=await PDFDocument.create();doc.registerFontkit(kit);const tc=await doc.embedFont(bytes,{subset:false}),latin=await doc.embedFont(lib.StandardFonts.Helvetica);const supported=new Set(tc.getCharacterSet());
 const W=595.276,H=841.89,M=38,I=W-2*M,dark=rgb(.12,.12,.13),muted=rgb(.42,.42,.45),blue=rgb(0,.36,.75),line=rgb(.87,.87,.89),pale=rgb(.965,.968,.975);let page,y,pages=[];
 const clean=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ');
 const runs=t=>clean(t).match(/[\x20-\x7e]+|[^\x20-\x7e]+/g)||[];const rf=t=>/^[\x20-\x7e]+$/.test(t)?latin:tc;
 const measure=(t,s)=>runs(t).reduce((n,r)=>n+rf(r).widthOfTextAtSize(r,s),0);
 function draw(t,x,top,size=10,color=dark){let cx=x;for(const r of runs(t)){for(const ch of r)if(!/^[\x20-\x7e]$/.test(ch)&&!supported.has(ch.codePointAt(0)))throw new Error('報帳資料含不支援的特殊符號');const f=rf(r);page.drawText(r,{x:cx,y:H-top-size,size,font:f,color});cx+=f.widthOfTextAtSize(r,size);}}
 function wrap(t,w,s){const out=[];let row='';for(const ch of clean(t)){if(row&&measure(row+ch,s)>w){out.push(row);row=ch}else row+=ch}if(row)out.push(row);return out.length?out:[''];}
 function newPage(cont=false){page=doc.addPage([W,H]);pages.push(page);y=M;draw(cont?'出差伙食費報帳明細（續頁）':'出差伙食費報帳明細',M,y,cont?16:21,blue);y+=cont?30:36;}
 function need(h){if(y+h>H-58)newPage(true);}
 function field(label,value){const ls=wrap(value,I-76,10);need(ls.length*15+7);draw(label,M,y,9,muted);ls.forEach((t,i)=>draw(t,M+76,y+i*15,10));y+=ls.length*15+7;}
 newPage();field('目的地',data.place);field('抵達當地',data.arrival);field('離開當地',data.departure);y+=6;page.drawLine({start:{x:M,y:H-y},end:{x:W-M,y:H-y},thickness:.6,color:line});y+=14;
 page.drawRectangle({x:M,y:H-y-52,width:I,height:52,color:pale});draw('可核給合計',M+12,y+8,11,muted);draw(data.total,M+12,y+24,20,blue);draw('早餐 '+data.counts.B+'　午餐 '+data.counts.L+'　晚餐 '+data.counts.D,W-M-190,y+19,9,muted);y+=68;
 const widths=[112,102,102,102,I-418];function head(){need(44);page.drawRectangle({x:M,y:H-y-25,width:I,height:25,color:pale});let x=M;['日期','早餐','午餐','晚餐','小計'].forEach((t,i)=>{draw(t,x+7,y+7,9,blue);x+=widths[i]});y+=28;}head();
 data.rows.forEach((r,idx)=>{const subtotal='';const vals=[r[0],r[1],r[2],r[3],subtotal];const lines=vals.map((t,i)=>wrap(t,widths[i]-14,8.5));const h=Math.max(...lines.map(a=>a.length))*13+12;if(y+h>H-60){newPage(true);head()}if(idx%2)page.drawRectangle({x:M,y:H-y-h,width:I,height:h,color:rgb(.988,.988,.99)});let x=M;lines.forEach((ls,i)=>{ls.forEach((t,j)=>draw(t,x+7,y+5+j*13,8.5,i===4?blue:dark));x+=widths[i]});y+=h;page.drawLine({start:{x:M,y:H-y},end:{x:W-M,y:H-y},thickness:.4,color:line});});
 y+=14;need(90);data.breakdown.forEach(item=>{draw(item.label,M,y,9,muted);draw(item.value,W-M-measure(item.value,10),y,10);y+=18});y+=8;need(60);draw('判斷依據',M,y,10,blue);y+=17;wrap(data.basis,I,8.5).forEach(t=>{need(14);draw(t,M,y,8.5,muted);y+=14});
 pages.forEach((p,i)=>{page=p;page.drawLine({start:{x:M,y:42},end:{x:W-M,y:42},thickness:.5,color:line});draw('Jasper Travel V5.2',M,H-33,8,muted);const n=(i+1)+' / '+pages.length;draw(n,W-M-measure(n,8),H-33,8,muted)});
 doc.setTitle('出差伙食費報帳明細');doc.setCreator('Jasper Travel V5.2');doc.setLanguage('zh-TW');return{blob:new Blob([await doc.save()],{type:'application/pdf'}),pages:pages.length};
}
button.addEventListener('click',async()=>{if(button.disabled||busy)return;busy=true;sync();button.textContent='正在製作…';status.textContent='正在產生可搜尋文字的報帳 PDF…';link.hidden=true;try{const data=snapshot(),out=await make(data);if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=URL.createObjectURL(out.blob);link.href=lastUrl;link.download='出差伙食費_報帳版_'+data.place.replace(/[\\/:*?"<>|]/g,'_').slice(0,40)+'.pdf';link.hidden=false;link.click();status.textContent='報帳 PDF 已產生，共 '+out.pages+' 頁；內容可搜尋、複製。';}catch(e){console.error(e);status.classList.add('error');status.textContent=(e.message||'報帳 PDF 匯出失敗')+'；可改用整頁 PDF 或列印。';}finally{busy=false;button.textContent='報帳版 PDF';sync();}});
})();