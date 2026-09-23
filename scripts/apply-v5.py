"""Surgical entry-point integration, preserving original rate data and picker code."""
from pathlib import Path
p=Path('index.html');s=p.read_text(encoding='utf-8')
if 'const experience=window.installTripV5' in s:
 print('V5 is already wired');raise SystemExit(0)
def replace(old,new):
 global s
 assert s.count(old)==1, f'Unexpected integration anchor: {old[:80]}'
 s=s.replace(old,new)
replace('data-update-count="46" aria-label="版本 4.6">V4.6','data-update-count="50" aria-label="版本 5.0">V5.0')
replace('  <script>\n  (()=>{','  <script src="v5-engine.js?v=5.0"></script>\n  <script src="v5-experience.js?v=5.0"></script>\n  <script>\n  (()=>{')
replace('  <link rel="stylesheet" href="trip-export.css?v=4.6">','  <link rel="stylesheet" href="trip-export.css?v=5.0">\n  <link rel="stylesheet" href="v5-experience.css?v=5.0">')
replace('  <script src="trip-export.js?v=4.6" defer></script>','  <script src="trip-export.js?v=5.0" defer></script>\n  <script src="v5-report.js?v=5.0" defer></script>')
replace('<input class="secretary-input" id="secretaryInput" type="text" autocomplete="off" aria-describedby="secretaryHint" aria-invalid="false" placeholder="例如：東京">','<textarea class="secretary-input" id="secretaryInput" autocomplete="off" aria-describedby="secretaryHint" aria-invalid="false" placeholder="例如：東京" rows="3" maxlength="2000"></textarea>')
bridge='''    const experience=window.installTripV5({
      rates,el,secretaryEl,baseUpdate:updateState,baseClear:clearResult,
      get draft(){return secretaryDraft;},set draft(v){secretaryDraft=v;},
      get step(){return secretaryStep;},set step(v){secretaryStep=v;},
      get messages(){return secretaryMessages;},set messages(v){secretaryMessages=v;},
      get expo(){return expoSelection;},set expo(v){expoSelection=v;},
      readMain:()=>({country:el.country.value,city:el.city.value,countryText:el.countrySearch.value,cityText:el.citySearch.value,cityDisplay:activeSecretaryOther?.cityDisplay||rates[el.country.value]?.cities[el.city.value]?.label||'',arrDate:el.arrDate.value,arrTime:el.arrTime.value,depDate:el.depDate.value,depTime:el.depTime.value,breakfast:el.hotelBreakfast.checked,lunch:el.expoLunch.checked,lunchDates:[...expoSelection]}),
      writeMain:s=>{
        el.country.value=s.country;el.countrySearch.value=s.countryText||[...el.country.options].find(o=>o.value===s.country)?.textContent.trim()||'';populateCities(false);el.city.value=s.city;el.citySearch.value=s.cityText||rates[s.country]?.cities[s.city]?.label||'';
        activeSecretaryOther=s.city==='other'?{countryKey:s.country,cityDisplay:s.cityDisplay||rates[s.country]?.cities[s.city]?.label}:null;
        ['arrDate','arrTime','depDate','depTime'].forEach(k=>el[k].value=s[k]);el.hotelBreakfast.checked=s.breakfast;el.expoLunch.checked=s.lunch;expoSelection=new Set(s.lunchDates);el.expoPicker.classList.toggle('show',s.lunch);if(s.lunch)renderExpoDates();else el.expoDates.innerHTML='';closeCombo('country');closeCombo('city');
      },
      parseDestination:parseSecretaryDestination,parseTime:parseSecretaryDateTime,newDraft:newSecretaryDraft,
      renderExpo:renderExpoDates,renderSecretLunch:renderSecretaryLunchDates,renderMessages:renderSecretaryMessages,
      toast:showToast,hint:setSecretaryHint,setProgress,arrivalRule,departureRule
    });
    compute=experience.compute;clearResult=experience.clearResult;updateState=experience.updateState;
    renderSecretaryStep=experience.renderStep;renderSecretaryReview=experience.renderReview;
    submitSecretaryAnswer=experience.submit;secretaryGoBack=experience.goBack;applySecretaryDraft=experience.applySecretary;
    resetSecretary=experience.restartSecretary;
'''
replace('    fillWheel(el.hourWheel,24);',bridge+'\n    fillWheel(el.hourWheel,24);')
line=next(line for line in s.splitlines() if "$('resetBtn').addEventListener('click'" in line)
replace(line,"    $('resetBtn').addEventListener('click',()=>experience.resetMain());")
replace("    $('secretaryBtn').addEventListener('click',()=>{secretaryEl.dialog.showModal();resetSecretary();});","    $('secretaryBtn').addEventListener('click',experience.openSecretary);")
replace("if(event.key!=='Enter'||event.isComposing||secretaryComposing)return;","if(event.key!=='Enter'||event.shiftKey||event.isComposing||secretaryComposing)return;")
start=s.index("    $('secretaryMealNextBtn').addEventListener('click',()=>{")
end=s.index("    $('secretaryConfirmBtn')",start)
s=s[:start]+"    $('secretaryMealNextBtn').addEventListener('click',experience.confirmMeals);\n"+s[end:]
replace('    renderRates();updateLabels();updateState();','    renderRates();updateLabels();updateState();experience.finish();')
p.write_text(s,encoding='utf-8')
print('Integrated V5; original rate table, time thresholds and pickers preserved.')
