/* V5 experience layer. State stays in this browser; no account or network API. */
window.installTripV5=function(C){
'use strict';
const E=window.TripEngine,$=id=>document.getElementById(id),el=C.el,S=C.secretaryEl;
const DRAFT='jasper.trip.v5.draft',HISTORY='jasper.trip.v5.history';
const state={auto:false,result:null,adjustments:{},meta:{name:'',department:'',purpose:''},needReview:false,lastDates:'',detailsExpanded:false,historyId:null,saveTimer:0,calcTimer:0,applying:false,ready:false,pending:null,edit:null,backup:null,secretaryNeedsSync:false,storageOK:true};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clone=o=>JSON.parse(JSON.stringify(o));
const money=(n,c)=>new Intl.NumberFormat('zh-TW',{style:'currency',currency:c,minimumFractionDigits:c==='TWD'?0:2,maximumFractionDigits:c==='TWD'?0:2}).format(n);
function readStorage(key){try{const value=localStorage.getItem(key);return value?JSON.parse(value):null;}catch(error){state.storageOK=false;return null;}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));state.storageOK=true;return true;}catch(error){state.storageOK=false;return false;}}
function removeStorage(key){try{localStorage.removeItem(key);return true;}catch(error){state.storageOK=false;return false;}}
function main(){return E.normalise({...C.readMain(),adjustments:state.adjustments,meta:state.meta,mealsNeedReview:state.needReview,calculated:state.auto},C.rates);}
function meaningful(s){return Boolean(s&&(s.country||s.countryText||s.cityText||s.arrDate||s.arrTime||s.depDate||s.depTime||s.meta.name||s.meta.department||s.meta.purpose));}
function secretaryPack(){
  const d=C.draft;if(!d)return null;
  return{draft:{...d,arrival:d.arrival?{dateValue:d.arrival.dateValue,timeValue:d.arrival.timeValue,assumedYear:!!d.arrival.assumedYear}:null,departure:d.departure?{dateValue:d.departure.dateValue,timeValue:d.departure.timeValue,assumedYear:!!d.departure.assumedYear}:null,lunchDates:[...d.lunchDates]},step:C.step,input:S.input.value,edit:state.edit,backup:state.backup,needsSync:state.secretaryNeedsSync};
}
function dateTimeRestore(p){if(!p||!E.dateParts(p.dateValue)||E.minute(p.timeValue)===null)return null;const result=C.parseTime(p.dateValue+' '+p.timeValue);return result.error?null:{...result,assumedYear:!!p.assumedYear};}
function secretaryUnpack(p){
  if(!p?.draft)return false;
  const d=p.draft,s=E.normalise({country:d.countryKey,city:d.cityKey,cityDisplay:d.cityDisplay,arrDate:d.arrival?.dateValue,arrTime:d.arrival?.timeValue,depDate:d.departure?.dateValue,depTime:d.departure?.timeValue,breakfast:d.breakfast,lunch:d.lunch,lunchDates:d.lunchDates,adjustments:d.adjustments},C.rates);
  if(!s)return false;
  C.draft={...C.newDraft(),countryKey:s.country||null,cityKey:s.city||null,cityDisplay:s.cityDisplay||null,usesOtherRate:s.city==='other',arrival:dateTimeRestore(d.arrival),departure:dateTimeRestore(d.departure),breakfast:s.breakfast,lunch:s.lunch,lunchDates:new Set(s.lunchDates),adjustments:s.adjustments,mealConfirmed:d.mealConfirmed===true,notes:Array.isArray(d.notes)?d.notes.filter(v=>typeof v==='string').map(v=>v.slice(0,200)).slice(0,8):[]};
  if(C.draft.arrival&&C.draft.departure&&!E.keys(C.draft.arrival.dateValue,C.draft.departure.dateValue).length)C.draft.departure=null;
  C.step=['destination','city','arrival','departure','meals','review'].includes(p.step)?p.step:'destination';
  if(!C.draft.countryKey)C.step='destination';else if(!C.draft.cityKey)C.step='city';else if(!C.draft.arrival&&C.step!=='destination'&&C.step!=='city')C.step='arrival';else if(!C.draft.departure&&['meals','review'].includes(C.step))C.step='departure';
  S.input.value=typeof p.input==='string'?p.input.slice(0,2000):'';
  state.edit=null;state.backup=null;state.secretaryNeedsSync=!!p.needsSync;
  C.messages=[{role:'assistant',text:'已接續暫存內容；已填資料保留，可繼續或逐項修改。'}];return true;
}
function save(){
  clearTimeout(state.saveTimer);if(!state.ready||state.applying||state.pending)return;
  const s=main(),secretary=secretaryPack();
  if(!meaningful(s)&&!secretary?.draft?.countryKey&&!secretary?.input){removeStorage(DRAFT);storageStatus();return;}
  writeStorage(DRAFT,{version:5,updatedAt:new Date().toISOString(),main:s,secretary,historyId:state.historyId});storageStatus();
}
function scheduleSave(){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(save,350);}
function storageStatus(){const n=$('v5SaveStatus');if(n)n.textContent=state.storageOK?'內容僅暫存於此瀏覽器；清除網站資料可能遺失。':'此瀏覽器無法暫存；仍可試算與匯出，請勿關閉未匯出的內容。';}
function validHistory(){const h=readStorage(HISTORY);return Array.isArray(h)?h.filter(r=>r?.version===5&&typeof r.id==='string'&&r.id.length<100&&E.normalise(r.snapshot,C.rates)).slice(0,20):[];}
function remember(result){
  if(state.pending||state.applying)return;
  const id=state.historyId||uid();state.historyId=id;
  const entry={version:5,id,updatedAt:new Date().toISOString(),snapshot:main(),display:{place:result.country+'・'+result.city,total:money(result.total,result.currency)}};
  const list=validHistory().filter(h=>h.id!==id);list.unshift(entry);writeStorage(HISTORY,list.slice(0,20));scheduleSave();storageStatus();
}

// Summary first, followed by collapsed detail; auxiliary tasks remain collapsed.
const summary=document.querySelector('.summary-card');el.results.before(summary);summary.id='v5Summary';
summary.insertAdjacentHTML('beforeend','<p class="summary-trip" id="v5SummaryTrip"></p><p class="summary-state" id="v5SummaryState" role="status"></p><details class="report-fields no-print" id="v5ReportFields"><summary>報帳資料（選填）</summary><div class="field-grid"><label class="field">姓名<input id="v5Name" type="text" maxlength="80" autocomplete="name"></label><label class="field">部門<input id="v5Department" type="text" maxlength="80" autocomplete="organization-title"></label><label class="field full">出差事由<textarea id="v5Purpose" maxlength="400" rows="2" placeholder="例如：參展／客戶拜訪"></textarea></label></div></details>');
const tools=document.createElement('div');tools.className='workspace-tools no-print';tools.innerHTML='<p id="v5SaveStatus" role="status"></p><div><button type="button" class="text-btn" id="v5HistoryBtn">最近行程</button><button type="button" class="text-btn" id="v5NewBtn">新行程</button></div>';
document.querySelector('.hero').after(tools);
const resume=document.createElement('section');resume.id='v5Resume';resume.className='resume-banner no-print';resume.hidden=true;resume.innerHTML='<div><strong>還有上次保留的內容</strong><p id="v5ResumeText"></p></div><div class="inline-actions"><button type="button" class="compact-primary" id="v5ResumeBtn">繼續上次填寫</button><button type="button" class="text-btn" id="v5DiscardBtn">開始新行程</button></div>';tools.after(resume);
const ack=document.createElement('div');ack.id='v5MealAck';ack.className='meal-alert';ack.hidden=true;ack.innerHTML='<p id="v5MealAckText">日期已變更，範圍外的供餐已移除；請重新確認以下設定。</p><button class="compact-primary" type="button" id="v5AckBtn">供餐日期已確認</button>';el.mealFields.prepend(ack);
const advanced=document.createElement('details');advanced.id='v5Advanced';advanced.className='advanced-meals';advanced.innerHTML='<summary>逐日調整供餐 <span id="v5AdjustmentCount"></span></summary><p class="field-help">僅調整實際供餐；不會突破抵達、離開時段的可核給限制。「未供餐」仍依時段判斷。</p><div id="v5DayAdjust"></div><button type="button" class="text-btn no-print" id="v5ClearAdjust">清除逐日調整</button>';el.mealFields.append(advanced);
const secretAdvanced=document.createElement('details');secretAdvanced.className='advanced-meals';secretAdvanced.id='v5SecretAdvanced';secretAdvanced.innerHTML='<summary>逐日調整供餐</summary><p class="field-help">部分日期含早餐或已提供晚餐，可在這裡調整；不會增加時段外餐費。</p><div id="v5SecretDayAdjust"></div>';S.meals.insertBefore(secretAdvanced,S.mealHint);
S.form.insertAdjacentHTML('beforeend','<p class="paragraph-help">可一次輸入：胡志明市，2026/10/14 09:40 抵達，10/17 17:30 離開，飯店有早餐，15、16 日展場有午餐。</p>');
S.review.insertAdjacentHTML('afterbegin','<p class="meal-alert" id="v5SecretNotes" hidden></p>');

function bulkUI(parent,prefix,apply,readDates){
  const wrap=document.createElement('div');wrap.className='bulk-dates no-print';wrap.innerHTML=`<div class="inline-actions"><button type="button" class="text-btn" data-mode="all">全選</button><button type="button" class="text-btn" data-mode="none">清除</button></div><div class="date-range"><label>從<input type="date" id="${prefix}From" aria-label="供餐起始日期"></label><label>到<input type="date" id="${prefix}To" aria-label="供餐結束日期"></label><button class="text-btn" type="button" data-mode="range">套用區間</button></div><p class="range-hint field-help" role="status"></p>`;parent.prepend(wrap);
  wrap.addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(!b)return;const dates=readDates();let selected=dates;const hint=wrap.querySelector('.range-hint');hint.textContent='';if(!dates.length){hint.textContent='請先完成日期。';return;}if(b.dataset.mode==='none')selected=[];if(b.dataset.mode==='range'){const a=$(prefix+'From').value,z=$(prefix+'To').value;if(!dates.includes(a)||!dates.includes(z)||z<a){hint.textContent='請選擇行程內有效的日期區間。';return;}selected=dates.filter(d=>d>=a&&d<=z);}apply(selected);});
  return wrap;
}
const mainBulk=bulkUI(el.expoPicker,'v5Expo',d=>{C.expo=new Set(d);C.renderExpo();clearResult();updateState();},()=>E.keys(el.arrDate.value,el.depDate.value));
const secretBulk=bulkUI(S.lunchWrap,'v5SecretExpo',d=>{C.draft.lunchDates=new Set(d);C.renderSecretLunch();scheduleSave();},()=>E.keys(C.draft?.arrival?.dateValue,C.draft?.departure?.dateValue));
function bounds(wrap,dates){wrap.querySelectorAll('input[type="date"]').forEach(i=>{i.min=dates[0]||'';i.max=dates.at(-1)||'';if(i.value&&!dates.includes(i.value))i.value='';});}
function draftSnapshot(){const d=C.draft;return E.normalise({country:d?.countryKey,city:d?.cityKey,cityDisplay:d?.cityDisplay,arrDate:d?.arrival?.dateValue,arrTime:d?.arrival?.timeValue,depDate:d?.departure?.dateValue,depTime:d?.departure?.timeValue,breakfast:d?.breakfast,lunch:d?.lunch,lunchDates:[...(d?.lunchDates||[])],adjustments:d?.adjustments||{}},C.rates);}
function renderAdjust(target,s){
  if(!target)return;const dates=E.keys(s.arrDate,s.depDate);const signature=JSON.stringify([dates,s.country,s.city,s.arrTime,s.depTime,s.adjustments]);if(target.dataset.signature===signature)return;target.dataset.signature=signature;
  if(!dates.length){target.innerHTML='<p class="field-help">完成日期後顯示逐日供餐。</p>';return;}
  let result;try{result=E.calculate({...s,lunch:false,mealsNeedReview:false},C.rates);}catch{}
  target.innerHTML='<div class="adjust-grid adjust-heading"><span>日期</span><span>早餐</span><span>午餐</span><span>晚餐</span></div>'+dates.map(date=>{
    const row=result?.rows.find(r=>r.date===date);
    return `<div class="adjust-grid"><span>${esc(date.slice(5).replace('-','/'))}</span>`+['B','L','D'].map((m,i)=>{
      const key=date+'|'+m,eligible=row?.cells[i].eligible??true,value=s.adjustments[key]||'';
      return `<label class="sr-only" for="${target.id}-${key}">${esc(date)}${['早餐','午餐','晚餐'][i]}</label><select id="${target.id}-${key}" data-adjust="${key}" aria-label="${date} ${['早餐','午餐','晚餐'][i]}" ${eligible?'':'disabled'}>${[['',eligible?'依一般設定':'時段不核給'],['hotel','飯店供餐'],['expo','展場供餐'],['company','公司／他人供餐'],['self','未供餐']].map(([v,t])=>`<option value="${v}" ${value===v?'selected':''}>${t}</option>`).join('')}</select>`;
    }).join('')+'</div>';
  }).join('');
}
$('v5DayAdjust').addEventListener('change',e=>{if(!e.target.dataset.adjust)return;const key=e.target.dataset.adjust;if(e.target.value)state.adjustments[key]=e.target.value;else delete state.adjustments[key];clearResult();updateState();});
$('v5SecretDayAdjust').addEventListener('change',e=>{if(!e.target.dataset.adjust)return;C.draft.adjustments=C.draft.adjustments||{};const key=e.target.dataset.adjust;if(e.target.value)C.draft.adjustments[key]=e.target.value;else delete C.draft.adjustments[key];scheduleSave();});
$('v5ClearAdjust').addEventListener('click',()=>{if(Object.keys(state.adjustments).length&&confirm('清除全部逐日調整？一般飯店早餐與展場午餐設定會保留。')){state.adjustments={};clearResult();updateState();}});
$('v5AckBtn').addEventListener('click',()=>{state.needReview=false;state.lastDates=el.arrDate.value+'|'+el.depDate.value;clearResult();updateState();});
function checkDateChange(){
  const s=main(),dates=E.keys(s.arrDate,s.depDate);if(!dates.length)return;
  const pair=s.arrDate+'|'+s.depDate;
  if(state.lastDates&&pair!==state.lastDates){
    if(s.breakfast||s.lunch||Object.keys(state.adjustments).length)state.needReview=true;
    C.expo=new Set([...C.expo].filter(d=>dates.includes(d)));
    state.adjustments=Object.fromEntries(Object.entries(state.adjustments).filter(([k])=>dates.includes(k.slice(0,10))));
  }
  state.lastDates=pair;
}
function updateState(){
  C.baseUpdate();checkDateChange();
  const s=main(),check=E.validate(s,C.rates),dates=E.keys(s.arrDate,s.depDate);
  el.calculateBtn.disabled=!check.valid;el.mobileCalculateBtn.disabled=!check.valid;
  if(!check.valid&&s.country&&s.city){el.buttonHint.textContent=check.message;el.mobileActionHint.textContent=check.message;}
  ack.hidden=!state.needReview;bounds(mainBulk,dates);renderAdjust($('v5DayAdjust'),s);
  $('v5AdjustmentCount').textContent=Object.keys(state.adjustments).length?`（${Object.keys(state.adjustments).length} 餐已調整）`:'';
  $('v5SummaryState').textContent=state.auto?(check.valid?(state.result?'已自動更新；修改資料會重新試算。':'正在更新試算…'):check.message+'；舊金額已隱藏。'):'';
  if(state.result&&check.valid){C.setProgress(4,true);el.mobileActionTitle.textContent=money(state.result.total,state.result.currency);el.mobileActionHint.textContent='已計算；修改後自動更新';}scheduleSave();
}
function clearResult(){
  clearTimeout(state.calcTimer);if(state.result)state.detailsExpanded=el.resultToggle.getAttribute('aria-expanded')==='true';
  const preserve=state.auto&&(state.result||el.results.classList.contains('pending'))&&E.validate(main(),C.rates).valid;
  if(preserve){el.results.classList.add('pending');el.results.setAttribute('aria-busy','true');el.resultDetails.setAttribute('aria-hidden','true');el.totalAmount.textContent='—';}
  else{el.results.classList.remove('pending');el.results.removeAttribute('aria-busy');el.resultDetails.removeAttribute('aria-hidden');C.baseClear();$('v5SummaryTrip').textContent='';}
  state.result=null;
  document.dispatchEvent(new Event('trip:invalidate'));
  if(state.auto&&!state.applying){state.calcTimer=setTimeout(()=>{if(E.validate(main(),C.rates).valid)compute({silent:true});else updateState();},280);}
}
function compute(options){
  const silent=options?.silent===true,s=main(),check=E.validate(s,C.rates);clearTimeout(state.calcTimer);
  if(!check.valid){clearResult();updateState();if(!silent)C.toast(check.message);return null;}
  const expanded=state.detailsExpanded||el.resultToggle.getAttribute('aria-expanded')==='true',result=E.calculate(s,C.rates);state.result=result;state.auto=true;
  el.dayList.innerHTML='<div class="day-row day-header"><span>日期</span><span>早餐</span><span>午餐</span><span>晚餐</span></div>'+result.rows.map(r=>`<div class="day-row"><span class="day-date">${esc(r.date)}</span>${r.cells.map(c=>`<span class="meal-status${c.included?' included':''}" title="${esc(c.reason)}">${c.included?esc(money(c.amount,result.currency)):esc(c.reason)}</span>`).join('')}</div>`).join('');
  el.breakdown.innerHTML=['B','L','D'].map((m,i)=>`<div class="breakdown-item"><span>${['早餐','午餐','晚餐'][i]}・${esc(money(result.rate[m],result.currency))} × ${result.counts[m]}</span><strong>${esc(money(result.subtotals[m],result.currency))}</strong></div>`).join('');
  el.basis.innerHTML='<strong>判斷依據</strong><br>'+esc(`抵達 ${s.arrTime}：${C.arrivalRule(check.am<540?0:check.am<780?1:check.am<1260?2:3)}。`)+ '<br>'+esc(`離開 ${s.depTime}：${C.departureRule(check.bm<300?-1:check.bm<720?0:check.bm<1140?1:2)}。`)+'<br>已供餐不重複核給；逐日調整不會增加時段外的餐費。';
  el.totalAmount.textContent=money(result.total,result.currency);el.summaryPlace.textContent=(result.other?'⚠ ':'')+result.country+'・'+result.city+(result.other?'（其他地區費率）':'');el.summaryPlace.classList.toggle('warning',result.other);
  el.emptySummary.hidden=true;el.mealCounts.hidden=false;el.countB.textContent=result.counts.B;el.countL.textContent=result.counts.L;el.countD.textContent=result.counts.D;el.results.classList.add('show');
  el.results.classList.remove('pending');el.results.removeAttribute('aria-busy');el.resultDetails.removeAttribute('aria-hidden');
  const open=silent&&expanded;el.resultDetails.hidden=!open;el.results.classList.toggle('expanded',open);el.resultToggle.setAttribute('aria-expanded',String(open));el.resultToggleLabel.textContent=open?'收合':'展開';
  $('v5SummaryTrip').textContent=`${s.arrDate} ${s.arrTime} 抵達 → ${s.depDate} ${s.depTime} 離開｜當地時間`;
  updateState();remember(result);document.dispatchEvent(new CustomEvent('trip:calculated'));
  if(!silent){summary.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});C.toast(state.storageOK?'計算完成，已保留在最近行程':'計算完成；此瀏覽器無法保留，請匯出');}save();return result;
}
function applyMain(s,calculate=false){
  state.applying=true;state.adjustments={...s.adjustments};state.meta={...s.meta};state.needReview=!!s.mealsNeedReview;state.lastDates=s.arrDate+'|'+s.depDate;state.auto=!!s.calculated;
  C.writeMain(s);['name','department','purpose'].forEach(k=>$('v5'+k[0].toUpperCase()+k.slice(1)).value=state.meta[k]);
  clearResult();state.applying=false;updateState();if(calculate&&E.validate(main(),C.rates).valid)compute({silent:true});
}
function resetMain(force=false){
  if(!force&&(meaningful(main())||C.draft?.countryKey||state.pending)&&!confirm('開始新行程並清除目前草稿？已儲存的最近行程不會刪除。'))return;
  state.pending=null;resume.hidden=true;document.querySelector('.form-stack').inert=false;$('secretaryBtn').disabled=false;
  state.auto=false;state.detailsExpanded=false;state.historyId=null;state.adjustments={};state.needReview=false;state.lastDates='';C.draft=null;C.messages=[];S.input.value='';state.edit=null;state.backup=null;state.secretaryNeedsSync=false;
  applyMain(E.normalise({},C.rates));removeStorage(DRAFT);save();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
$('v5NewBtn').addEventListener('click',()=>resetMain());
['name','department','purpose'].forEach(k=>$('v5'+k[0].toUpperCase()+k.slice(1)).addEventListener('input',e=>{state.meta[k]=e.target.value;if(state.result)state.result.meta={...state.meta};document.dispatchEvent(new Event('trip:invalidate'));scheduleSave();}));

function draftFromMain(){
  const s=main();C.draft={...C.newDraft(),countryKey:s.country||null,cityKey:s.city||null,cityDisplay:s.cityDisplay||null,usesOtherRate:s.city==='other',arrival:dateTimeRestore({dateValue:s.arrDate,timeValue:s.arrTime}),departure:dateTimeRestore({dateValue:s.depDate,timeValue:s.depTime}),breakfast:s.breakfast,lunch:s.lunch,lunchDates:new Set(s.lunchDates),adjustments:{...s.adjustments},mealConfirmed:!s.mealsNeedReview,notes:[]};C.messages=[{role:'assistant',text:'已帶入主表單內容。可直接確認，或點選要修改的項目。'}];nextStep();state.secretaryNeedsSync=false;
}
function newSecretary(){C.draft={...C.newDraft(),adjustments:{},mealConfirmed:false,notes:[]};C.messages=[];C.step='destination';state.edit=null;state.backup=null;S.input.value='';}
function openSecretary(){
  if(state.pending)return;
  if(C.draft&&state.secretaryNeedsSync){if(confirm('主表單已有變更，是否帶入主表單取代秘書模式草稿？按取消會保留秘書草稿。'))draftFromMain();else state.secretaryNeedsSync=false;}
  if(!C.draft){if(meaningful(main()))draftFromMain();else newSecretary();}
  S.dialog.showModal();renderStep();
}
function restartSecretary(){if((C.draft?.countryKey||S.input.value)&&!confirm('清除秘書模式草稿並重新開始？主表單與最近行程會保留。'))return;newSecretary();renderStep();save();}
function nextStep(){const d=C.draft;C.step=!d.countryKey?'destination':!d.cityKey?'city':!d.arrival?'arrival':!d.departure?'departure':!d.mealConfirmed?'meals':'review';}
function message(role,text){C.messages.push({role,text});C.messages=C.messages.slice(-24);}
function renderReview(){
  const d=C.draft,s=draftSnapshot(),place=(C.rates[s.country]?.label||'')+'・'+(d.cityDisplay||C.rates[s.country]?.cities[s.city]?.label||'');
  const rows=[['目的地',place+(d.usesOtherRate?'（其他費率）':''),'destination'],['抵達',d.arrival?d.arrival.dateValue+' '+d.arrival.timeValue:'未填','arrival'],['離開',d.departure?d.departure.dateValue+' '+d.departure.timeValue:'未填','departure'],['供餐',`飯店早餐：${d.breakfast?'有':'無'}；展場午餐：${d.lunch?[...d.lunchDates].sort().join('、'):'無'}；逐日調整 ${Object.keys(d.adjustments||{}).length} 餐`,'meals']];
  S.reviewGrid.innerHTML=rows.map(([name,value,key])=>`<div class="review-row"><span>${name}</span><strong>${esc(value)}</strong><button class="text-btn" type="button" data-edit="${key}" aria-label="修改${name}">修改</button></div>`).join('');
  const notes=[...new Set(d.notes||[])];if(d.arrival?.assumedYear||d.departure?.assumedYear)notes.push('未明示的年份已暫列，請核對後再確認。');$('v5SecretNotes').hidden=!notes.length;$('v5SecretNotes').textContent=notes.join(' ');
}
function renderStep(){
  const d=C.draft;if(!d)return;
  const text=['destination','city','arrival','departure'].includes(C.step);
  S.form.hidden=!text;S.meals.hidden=C.step!=='meals';S.review.hidden=C.step!=='review';
  const names={destination:'目的地',city:'城市',arrival:'抵達',departure:'離開',meals:'供餐',review:'確認'};
  S.step.textContent=state.edit?'修改'+names[C.step]:'第 '+({destination:1,city:1,arrival:2,departure:3,meals:4,review:5}[C.step])+'／5 步・'+names[C.step];
  S.inputLabel.textContent={destination:'國家、城市或整段行程',city:'城市／地區',arrival:'抵達日期與時間',departure:'離開日期與時間'}[C.step]||'';
  S.input.placeholder=text?(C.step==='destination'?'例如：東京，2026/10/14 09:40 抵達，10/17 17:30 離開':C.step==='city'?'例如：東京':'例如：2026/10/14 09:40'):'';
  const hints={destination:'可以一次貼上整段行程；只會追問缺少的資訊。',city:'請輸入這次出差的城市。',arrival:'請使用當地時間；未填年份會暫列今年，確認頁會提醒。',departure:'跨年請寫明年份，離開時間須晚於抵達時間。'};
  if(text){S.hint.textContent=hints[C.step];S.hint.classList.remove('error');}
  [S.back,S.mealBack,S.reviewBack].forEach(b=>{b.disabled=C.step==='destination'&&!state.edit;});
  S.back.textContent=state.edit?'取消修改':'上一步';S.mealBack.textContent=state.edit?'取消修改':'上一步';
  if(C.step==='meals'){S.breakfast.checked=d.breakfast;S.lunch.checked=d.lunch;C.renderSecretLunch();bounds(secretBulk,E.keys(d.arrival?.dateValue,d.departure?.dateValue));renderAdjust($('v5SecretDayAdjust'),draftSnapshot());S.mealHint.textContent='請確認實際供餐；未提及的供餐不會被當成已確認。';S.mealNext.textContent=state.edit?'儲存修改':'確認餐食';}
  if(C.step==='review')renderReview();
  if(!C.messages.length)message('assistant','請提供目的地，也可以一次貼上完整行程。');
  document.dispatchEvent(new CustomEvent('trip:secretary-step',{detail:{step:C.step,editing:!!state.edit,place:d.cityDisplay||C.rates[d.countryKey]?.cities[d.cityKey]?.label||C.rates[d.countryKey]?.label||'',arrival:d.arrival,departure:d.departure,mealsConfirmed:d.mealConfirmed===true}}));
  C.renderMessages();scheduleSave();requestAnimationFrame(()=>{if(text)S.input.focus({preventScroll:true});else if(C.step==='review')$('secretaryConfirmBtn').focus({preventScroll:true});});
}
function startEdit(key){state.backup=secretaryPack();state.edit=key;C.step=key;if(key==='arrival'||key==='departure'){const p=C.draft[key];S.input.value=p?p.dateValue+' '+p.timeValue:'';}else if(key==='destination')S.input.value=(C.rates[C.draft.countryKey]?.label||'')+(C.draft.cityDisplay||'');renderStep();}
S.reviewGrid.addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b)startEdit(b.dataset.edit);});
function pruneDraftDates(oldPair){
  const d=C.draft,dates=E.keys(d.arrival?.dateValue,d.departure?.dateValue),pair=d.arrival?.dateValue+'|'+d.departure?.dateValue;
  if(oldPair!==pair&&dates.length){d.lunchDates=new Set([...d.lunchDates].filter(k=>dates.includes(k)));d.adjustments=Object.fromEntries(Object.entries(d.adjustments||{}).filter(([k])=>dates.includes(k.slice(0,10))));if(d.breakfast||d.lunch||Object.keys(d.adjustments).length){d.mealConfirmed=false;d.notes.push('日期已更改，請重新確認供餐日期。');}}
}
function submit(answer){
  const d=C.draft,oldPair=d.arrival?.dateValue+'|'+d.departure?.dateValue;let parsed;
  if(C.step==='destination'&&!state.edit){
    parsed=E.parseParagraph(answer,C.parseDestination,C.parseTime);
    if(parsed?.error){C.hint(parsed.error,true);return;}
    if(parsed){
      Object.assign(d,{countryKey:parsed.place.countryKey,cityKey:parsed.place.cityKey,cityDisplay:parsed.place.cityDisplay,usesOtherRate:!!parsed.place.usesOtherRate,arrival:parsed.arrival||null,departure:parsed.departure||null,breakfast:parsed.breakfast,lunch:parsed.lunch,lunchDates:new Set(parsed.lunchDates),mealConfirmed:parsed.breakfastKnown&&parsed.lunchKnown,notes:parsed.notes});
      if(parsed.notes.some(n=>n.includes('晚餐')))d.mealConfirmed=false;
      message('user',answer);message('assistant','已整理行程。'+(d.mealConfirmed?'請核對摘要。':'接著只補齊缺少的資料與供餐確認。'));S.input.value='';nextStep();renderStep();return;
    }
  }
  if(C.step==='destination'||C.step==='city'){
    parsed=C.parseDestination(answer,C.step==='city'?d.countryKey:null);if(parsed.error){C.hint(parsed.error,true);return;}
    Object.assign(d,{countryKey:parsed.countryKey,cityKey:parsed.cityKey,cityDisplay:parsed.cityDisplay,usesOtherRate:!!parsed.usesOtherRate});
    if(parsed.usesOtherRate)d.notes.push('此城市套用其他地區費率，請核對。');
  }else if(C.step==='arrival'||C.step==='departure'){
    let text=answer;if(C.step==='departure'&&d.arrival&&!/\b\d{4}[\/年.\-]/.test(text)&&!/^\d{8}/.test(text)&&/^\d{1,2}[\/月.\-]/.test(text))text=d.arrival.dateValue.slice(0,4)+'/'+text;
    parsed=C.parseTime(text);if(parsed.error){C.hint(parsed.error,true);return;}
    const arrival=C.step==='arrival'?parsed:d.arrival,departure=C.step==='departure'?parsed:d.departure;
    if(arrival&&departure&&departure.date<=arrival.date){C.hint('離開必須晚於抵達；請確認年份，必要時先修改另一個時間。',true);return;}
    if(arrival&&departure&&!E.keys(arrival.dateValue,departure.dateValue).length){C.hint('行程超過可計算的 120 天範圍。',true);return;}
    d[C.step]=parsed;pruneDraftDates(oldPair);
  }
  message('user',answer);message('assistant','已記下'+({destination:'目的地',city:'城市',arrival:'抵達時間',departure:'離開時間'}[C.step])+'。');S.input.value='';
  if(state.edit&&d.cityKey){state.edit=null;state.backup=null;}nextStep();renderStep();
}
function goBack(){
  if(state.edit){const backup=state.backup;state.edit=null;state.backup=null;if(backup)secretaryUnpack(backup);C.step=backup?.step||'review';renderStep();return;}
  C.step={city:'destination',arrival:'destination',departure:'arrival',meals:'departure',review:'meals'}[C.step]||'destination';
  if(['arrival','departure'].includes(C.step)){const p=C.draft[C.step];S.input.value=p?p.dateValue+' '+p.timeValue:'';}else S.input.value='';renderStep();
}
function confirmMeals(){
  const d=C.draft;d.breakfast=S.breakfast.checked;d.lunch=S.lunch.checked;
  if(d.lunch&&!d.lunchDates.size){C.hint('請選擇有提供午餐的日期，或取消勾選。',true);return;}
  d.mealConfirmed=true;state.edit=null;state.backup=null;C.step='review';message('assistant','供餐已確認。請核對全部資料，可逐項修改。');renderStep();
}
function applySecretary(){
  const s=draftSnapshot();s.meta={...state.meta};s.calculated=true;const check=E.validate(s,C.rates);if(!check.valid){C.draft.mealConfirmed=false;nextStep();renderStep();C.hint(check.message,true);return;}
  state.auto=true;applyMain(s);state.secretaryNeedsSync=false;S.dialog.close();compute();save();
}

const historyDialog=document.createElement('dialog');historyDialog.id='v5HistoryDialog';historyDialog.className='history-dialog';historyDialog.setAttribute('aria-labelledby','v5HistoryTitle');historyDialog.innerHTML='<div class="dialog-head"><h2 id="v5HistoryTitle">最近行程</h2><button class="icon-btn" type="button" id="v5CloseHistory" aria-label="關閉最近行程">×</button></div><div class="dialog-body"><p class="field-help">保留最近 20 筆，僅限此瀏覽器。載入時依目前費率重算；複製會清除日期與逐日供餐，重新確認後才可匯出。</p><div id="v5HistoryList"></div><button type="button" class="text-btn danger" id="v5ClearHistory">清除全部最近行程</button></div>';document.body.append(historyDialog);
function renderHistory(){const list=validHistory();$('v5HistoryList').innerHTML=list.length?list.map(r=>{const s=E.normalise(r.snapshot,C.rates);return `<article class="history-item"><strong>${esc(C.rates[s.country]?.label||'未選目的地')}・${esc(s.cityDisplay||C.rates[s.country]?.cities[s.city]?.label||'')}</strong><span>${esc(s.arrDate)} → ${esc(s.depDate)}</span><span class="field-help">上次試算 ${esc(r.display?.total||'')}｜${esc(s.meta.name||'未填姓名')}</span><div class="inline-actions"><button type="button" class="compact-primary" data-history="load" data-id="${esc(r.id)}">載入／匯出</button><button type="button" class="text-btn" data-history="copy" data-id="${esc(r.id)}">複製新行程</button><button type="button" class="text-btn danger" data-history="delete" data-id="${esc(r.id)}">刪除</button></div></article>`;}).join(''):'<p class="empty-history">尚無行程；計算完成後會自動保留。</p>';}
$('v5HistoryBtn').addEventListener('click',()=>{renderHistory();historyDialog.showModal();});$('v5CloseHistory').onclick=()=>historyDialog.close();historyDialog.addEventListener('click',e=>{if(e.target===historyDialog)historyDialog.close();});
$('v5ClearHistory').onclick=()=>{if(confirm('刪除此瀏覽器全部最近行程？目前草稿不會刪除。')){removeStorage(HISTORY);state.historyId=null;renderHistory();storageStatus();}};
$('v5HistoryList').addEventListener('click',e=>{
  const b=e.target.closest('[data-history]');if(!b)return;const list=validHistory(),record=list.find(r=>r.id===b.dataset.id);if(!record)return;
  if(b.dataset.history==='delete'){if(confirm('刪除這筆最近行程？')){writeStorage(HISTORY,list.filter(r=>r.id!==record.id));if(state.historyId===record.id)state.historyId=null;renderHistory();storageStatus();}return;}
  if((meaningful(main())||C.draft?.countryKey||state.pending)&&!confirm('載入會取代目前草稿，是否繼續？已儲存的最近行程仍會保留。'))return;
  state.pending=null;resume.hidden=true;document.querySelector('.form-stack').inert=false;$('secretaryBtn').disabled=false;
  const s=E.normalise(record.snapshot,C.rates);C.draft=null;C.messages=[];state.edit=null;
  if(b.dataset.history==='copy'){s.arrDate='';s.depDate='';s.arrTime='';s.depTime='';s.lunchDates=[];s.lunch=false;s.adjustments={};s.mealsNeedReview=true;s.calculated=false;state.historyId=null;}else state.historyId=record.id;
  applyMain(s,b.dataset.history==='load');historyDialog.close();save();if(b.dataset.history==='copy')el.arrDate.focus();else summary.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});
$('v5ResumeBtn').onclick=()=>{const p=state.pending;state.pending=null;resume.hidden=true;document.querySelector('.form-stack').inert=false;$('secretaryBtn').disabled=false;state.historyId=typeof p.historyId==='string'?p.historyId:null;applyMain(E.normalise(p.main,C.rates)||E.normalise({},C.rates),!!p.main?.calculated);if(secretaryUnpack(p.secretary)&&(!meaningful(main())||p.secretary.draft?.countryKey))openSecretary();save();};
$('v5DiscardBtn').onclick=()=>{if(confirm('捨棄上次草稿並開始新行程？最近行程不受影響。'))resetMain(true);};
document.addEventListener('input',e=>{if(state.applying)return;if(document.querySelector('.form-stack').contains(e.target))state.secretaryNeedsSync=!!C.draft;scheduleSave();});
document.addEventListener('change',e=>{if(state.applying)return;if(document.querySelector('.form-stack').contains(e.target))state.secretaryNeedsSync=!!C.draft;if(S.dialog.contains(e.target)){queueMicrotask(()=>{if(C.draft)renderAdjust($('v5SecretDayAdjust'),draftSnapshot());scheduleSave();});}else scheduleSave();});
S.dialog.addEventListener('close',save);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('storage',e=>{if(e.key===HISTORY&&historyDialog.open)renderHistory();if(e.key===DRAFT&&e.newValue){$('v5SaveStatus').textContent='另一個分頁更新了草稿。為避免互相覆寫，請只在一個分頁編輯。';}});
window.TripV5={editSecretary:key=>{if(C.draft&&['destination','arrival','departure','meals'].includes(key))startEdit(key);},getReport:()=>state.result?clone({...state.result,meta:{...state.meta},snapshot:main()}):null,ready:()=>!!state.result&&E.validate(main(),C.rates).valid,save};
function finish(){
  state.ready=true;const saved=readStorage(DRAFT);if(saved?.version===5&&(meaningful(E.normalise(saved.main,C.rates))||saved.secretary?.draft?.countryKey||saved.secretary?.input)){
    state.pending=saved;resume.hidden=false;const s=E.normalise(saved.main,C.rates);$('v5ResumeText').textContent=(s?.cityDisplay||C.rates[s?.country]?.cities[s?.city]?.label||'秘書模式草稿')+'｜'+String(saved.updatedAt||'').replace('T',' ').slice(0,16)+'（暫存時間）';document.querySelector('.form-stack').inert=true;$('secretaryBtn').disabled=true;
  }storageStatus();
}
return{compute,clearResult,updateState,openSecretary,restartSecretary,renderStep,renderReview,submit,goBack,confirmMeals,applySecretary,resetMain,finish};
};
