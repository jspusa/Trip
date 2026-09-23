/* Jasper Travel V5 — pure calculation and bounded, local-only input parsing. */
(function(root){
'use strict';
const pad=n=>String(n).padStart(2,'0');
const meals=['B','L','D'];
const reasons=new Set(['hotel','expo','company','self']);
function dateParts(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
  const [y,m,d]=value.split('-').map(Number),t=new Date(Date.UTC(y,m-1,d));
  return y>=1900&&y<=2199&&t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?{y,m,d,t:t.getTime()}:null;
}
function minute(value){const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(value||'');return m?Number(m[1])*60+Number(m[2]):null;}
function keys(start,end){const a=dateParts(start),b=dateParts(end);if(!a||!b||b.t<a.t||b.t-a.t>120*86400000)return[];const out=[];for(let t=a.t;t<=b.t;t+=86400000)out.push(new Date(t).toISOString().slice(0,10));return out;}
function validate(s,rates){
  if(!rates[s.country]?.cities[s.city])return{valid:false,message:'請選擇國家與城市'};
  const a=dateParts(s.arrDate),b=dateParts(s.depDate),am=minute(s.arrTime),bm=minute(s.depTime);
  if(!a||!b||am===null||bm===null)return{valid:false,message:'請填完整有效的抵達與離開日期時間'};
  if(b.t+bm*60000<=a.t+am*60000)return{valid:false,message:'離開時間必須晚於抵達時間；跨年請填正確年份'};
  if((b.t-a.t)/86400000>120)return{valid:false,message:'單次行程最多可計算 120 天'};
  const dates=keys(s.arrDate,s.depDate);
  if(s.lunch&&!s.lunchDates.some(k=>dates.includes(k)))return{valid:false,message:'已勾選展場午餐，請至少選一天，或取消午餐勾選'};
  if(s.mealsNeedReview)return{valid:false,message:'行程日期已變動，請確認供餐日期後再計算'};
  return{valid:true,dates,am,bm};
}
function normalise(raw,rates){
  if(!raw||typeof raw!=='object')return null;
  const text=(v,n=120)=>typeof v==='string'?v.slice(0,n):'';
  const country=Object.hasOwn(rates,raw.country)?raw.country:'';
  const city=country&&Object.hasOwn(rates[country].cities,raw.city)?raw.city:'';
  const adjustments={};
  if(raw.adjustments&&typeof raw.adjustments==='object')Object.entries(raw.adjustments).slice(0,363).forEach(([k,v])=>{if(/^\d{4}-\d{2}-\d{2}\|[BLD]$/.test(k)&&reasons.has(v))adjustments[k]=v;});
  return{country,city,countryText:text(raw.countryText),cityText:text(raw.cityText),cityDisplay:text(raw.cityDisplay),arrDate:text(raw.arrDate,10),arrTime:text(raw.arrTime,5),depDate:text(raw.depDate,10),depTime:text(raw.depTime,5),breakfast:raw.breakfast===true,lunch:raw.lunch===true,lunchDates:Array.isArray(raw.lunchDates)?[...new Set(raw.lunchDates.filter(k=>dateParts(k)).slice(0,121))]:[],adjustments,mealsNeedReview:raw.mealsNeedReview===true,meta:{name:text(raw.meta?.name,80),department:text(raw.meta?.department,80),purpose:text(raw.meta?.purpose,400)},calculated:raw.calculated===true};
}
function calculate(s,rates){
  const check=validate(s,rates);if(!check.valid)throw new Error(check.message);
  const country=rates[s.country],city=country.cities[s.city],counts={B:0,L:0,D:0};
  const ai=check.am<540?0:check.am<780?1:check.am<1260?2:3;
  const di=check.bm<300?-1:check.bm<720?0:check.bm<1140?1:2;
  const rows=check.dates.map((date,index)=>{
    const lo=index===0?ai:0,hi=index===check.dates.length-1?di:2;
    const cells=meals.map((m,i)=>{
      const eligible=i>=lo&&i<=hi;
      let reason=eligible?'可核給':i<lo?'抵達較晚':'離境較早';
      let included=eligible;
      if(eligible){
        const custom=s.adjustments[date+'|'+m];
        const provided=custom==='self'?null:custom||(m==='B'&&index>0&&s.breakfast?'hotel':m==='L'&&s.lunch&&s.lunchDates.includes(date)?'expo':null);
        if(provided){included=false;reason={hotel:'飯店供餐',expo:'展場供餐',company:'公司／他人供餐'}[provided]||'已供餐';}
      }
      if(included)counts[m]++;
      return{meal:m,eligible,included,reason,amount:included?city[m]:0,rate:city[m]};
    });
    return{date,cells,total:cells.reduce((a,c)=>a+c.amount,0)};
  });
  const subtotals=Object.fromEntries(meals.map(m=>[m,counts[m]*city[m]]));
  return{rows,counts,subtotals,total:Object.values(subtotals).reduce((a,b)=>a+b,0),currency:city.currency,country:country.label,city:s.cityDisplay||city.label,other:s.city==='other',rate:{B:city.B,L:city.L,D:city.D},arrDate:s.arrDate,arrTime:s.arrTime,depDate:s.depDate,depTime:s.depTime,meta:{...s.meta},snapshot:JSON.parse(JSON.stringify(s)),version:'5.0'};
}
function parseMealDates(text,arrDate,depDate){
  text=String(text||'').replace(/\s+/g,'');
  const allowed=keys(arrDate,depDate);if(!allowed.length)return{dates:[],needsReview:true};
  if(/每天|每日|全程|全選/.test(text))return{dates:allowed,needsReview:false};
  let found=[],remainder=text;
  const full=/(?:(\d{4})[\/年.\-])?(\d{1,2})[\/月.\-](\d{1,2})日?/g;
  for(const m of text.matchAll(full)){
    const years=m[1]?[m[1]]:[...new Set(allowed.map(d=>d.slice(0,4)))];
    const candidates=years.map(y=>`${y}-${pad(m[2])}-${pad(m[3])}`).filter(d=>allowed.includes(d));
    if(candidates.length!==1)return{dates:[],needsReview:true};found.push(candidates[0]);remainder=remainder.replace(m[0],'');
  }
  if(!found.length){
    const numbers=[...text.matchAll(/(?:^|[^\d])(\d{1,2})(?=日|號|、|和|與|及|至|到|[-~～]|$)/g)].map(m=>Number(m[1]));
    for(const n of numbers){const candidates=allowed.filter(k=>Number(k.slice(-2))===n);if(candidates.length!==1)return{dates:[],needsReview:true};found.push(candidates[0]);}
  }
  if(found.length===2&&/至|到|~|～|\d\s*-\s*\d/.test(text)){if(found[1]<found[0])return{dates:[],needsReview:true};found=keys(found[0],found[1]);}
  if(/\d/.test(remainder)&&found.length&&[...text.matchAll(full)].length>0)return{dates:[],needsReview:true};
  return{dates:[...new Set(found)],needsReview:!found.length};
}
function parseParagraph(text,parseDestination,parseDateTime){
  text=String(text||'').normalize('NFKC').slice(0,2000);
  const re=/(?:(?:\d{4}\s*[\/年.\-]\s*)?\d{1,2}\s*[\/月.\-]\s*\d{1,2}\s*日?|\d{8})\s*(?:[（(]?(?:週|星期)[一二三四五六日天][）)]?)?\s*[,，、]?\s*(?:(?:上午|下午|早上|晚上|晚間)\s*)?\d{1,2}\s*[:：]\s*\d{2}(?:\s*[ap]m)?/gi;
  const matches=[...text.matchAll(re)];
  if(!matches.length)return null;
  if(matches.length>2)return{error:'一次先處理一個目的地、兩個時間；多段行程請分開計算。'};
  const destinationText=text.slice(0,matches[0].index).replace(/(?:抵達|到達|落地|離開|離境|起飛|到|去|前往|目的地|出差)[：:\s]*$/,'').replace(/[，,。;；\s]+$/,'').trim();
  if(!destinationText)return null;
  const place=parseDestination(destinationText);if(place.error)return{error:place.error};
  const notes=[],parts={place,breakfastKnown:false,lunchKnown:false,breakfast:false,lunch:false,lunchDates:[],notes};
  for(let i=0;i<matches.length;i++){
    const m=matches[i];let value=m[0];
    if(i===1&&parts.arrival&&!/^\d{4}[\/年.\-]/.test(value)&&!/^\d{8}/.test(value))value=parts.arrival.dateValue.slice(0,4)+'/'+value;
    const parsed=parseDateTime(value);if(parsed.error)return{error:parsed.error};
    if(parsed.assumedYear)notes.push(`未寫年份，暫列 ${parsed.dateValue.slice(0,4)} 年，請確認。`);
    const after=text.slice(m.index+m[0].length,matches[i+1]?.index||text.length).split(/[，,;；\n]/)[0];
    const before=text.slice(i?matches[i-1].index+matches[i-1][0].length:0,m.index).split(/[，,;；\n]/).pop();
    const role=/離開|离开|離境|起飛|起飞|出發|depart|leave/i.test(after)?'departure':/抵達|抵达|到達|落地|arriv/i.test(after)?'arrival':/離開|離境|起飛|depart|leave/i.test(before)?'departure':/抵達|到達|落地|arriv/i.test(before)?'arrival':i===0?'arrival':'departure';
    if(parts[role])return{error:'看到兩個相同類型的時間，請明確寫「抵達」與「離開」。'};
    parts[role]=parsed;
  }
  if(parts.arrival&&parts.departure&&parts.departure.date<=parts.arrival.date)return{error:'離開時間不晚於抵達時間。跨年請把兩個年份都寫出來。'};
  const tail=text.slice(matches[matches.length-1].index+matches[matches.length-1][0].length);
  const negative=/無|沒有|不含|未提供|沒提供|不提供|不供|不包|沒有提供|no\b/i;
  tail.split(/[,，;；\n。]/).forEach(clause=>{
    if(/早餐/.test(clause)){parts.breakfastKnown=negative.test(clause)||/有|提供|含|包/.test(clause);parts.breakfast=parts.breakfastKnown&&!negative.test(clause);}
    if(/午餐/.test(clause)){
      parts.lunchKnown=negative.test(clause)||/有|提供|含|包/.test(clause);parts.lunch=parts.lunchKnown&&!negative.test(clause);
      if(parts.lunch){const d=parseMealDates(clause,parts.arrival?.dateValue,parts.departure?.dateValue);parts.lunchDates=d.dates;if(d.needsReview){parts.lunchKnown=false;notes.push('午餐供餐日期請再勾選確認。');}}
    }
    if(/晚餐/.test(clause))notes.push('晚餐的供餐請在「逐日調整」確認；尚未自動套用。');
  });
  if(parts.place.usesOtherRate)notes.push('目的地使用其他地區費率，請確認。');
  return parts;
}
root.TripEngine={dateParts,minute,keys,validate,normalise,calculate,parseParagraph,parseMealDates};
if(typeof module!=='undefined')module.exports=root.TripEngine;
})(typeof window==='undefined'?globalThis:window);
