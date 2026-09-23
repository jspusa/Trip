/* Full-page PDF export stays on this device. No trip data is sent to a service. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('secretaryDialog');
  if(!dialog||document.querySelector('.export-actions'))return;
  const body=dialog.querySelector('.secretary-body');
  const panel=dialog.querySelector('.secretary-panel');
  const footer=document.createElement('div');
  footer.className='secretary-footer';
  const groups=['secretaryForm','secretaryMeals','secretaryReview'].map(id=>{
    const owner=$(id),actions=owner.querySelector('.secretary-actions');
    actions.querySelectorAll('button[type="submit"]').forEach(button=>button.setAttribute('form',id));
    footer.append(actions);
    return {owner,actions};
  });
  dialog.append(footer);
  function syncGroups(){groups.forEach(({owner,actions})=>{actions.hidden=owner.hidden;});}
  let frame=0;
  function fitDialog(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      if(!dialog.open)return;
      const viewport=window.visualViewport;
      const available=viewport?viewport.height:window.innerHeight;
      const sheet=window.matchMedia('(max-width:640px)').matches;
      const height=Math.max(0,Math.min(sheet?760:740,available-(sheet?12:40)));
      dialog.style.setProperty('--trip-dialog-height',`${height}px`);
      dialog.style.setProperty('--trip-dialog-top',`${(viewport?.offsetTop||0)+(sheet?available-height:(available-height)/2)}px`);
    });
  }
  function revealPanel(){requestAnimationFrame(()=>{if(dialog.open&&!body.querySelector('.v51-guidance'))body.scrollTop=body.scrollHeight;});}
  syncGroups();
  new MutationObserver(()=>{syncGroups();revealPanel();}).observe(panel,{subtree:true,attributes:true,attributeFilter:['hidden']});
  new MutationObserver(revealPanel).observe($('secretaryChat'),{childList:true});
  const syncOpen=()=>{document.documentElement.classList.toggle('trip-secretary-open',dialog.open);fitDialog();if(dialog.open)revealPanel();};
  new MutationObserver(syncOpen).observe(dialog,{attributes:true,attributeFilter:['open']});
  dialog.addEventListener('close',syncOpen);
  window.addEventListener('resize',fitDialog,{passive:true});
  window.visualViewport?.addEventListener('resize',fitDialog,{passive:true});
  window.visualViewport?.addEventListener('scroll',fitDialog,{passive:true});

  const toolbar=document.createElement('section');
  toolbar.className='export-actions';
  toolbar.setAttribute('aria-label','匯出與列印');
  toolbar.innerHTML='<button class="primary-btn" id="exportPdfBtn" type="button" disabled>匯出整頁 PDF</button><button class="secondary-btn" id="printPageBtn" type="button" disabled>列印</button><p class="export-note">計算完成後可匯出完整表單、每日明細與總額，自動分頁。</p><p class="export-status" id="pdfStatus" role="status" aria-live="polite"></p><a class="export-download" id="pdfDownloadLink" hidden>PDF 已產生，點此儲存</a>';
  toolbar.dataset.v5='true';
  document.querySelector('#v5Summary').insertBefore(toolbar,document.querySelector('#v5ReportFields'));
  const exportButton=$('exportPdfBtn'),printButton=$('printPageBtn'),status=$('pdfStatus'),downloadLink=$('pdfDownloadLink');
  let busy=false,libraryPromise=null,lastUrl=null;
  const scriptBase=new URL('.',document.currentScript?.src||document.baseURI);
  function syncExport(){
    const ready=window.TripV5?.ready()||false;
    exportButton.disabled=busy||document.body.dataset.pdfBusy==='true'||!ready;printButton.disabled=exportButton.disabled;
    if(!ready&&!busy){status.textContent='';downloadLink.hidden=true;}
  }
  new MutationObserver(syncExport).observe($('results'),{attributes:true,attributeFilter:['class']});
  new MutationObserver(syncExport).observe($('calculateBtn'),{attributes:true,attributeFilter:['disabled']});
  document.addEventListener('trip:calculated',syncExport);
  document.addEventListener('trip:export-busy',syncExport);
  document.addEventListener('trip:invalidate',()=>{downloadLink.hidden=true;if(!busy)status.textContent='';syncExport();});
  syncExport();
  printButton.addEventListener('click',()=>window.print());
  function loadRenderer(){
    if(window.html2canvas)return Promise.resolve(window.html2canvas);
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL('vendor/html2canvas-1.4.1.min.js',scriptBase).href;
      const fail=()=>{clearTimeout(timer);script.remove();libraryPromise=null;reject(new Error('PDF renderer could not be loaded'));};
      const timer=setTimeout(fail,20000);
      script.onload=()=>{clearTimeout(timer);if(window.html2canvas)resolve(window.html2canvas);else fail();};
      script.onerror=fail;
      document.head.append(script);
    });
    return libraryPromise;
  }
  const exportStyles=`
    :root{--bg:#fff;--surface:#fff;--surface-solid:#fff;--text:#1d1d1f;--muted:#6e6e73;--line:#d2d2d7;--v51-field:#f5f5f7;--blue:#0066cc;}
    .v51-number-ghost,.v51-footer{display:none!important;}
    .hero-top{margin-bottom:12px!important;}.hero h1{font-size:30px!important;}.hero{margin-bottom:20px!important;}
    .summary-card{display:block!important;padding:22px!important;}.amount{font-size:38px!important;color:#1d1d1f!important;}
    .summary-place{font-size:16px!important;}.summary-trip{margin:8px 0!important;}
    .card{padding:20px!important;}.card-head{margin-bottom:16px!important;}.progress-card{margin-bottom:18px!important;}
    .form-stack{gap:16px!important;}.route-line{gap:14px!important;}.summary-card{margin-top:14px!important;}.meal-counts{margin:14px 0!important;}
    .results{margin-top:14px!important;}.day-row{padding:9px 0!important;}

    html,body{margin:0!important;padding:0!important;min-height:0!important;background:#fff!important;width:800px!important;overflow:visible!important;color-scheme:light;}
    *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
    .app-shell{width:760px!important;max-width:none!important;margin:0 20px!important;padding:16px 0!important;}
    .no-print,.summary-state,.hero-actions,.desktop-actions,.export-actions,.result-toggle,.combo-menu,.picker-trigger,.combo-toggle,.lock-hint{display:none!important;}
    .card,.summary-card,.progress-card{opacity:1!important;transform:none!important;background:#fff!important;}
    .card{border:1px solid #d2d2d7!important;}
    .hero-top{display:flex!important;}.eyebrow{justify-self:auto!important;}
    .field-grid{grid-template-columns:1fr 1fr!important;}
    .route-line{grid-template-columns:1fr!important;}.route-arrow{display:none!important;}
    .date-time{grid-template-columns:1.4fr 1fr!important;}
    .results.show{display:block!important;}
    .day-row{grid-template-columns:120px repeat(3,minmax(0,1fr))!important;}
    .meal-status{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;}
    .result-breakdown{grid-template-columns:repeat(3,1fr)!important;}
    .pdf-adjustment{font-size:12px;line-height:1.6;margin:6px 0;}.summary-trip{font-size:13px;}
    .pdf-value{min-height:44px;display:flex;align-items:center;border:1px solid #d2d2d7;border-radius:12px;padding:10px 14px;font-size:16px;color:#1d1d1f;background:#fff;overflow-wrap:anywhere;}
    .pdf-answer{flex:0 0 auto;font-size:13px;font-weight:700;color:#1d1d1f;}
    .date-chip{display:inline-block;}.pdf-meta{font-size:11px;color:#6e6e73;margin-top:12px;text-align:center;}
  `;
  async function makeSnapshot(report){
    const iframe=document.createElement('iframe');
    iframe.title='PDF 匯出暫存版面';iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;
    Object.assign(iframe.style,{position:'fixed',left:'-100000px',top:'0',width:'800px',height:'1120px',border:'0',pointerEvents:'none'});
    document.body.append(iframe);
    try{
      const doc=iframe.contentDocument;
      doc.open();doc.write('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body></body></html>');doc.close();
      Array.from(document.styleSheets).forEach(sheet=>{try{const copy=doc.createElement('style');copy.textContent=Array.from(sheet.cssRules).map(r=>r.cssText).join('\n');doc.head.append(copy);}catch{}});
      const style=doc.createElement('style');style.textContent=exportStyles;doc.head.append(style);
      const source=document.querySelector('.app-shell'),clone=source.cloneNode(true);
      clone.querySelectorAll('.no-print,.export-actions,.summary-state,.paragraph-help').forEach(node=>node.remove());
      clone.querySelectorAll('details').forEach(node=>node.open=true);
      const adjustments=clone.querySelector('#v5Advanced');
      if(adjustments){const entries=Object.entries(report.snapshot.adjustments);if(!entries.length)adjustments.remove();else{adjustments.replaceChildren();const title=doc.createElement('strong');title.textContent='逐日供餐調整';adjustments.append(title);entries.sort().forEach(([key,value])=>{const row=doc.createElement('p');row.className='pdf-adjustment';row.textContent=key.slice(0,10)+' '+({B:'早餐',L:'午餐',D:'晚餐'}[key.slice(-1)])+'：'+({hotel:'飯店供餐',expo:'展場供餐',company:'公司／他人供餐',self:'未供餐'}[value]);adjustments.append(row);});}}
      clone.querySelectorAll('input,textarea').forEach(input=>{
        const original=$(input.id);
        if(!original)return;
        const value=doc.createElement('div');
        if(input.type==='checkbox'){
          value.className='pdf-answer';value.textContent=original.checked?'有提供':'未提供';
          (input.closest('.switch')||input).replaceWith(value);
        }else{
          value.className='pdf-value';value.textContent=original.value||'—';input.replaceWith(value);
        }
      });
      clone.querySelectorAll('select,.hero-actions,.desktop-actions,.export-actions,.combo-toggle,.combo-menu,.picker-trigger,.result-toggle').forEach(node=>node.remove());
      clone.querySelectorAll('button.date-chip').forEach(button=>{const span=doc.createElement('span');span.className=button.className;span.textContent=button.textContent;button.replaceWith(span);});
      clone.querySelectorAll('.v51-expanding').forEach(n=>n.classList.remove('v51-expanding'));
      clone.querySelector('#resultDetails').hidden=false;
      clone.querySelector('#results').classList.add('show','expanded');
      const meta=doc.createElement('p');meta.className='pdf-meta';meta.textContent=`匯出時間：${new Date().toLocaleString('zh-TW',{hour12:false})}｜完整表單、每日明細與總額`;
      clone.querySelector('.hero').append(meta);
      if(report.meta.name||report.meta.department||report.meta.purpose){const info=doc.createElement('p');info.className='pdf-meta';info.textContent=[report.meta.name&&'姓名：'+report.meta.name,report.meta.department&&'部門：'+report.meta.department,report.meta.purpose&&'事由：'+report.meta.purpose].filter(Boolean).join('｜');clone.querySelector('.hero').append(info);}
      doc.body.append(clone);
      await doc.fonts.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {iframe,doc};
    }catch(error){iframe.remove();throw error;}
  }
  function planPages(doc,maxHeight){
    const regions=Array.from(doc.querySelectorAll('.hero,.progress-card,#destinationCard,#tripCard,#mealsCard,.day-row,.switch-row,.date-chip,.result-breakdown,.basis,.summary-card,.pdf-adjustment,#results')).map(node=>{
      const box=node.getBoundingClientRect();return{top:box.top,bottom:box.bottom};
    }).filter(box=>box.bottom>box.top&&box.bottom-box.top<maxHeight);
    const heading=doc.querySelector('.result-toggle-row'),firstRow=doc.querySelector('.day-row:not(.day-header)');
    if(heading&&firstRow)regions.push({top:heading.getBoundingClientRect().top,bottom:firstRow.getBoundingClientRect().bottom});
    const total=Math.ceil(Math.max(...Array.from(doc.querySelectorAll('.hero,.progress-card,#destinationCard,#tripCard,#mealsCard,.summary-card,#results')).map(n=>n.getBoundingClientRect().bottom)))+2,pages=[];
    for(let top=0;top<total;){
      let bottom=Math.min(total,top+maxHeight),previous;
      // Keep raw layout coordinates. Rounding both sides of adjacent rows creates
      // false one-pixel overlaps and can cascade into one row per PDF page.
      do{previous=bottom;for(const box of regions){if(box.top>top+1&&box.top<bottom-1&&box.bottom>bottom+1)bottom=Math.min(bottom,Math.floor(box.top));}}while(bottom!==previous);
      if(total-bottom<=8)bottom=total;
      if(bottom<=top)throw new Error('Invalid PDF page boundary');
      pages.push({top,height:bottom-top});top=bottom;
    }
    return pages;
  }
  // Minimal image-only PDF writer. Each page has a bounded JPEG and a vector page number.
  // No user strings are interpolated into PDF syntax, and no font downloads are required.
  function makePdf(images){
    if(!images.length)throw new Error('No PDF pages');
    const encoder=new TextEncoder(),parts=[],offsets=[0];let size=0;
    function append(value){const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);size+=bytes.length;}
    function object(id,content,binary){offsets[id]=size;append(`${id} 0 obj\n${content}`);if(binary){append('\nstream\n');append(binary);append('\nendstream');}append('\nendobj\n');}
    append('%PDF-1.4\n%Trip full-page export\n');
    const fontId=3+images.length*3;
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
    images.forEach((image,i)=>{
      const pageId=3+i*3,imageId=pageId+1,contentId=pageId+2;
      const width=538.583,height=width*image.height/image.width,y=841.89-28.346-height;
      object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      object(imageId,`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>`,image.bytes);
      const content=encoder.encode(`q\n${width.toFixed(3)} 0 0 ${height.toFixed(3)} 28.346 ${y.toFixed(3)} cm\n/Im0 Do\nQ\nBT /F1 9 Tf 0.4 g 282 15 Td (${i+1} / ${images.length}) Tj ET\n`);
      object(contentId,`<< /Length ${content.length} >>`,content);
    });
    object(fontId,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const xref=size;
    append(`xref\n0 ${fontId+1}\n0000000000 65535 f \n`);
    for(let id=1;id<=fontId;id++)append(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
    append(`trailer\n<< /Size ${fontId+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  exportButton.addEventListener('click',async()=>{
    if(busy||exportButton.disabled||document.body.dataset.pdfBusy==='true')return;
    const report=window.TripV5.getReport();if(!report)return;
    document.body.dataset.pdfBusy='true';document.dispatchEvent(new Event('trip:export-busy'));
    busy=true;syncExport();exportButton.setAttribute('aria-busy','true');exportButton.textContent='正在匯出…';status.classList.remove('error');status.textContent='正在準備完整頁面…';downloadLink.hidden=true;
    let snapshot;
    try{
      snapshot=await makeSnapshot(report);
      const render=await loadRenderer();
      const pages=planPages(snapshot.doc,1136),images=[];
      for(let i=0;i<pages.length;i++){
        status.textContent=`正在製作 PDF：${i+1}／${pages.length} 頁`;
        const page=pages[i];
        const canvas=await render(snapshot.doc.body,{backgroundColor:'#fff',scale:2,width:800,height:page.height,x:0,y:page.top,windowWidth:800,windowHeight:1120,scrollX:0,scrollY:0,logging:false,allowTaint:false});
        try{
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.96));
          if(!blob)throw new Error('Could not render PDF page');
          images.push({bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height});
        }finally{canvas.width=1;canvas.height=1;}
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const blob=makePdf(images);
      const place=(report.country+'・'+report.city).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,60);
      const filename=`出差伙食費_${place}_${report.arrDate}_${report.depDate}.pdf`;
      if(lastUrl){const oldUrl=lastUrl;setTimeout(()=>URL.revokeObjectURL(oldUrl),60000);}
      lastUrl=URL.createObjectURL(blob);downloadLink.href=lastUrl;downloadLink.download=filename;downloadLink.hidden=false;
      downloadLink.click();status.textContent=`PDF 已產生，共 ${pages.length} 頁。未自動下載時，請點選下方儲存連結。`;
    }catch(error){console.error('Trip PDF export failed:',error);status.classList.add('error');status.textContent='PDF 匯出失敗，請重試；也可使用「列印」另存 PDF。';}
    finally{snapshot?.iframe.remove();busy=false;document.body.dataset.pdfBusy='false';document.dispatchEvent(new Event('trip:export-busy'));exportButton.removeAttribute('aria-busy');exportButton.textContent='匯出整頁 PDF';syncExport();}
  });
})();
