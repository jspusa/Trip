const fs=require('fs'),vm=require('vm'),assert=require('assert');
const E=require('../v5-engine.js'),html=fs.readFileSync('index.html','utf8');
const ratesBlock=html.slice(html.indexOf('    const rates='),html.indexOf('    const $='));
const helpers=html.slice(html.indexOf('    const pad='),html.indexOf('    function newSecretaryDraft'));
const sandbox={Intl,Date,console};vm.createContext(sandbox);vm.runInContext(ratesBlock+helpers+';this.rates=rates;this.parseDestination=parseSecretaryDestination;this.parseTime=parseSecretaryDateTime;',sandbox);
const R=sandbox.rates,normal=x=>E.normalise({country:'VN',city:'hochiminh',arrDate:'2026-10-14',arrTime:'09:40',depDate:'2026-10-17',depTime:'17:30',breakfast:true,...x},R);
assert.equal(E.calculate(normal({}),R).total,84);
assert.equal(E.calculate(normal({lunch:true,lunchDates:['2026-10-15','2026-10-16']}),R).total,60);
assert.equal(E.calculate(normal({adjustments:{'2026-10-14|B':'self'}}),R).total,84,'Ineligible breakfast cannot be added');
assert.equal(E.calculate(normal({adjustments:{'2026-10-15|B':'self'}}),R).total,90,'Actual unprovided eligible meal uses the original rate');
assert.equal(E.calculate(normal({adjustments:{'2026-10-15|D':'company'}}),R).total,72);
assert.equal(E.validate(normal({lunch:true}),R).valid,false);
assert.equal(E.validate(normal({depDate:'2026-10-13'}),R).valid,false);
assert.equal(E.validate(normal({mealsNeedReview:true}),R).valid,false);
assert.equal(E.validate(normal({arrDate:'2026-02-30'}),R).valid,false);
assert.equal(E.validate(normal({arrTime:'24:00'}),R).valid,false);
assert.equal(E.keys('2026-03-07','2026-03-10').length,4,'Wall-clock day enumeration is DST independent');
assert.equal(E.keys('2026-01-01','2026-12-31').length,0);
// Exhaustive hour/minute cutoff coverage against the unchanged original rules.
function amin(m){return m<=539?0:m<=779?1:m<=1259?2:3;}
function dmax(m){return m<=299?-1:m<=719?0:m<=1139?1:2;}
function time(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
let n=0;
for(const [country,value] of Object.entries(R))for(const city of Object.keys(value.cities)){
 for(const a of [0,299,300,539,540,719,720,779,780,1139,1140,1259,1260,1439])for(const d of [0,299,300,539,540,719,720,779,780,1139,1140,1259,1260,1439]){
  const s=normal({country,city,arrDate:'2026-10-14',arrTime:time(a),depDate:'2026-10-15',depTime:time(d),breakfast:false});
  const report=E.calculate(s,R),r=value.cities[city];let total=0;for(let i=0;i<3;i++){if(i>=amin(a))total+=r[['B','L','D'][i]];if(i<=dmax(d))total+=r[['B','L','D'][i]];}
  assert.equal(report.total,total);n++;
 }
}
const parse=text=>E.parseParagraph(text,sandbox.parseDestination,sandbox.parseTime);
let p=parse('胡志明市，2026/10/14 09:40 抵達，10/17 17:30 離開，飯店有早餐，15、16 日展場有午餐。');
assert.equal(p.arrival.dateValue,'2026-10-14');assert.equal(p.departure.dateValue,'2026-10-17');assert.deepEqual(p.lunchDates,['2026-10-15','2026-10-16']);assert(p.breakfastKnown&&p.lunchKnown);
p=parse('東京，2026/10/14 09:40 抵達，2026/10/17 17:30 離開');assert(!p.breakfastKnown&&!p.lunchKnown);
p=parse('東京，2026/12/30 09:40 抵達，1/2 17:30 離開');assert(p.error&&p.error.includes('跨年'));
p=parse('東京，2026/12/30 09:40 抵達，2027/1/2 17:30 離開，沒有早餐，沒有午餐');assert(!p.error);assert.equal(p.departure.dateValue,'2027-01-02');assert(p.breakfastKnown&&p.lunchKnown&&!p.breakfast&&!p.lunch);
assert.deepEqual(E.parseMealDates('15 至 16 日有午餐','2026-10-14','2026-10-17').dates,['2026-10-15','2026-10-16']);
assert.equal(E.parseMealDates('1日午餐','2026-10-01','2026-11-02').needsReview,true);
const corrupt=JSON.parse('{"adjustments":{"__proto__":"company","2026-10-14|B":"self","junk":"self"},"country":"__proto__"}');const clean=E.normalise(corrupt,R);assert.equal(clean.country,'');assert.equal(Object.keys(clean.adjustments).length,1);
console.log('ENGINE_PASS',n,'original-rate and cutoff comparisons; supplied meals, dates, cross-year ambiguity and parsing passed');
