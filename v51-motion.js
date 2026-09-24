/* V5.1 presentation only. Canonical amounts, rates and saved trips remain in V5. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),root=document.documentElement;
if(!window.TripV5||!$('v5Summary')||$('v51Theme'))return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),dark=matchMedia('(prefers-color-scheme: dark)');
const motions=new Set(),ease='cubic-bezier(.22,1,.36,1)';
function animate(node,frames,duration=240,done=()=>{}){
  if(reduce.matches||!node.animate){done();return null;}
  const a=node.animate(frames,{duration,easing:ease});motions.add(a);
  const finish=()=>{motions.delete(a);done();};a.onfinish=finish;a.oncancel=()=>motions.delete(a);return a;
}
function finishMotion(){[...motions].forEach(a=>{try{a.finish();}catch{a.cancel();}});}
reduce.addEventListener('change',()=>{if(reduce.matches)finishMotion();});
window.addEventListener('beforeprint',finishMotion);
const theme=document.createElement('label');theme.className='v51-theme';theme.innerHTML='<span>外觀</span><select id="v51Theme" aria-label="網站外觀"><option value="system">跟隨系統</option><option value="light">淺色</option><option value="dark">深色</option></select>';
document.querySelector('.workspace-tools>div').prepend(theme);
let preference=root.dataset.appearancePreference||'system';$('v51Theme').value=preference;
function applyTheme(){root.dataset.appearance=preference==='system'?(dark.matches?'dark':'light'):preference;root.dataset.appearancePreference=preference;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.appearance==='dark'?'#151516':'#f5f5f7');}
$('v51Theme').addEventListener('change',e=>{preference=e.target.value;try{localStorage.setItem('jasper.trip.appearance',preference);}catch{}applyTheme();});dark.addEventListener('change',()=>{if(preference==='system')applyTheme();});applyTheme();
const icons={assistant:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V2m6 2V2M9 10h6m-6 4h6m-6 4h3"/></svg>',calendar:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/></svg>',clock:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>'};
$('rulesBtn').textContent='規則與費率';
document.querySelectorAll('[data-date-target]').forEach(b=>b.innerHTML=icons.calendar);
document.querySelectorAll('[data-time-target]').forEach(b=>b.innerHTML=icons.clock);
const footer=document.createElement('p');footer.className='v51-footer no-print';footer.textContent='Jasper Travel · 在此裝置完成試算與匯出';document.querySelector('.app-shell').append(footer);

const dialog=$('secretaryDialog');

// Native dialogs retain focus trapping, Escape and backdrop dismissal.
document.querySelectorAll('dialog').forEach(node=>{
  if(node===dialog)return;
  const nativeClose=node.close.bind(node),nativeOpen=node.showModal.bind(node);let closing=null;
  node.close=function(value){
    if(!node.open||reduce.matches){nativeClose(value);return;}
    if(closing)return;
    node.classList.add('v51-closing');const sheet=node===dialog&&matchMedia('(max-width:640px)').matches;
    closing=animate(node,[{opacity:1,transform:'none'},{opacity:0,transform:sheet?'translateY(48px)':'translateY(10px) scale(.99)'}],160,()=>{closing=null;node.classList.remove('v51-closing');nativeClose(value);});
  };
  node.showModal=function(){if(closing){closing.cancel();closing=null;node.classList.remove('v51-closing');}if(!node.open)nativeOpen();};
  node.addEventListener('cancel',e=>{e.preventDefault();node.close();});
});
const syncDialogs=()=>root.classList.toggle('v51-dialog-open',!!document.querySelector('dialog[open]'));
const dialogObserver=new MutationObserver(syncDialogs);document.querySelectorAll('dialog').forEach(d=>dialogObserver.observe(d,{attributes:true,attributeFilter:['open']}));syncDialogs();

// Height animations preserve the final native details state and support rapid reversal.
const accordionState=new WeakMap();
function toggleDetails(node){
  const previous=accordionState.get(node),opening=previous?!previous.opening:!node.open;
  const from=node.getBoundingClientRect().height;if(previous)previous.animation?.cancel();
  if(reduce.matches){node.open=opening;node.classList.remove('v51-expanding');accordionState.delete(node);return;}
  node.open=true;const full=node.getBoundingClientRect().height;node.open=false;const collapsed=node.getBoundingClientRect().height;node.open=true;
  node.classList.add('v51-expanding');
  const record={opening,animation:null};accordionState.set(node,record);
  record.animation=animate(node,[{height:from+'px'},{height:(opening?full:collapsed)+'px'}],260,()=>{node.open=opening;node.classList.remove('v51-expanding');accordionState.delete(node);});
}
document.querySelectorAll('details').forEach(node=>{if(node.closest('#secretaryDialog'))return;node.querySelector(':scope>summary')?.addEventListener('click',e=>{e.preventDefault();toggleDetails(node);});});
let resultMotion=null;
function toggleResult(e){
  if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
  e.preventDefault();e.stopImmediatePropagation();const content=$('resultDetails'),toggle=$('resultToggle'),opening=toggle.getAttribute('aria-expanded')!=='true';
  resultMotion?.cancel();resultMotion=null;toggle.setAttribute('aria-expanded',String(opening));$('resultToggleLabel').textContent=opening?'收合':'展開';$('results').classList.toggle('expanded',opening);
  if(reduce.matches){content.hidden=!opening;content.classList.remove('v51-expanding');return;}
  const from=content.hidden?0:content.getBoundingClientRect().height;content.hidden=false;const full=content.getBoundingClientRect().height;content.classList.add('v51-expanding');
  resultMotion=animate(content,[{height:from+'px',opacity:opening?.3:1},{height:(opening?full:0)+'px',opacity:opening?1:0}],260,()=>{content.hidden=!opening;content.classList.remove('v51-expanding');resultMotion=null;});
}
$('resultToggle').addEventListener('click',toggleResult,true);$('resultToggle').addEventListener('keydown',toggleResult,true);

// Crossfade real totals rather than displaying invented intermediate monetary values.
const summary=$('v5Summary'),amount=$('totalAmount');let previousAmount='';
amount.setAttribute('role','status');amount.setAttribute('aria-live','polite');amount.setAttribute('aria-atomic','true');
function syncResult(){summary.dataset.result=window.TripV5.ready()?'ready':$('results').classList.contains('pending')?'pending':'empty';}
document.addEventListener('trip:calculated',()=>{
  syncResult();document.querySelectorAll('.v51-number-ghost').forEach(n=>n.remove());
  const current=amount.textContent;
  if(previousAmount&&current!==previousAmount&&!reduce.matches){
    const g=document.createElement('span');g.className='v51-number-ghost no-print';g.setAttribute('aria-hidden','true');g.textContent=previousAmount;
    Object.assign(g.style,{left:amount.offsetLeft+'px',top:amount.offsetTop+'px',width:amount.offsetWidth+'px'});summary.append(g);
    animate(g,[{opacity:.75,transform:'none'},{opacity:0,transform:'translateY(-8px)'}],220,()=>g.remove());
    animate(amount,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],260);
  }
  previousAmount=current;syncMobile();
});
document.addEventListener('trip:invalidate',()=>{finishMotion();document.querySelectorAll('.v51-number-ghost').forEach(n=>n.remove());syncResult();syncMobile();if(!window.TripV5.ready()&&!$('results').classList.contains('pending'))previousAmount='';});
syncResult();
const mobilePDF=document.createElement('button');mobilePDF.type='button';mobilePDF.id='v51MobilePdf';mobilePDF.className='primary-btn';mobilePDF.textContent='匯出 PDF';mobilePDF.hidden=true;document.querySelector('.mobile-action-inner').append(mobilePDF);
mobilePDF.addEventListener('click',()=>{if(!mobilePDF.disabled)$('v5ReportPdfBtn').click();});
function syncMobile(){const ready=window.TripV5.ready(),busy=document.body.dataset.pdfBusy==='true';mobilePDF.hidden=!ready;mobilePDF.disabled=!ready||busy;mobilePDF.textContent=busy?'製作中…':'匯出 PDF';$('mobileCalculateBtn').hidden=ready;}
const busyBar=document.createElement('div');busyBar.className='v51-progress no-print';busyBar.hidden=true;busyBar.setAttribute('aria-hidden','true');document.querySelector('.export-actions').append(busyBar);
document.addEventListener('trip:export-busy',()=>{const busy=document.body.dataset.pdfBusy==='true';if(busy)finishMotion();busyBar.hidden=!busy;document.querySelector('.export-actions').setAttribute('aria-busy',String(busy));syncMobile();});
new MutationObserver(syncMobile).observe($('calculateBtn'),{attributes:true,attributeFilter:['disabled']});syncMobile();
})();
