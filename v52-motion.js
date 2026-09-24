(()=>{'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s);
if(!reduce){
  const reveal=[...document.querySelectorAll('.progress-card,.form-stack>.card,.summary-card,.results')];
  reveal.forEach((el,i)=>{el.classList.add('v52-reveal');el.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:420,delay:Math.min(i*55,220),easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});});
  document.querySelectorAll('button:not(.combo-option):not(.calendar-day),.date-chip').forEach(el=>{
    el.addEventListener('pointerdown',()=>el.animate([{transform:'scale(1)'},{transform:'scale(.975)'}],{duration:90,easing:'ease-out'}));
    el.addEventListener('pointerup',()=>el.animate([{transform:'scale(.975)'},{transform:'scale(1)'}],{duration:150,easing:'cubic-bezier(.2,.8,.2,1)'}));
  });
  const amount=$('#totalAmount');
  if(amount)new MutationObserver(()=>amount.animate([{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})).observe(amount,{childList:true,characterData:true,subtree:true});
  const results=$('#results');
  if(results)new MutationObserver(()=>{if(results.classList.contains('show'))results.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});}).observe(results,{attributes:true,attributeFilter:['class']});
}
})();