/* V5.1 visual-only enhancements. No fee or calculation logic. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function installDock(){
 if($('v51ResultDock'))return;
 const dock=document.createElement('aside');dock.id='v51ResultDock';dock.className='mobile-result-dock no-print';dock.setAttribute('aria-label','試算結果快捷列');
 dock.innerHTML='<div><span>本次出差津貼</span><strong id="v51DockTotal">—</strong></div><button type="button" class="compact-primary" id="v51DockExport">匯出 PDF</button>';
 document.body.append(dock);
 const total=$('totalAmount'),results=$('results');
 const sync=()=>{const visible=results?.classList.contains('show')&&total?.textContent&&total.textContent!=='—';dock.classList.toggle('is-visible',!!visible);$('v51DockTotal').textContent=visible?total.textContent:'—';};
 if(total)new MutationObserver(sync).observe(total,{childList:true,subtree:true,characterData:true});
 if(results)new MutationObserver(sync).observe(results,{attributes:true,attributeFilter:['class']});sync();
 $('v51DockExport').addEventListener('click',()=>{const b=$('v5ReportPdfBtn')||$('exportPdfBtn');if(b&&!b.disabled)b.click();else document.querySelector('.summary-card')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});});
}
function polishDialog(){
 const d=$('secretaryDialog');if(!d)return;
 d.addEventListener('close',()=>document.documentElement.classList.remove('v51-dialog-open'));
 new MutationObserver(()=>document.documentElement.classList.toggle('v51-dialog-open',d.open)).observe(d,{attributes:true,attributeFilter:['open']});
}
function themeMeta(){
 const meta=document.querySelector('meta[name="theme-color"]');if(!meta)return;
 const q=matchMedia('(prefers-color-scheme: dark)');const sync=()=>meta.content=q.matches?'#000000':'#f5f5f7';sync();q.addEventListener?.('change',sync);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installDock();polishDialog();themeMeta();},{once:true});else{installDock();polishDialog();themeMeta();}
})();