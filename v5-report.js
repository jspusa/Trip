/* Searchable reimbursement PDF. Rendering and trip data stay on this device. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),toolbar=document.querySelector('.export-actions');if(!toolbar||!window.TripV5)return;
const base=new URL('.',document.currentScript?.src||document.baseURI);
const button=document.createElement('button');button.id='v5ReportPdfBtn';button.type='button';button.className='primary-btn';button.textContent='報帳版 PDF';button.disabled=true;toolbar.insertBefore(button,$('exportPdfBtn'));
const status=document.createElement('p');status.id='v5ReportStatus';status.className='export-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');toolbar.append(status);
const link=document.createElement('a');link.id='v5ReportDownload';link.className='export-download';link.textContent='報帳 PDF 已產生，點此儲存';link.hidden=true;toolbar.append(link);
const scripts=new Map();let fontPromise=null,lastUrl=null,busy=false;
function sync(){button.disabled=busy||document.body.dataset.pdfBusy==='true'||!window.TripV5.ready();}
['trip:calculated','trip:export-busy'].forEach(name=>document.addEventListener(name,sync));
document.addEventListener('trip:invalidate',()=>{link.hidden=true;if(!busy)status.textContent='';sync();});sync();
function loadScript(path,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);if(scripts.has(path))return scripts.get(path);
  const promise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,base).href;const fail=()=>{clearTimeout(timer);s.remove();scripts.delete(path);reject(new Error('報帳元件載入失敗，請重試'));};const timer=setTimeout(fail,20000);s.onerror=fail;s.onload=()=>{clearTimeout(timer);if(window[globalName])resolve(window[globalName]);else fail();};document.head.append(s);});scripts.set(path,promise);return promise;
}
async function loadFont(){
  if(fontPromise)return fontPromise;
  fontPromise=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const response=await fetch(new URL('vendor/trip-report-tc.ttf',base),{signal:controller.signal});if(!response.ok)throw new Error('報帳字型載入失敗，請重試');return new Uint8Array(await response.arrayBuffer());}finally{clearTimeout(timer);}})().catch(error=>{fontPromise=null;throw error;});return fontPromise;
}
function currency(value,code){return code+' '+Number(value).toFixed(code==='TWD'?0:2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
async function reportPDF(data){
  const [lib,kit,bytes]=await Promise.all([loadScript('vendor/pdf-lib-1.17.1.min.js','PDFLib'),loadScript('vendor/fontkit-1.1.1.umd.min.js','fontkit'),loadFont()]);
  const {PDFDocument,rgb}=lib,doc=await PDFDocument.create();doc.registerFontkit(kit);
  // Complete CJK glyphs and separate Latin metrics avoid missing outlines and numeral spacing.
  const font=await doc.embedFont(bytes,{subset:false}),latin=await doc.embedFont(lib.StandardFonts.Helvetica);
  const supported=new Set(font.getCharacterSet());
  const dark=rgb(.12,.15,.2),muted=rgb(.38,.42,.48),blue=rgb(0,.34,.65),lineColor=rgb(.82,.86,.9),pale=rgb(.95,.97,.99);
  const W=595.276,H=841.89,M=36,I=W-2*M;
  let page,y;const all=[];
  function clean(value){const text=String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');for(const ch of text){if(ch!=='\n'&&ch!=='\r'&&!supported.has(ch.codePointAt(0)))throw new Error('報帳資料含不支援的字元「'+ch+'」，請移除特殊符號後重試。');}return text;}
  const segments=text=>String(text).match(/[\x20-\x7e]+|[^\x20-\x7e]+/g)||[];
  const runFont=text=>/^[\x20-\x7e]+$/.test(text)?latin:font;
  const measure=(text,size)=>segments(text).reduce((sum,run)=>sum+runFont(run).widthOfTextAtSize(run,size),0);
  function lines(text,width,size){const out=[];for(const paragraph of clean(text).split(/\r?\n/)){let row='';for(const ch of paragraph){if(row&&measure(row+ch,size)>width){out.push(row);row=ch;}else row+=ch;}out.push(row);}return out;}
  function draw(text,x,top,size=10,color=dark){let cursor=x;for(const run of segments(clean(text))){const f=runFont(run);page.drawText(run,{x:cursor,y:H-top-size,size,font:f,color});cursor+=f.widthOfTextAtSize(run,size);}}
  function line(top){page.drawLine({start:{x:M,y:H-top},end:{x:W-M,y:H-top},thickness:.6,color:lineColor});}
  function newPage(continuation=false){page=doc.addPage([W,H]);all.push(page);y=M;draw(continuation?'出差伙食費明細（續頁）':'出差伙食費報帳明細',M,y,continuation?17:21,blue);y+=continuation?30:34;draw('Jasper Travel  /  V5.1',M,y,9,muted);y+=20;line(y);y+=14;}
  function space(height){if(y+height>H-60)newPage(true);}
  function paragraph(text,size=10,width=I,color=dark){const wrapped=lines(text,width,size);wrapped.forEach(row=>{space(size*1.65);draw(row,M,y,size,color);y+=size*1.65;});}
  function field(label,text){if(!text)return;const wrapped=lines(text,I-66,10);space(wrapped.length*16+7);draw(label,M,y,10,muted);wrapped.forEach((row,i)=>draw(row,M+66,y+i*16,10));y+=wrapped.length*16+7;}
  newPage();
  field('目的地',data.country+'・'+data.city+(data.other?'（套用其他地區費率）':''));
  field('抵達當地',data.arrDate+' '+data.arrTime);field('離開當地',data.depDate+' '+data.depTime);
  field('姓名',data.meta.name);field('部門',data.meta.department);field('出差事由',data.meta.purpose);
  paragraph('日期與時間均為當地時間；幣別：'+data.currency,9,I,muted);y+=10;
  const cols=[108,98,98,98,I-402];
  function tableHead(){space(58);let x=M;page.drawRectangle({x:M,y:H-y-26,width:I,height:26,color:pale});['日期','早餐','午餐','晚餐','當日合計'].forEach((label,i)=>{draw(label,x+8,y+7,10,blue);x+=cols[i];});y+=29;}
  tableHead();
  data.rows.forEach((row,index)=>{
    const values=[row.date,...row.cells.map(c=>c.included?currency(c.amount,data.currency):c.reason),currency(row.total,data.currency)];
    const wrapped=values.map((t,i)=>lines(t,cols[i]-16,9));const height=Math.max(...wrapped.map(a=>a.length))*14+13;
    if(y+height>H-70){newPage(true);tableHead();}
    if(index%2===1)page.drawRectangle({x:M,y:H-y-height,width:I,height,color:rgb(.985,.988,.99)});
    let x=M;wrapped.forEach((text,i)=>{text.forEach((t,j)=>draw(t,x+8,y+6+j*14,9,i===4?blue:dark));x+=cols[i];});y+=height;line(y);
  });
  y+=14;space(116);
  ['B','L','D'].forEach((m,i)=>{draw(['早餐','午餐','晚餐'][i]+'：'+currency(data.rate[m],data.currency)+' × '+data.counts[m]+' 餐',M+8,y,10,muted);const amount=currency(data.subtotals[m],data.currency);draw(amount,W-M-measure(amount,10)-8,y,10);y+=19;});
  y+=4;page.drawRectangle({x:M,y:H-y-38,width:I,height:38,color:pale});draw('可核給合計',M+10,y+9,13,blue);const total=currency(data.total,data.currency);draw(total,W-M-measure(total,18)-10,y+6,18,blue);y+=52;
  paragraph('判斷依據',11,I,blue);
  paragraph('抵達當日：09:00 前核給三餐；09:00–12:59 核給午、晚餐；13:00–20:59 核給晚餐；21:00 後不核給。',9,I,muted);
  paragraph('離開當日：05:00 前不核給；05:00–11:59 核給早餐；12:00–18:59 核給早、午餐；19:00 後核給三餐。',9,I,muted);
  paragraph('中間完整日期依費率核給；已供餐依實際設定扣除。逐日供餐調整不增加時段外餐費。',9,I,muted);
  if(data.other)paragraph('注意：此行程套用「其他地區」費率，請依公司規定確認。',9,I,muted);
  all.forEach((sheet,i)=>{page=sheet;page.drawLine({start:{x:M,y:42},end:{x:W-M,y:42},thickness:.5,color:lineColor});draw('匯出：'+new Date().toLocaleString('zh-TW',{hour12:false}),M,H-33,8,muted);const number=(i+1)+' / '+all.length;draw(number,W-M-measure(number,9),H-34,9,muted);});
  doc.setTitle('出差伙食費報帳明細');doc.setCreator('Jasper Travel V5.1');doc.setProducer('Jasper Travel — local PDF export');doc.setLanguage('zh-TW');
  return{blob:new Blob([await doc.save()],{type:'application/pdf'}),pages:all.length};
}
button.addEventListener('click',async()=>{
  if(button.disabled||busy||document.body.dataset.pdfBusy==='true')return;const data=window.TripV5.getReport();if(!data)return;
  busy=true;document.body.dataset.pdfBusy='true';document.dispatchEvent(new Event('trip:export-busy'));sync();button.textContent='正在製作報帳 PDF…';status.classList.remove('error');status.textContent='正在準備可搜尋文字的報帳文件；首次需載入報帳元件。';link.hidden=true;
  try{
    const result=await reportPDF(data),place=(data.country+'_'+data.city).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,60);if(lastUrl){const old=lastUrl;setTimeout(()=>URL.revokeObjectURL(old),60000);}lastUrl=URL.createObjectURL(result.blob);link.href=lastUrl;link.download=`出差伙食費_報帳版_${place}_${data.arrDate}_${data.depDate}.pdf`;link.hidden=false;link.click();status.textContent=`報帳 PDF 已產生，共 ${result.pages} 頁；內容可搜尋、複製。`;
  }catch(error){console.error('Report PDF:',error);status.classList.add('error');status.textContent=(error.message||'報帳 PDF 匯出失敗')+' 也可使用「匯出整頁 PDF」或「列印」。';}
  finally{busy=false;document.body.dataset.pdfBusy='false';document.dispatchEvent(new Event('trip:export-busy'));button.textContent='報帳版 PDF';sync();}
});
})();
