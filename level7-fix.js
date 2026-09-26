(()=>{
'use strict';
const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
const form=$('#launchForm');if(!form)return;
$$('.next,.back').forEach(btn=>{const c=btn.cloneNode(true);btn.replaceWith(c)});
let current=1;
const panels=()=>$$('.form-step',form),steps=()=>$$('.step');
function render(n){current=Math.max(1,Math.min(4,n));panels().forEach(p=>p.classList.toggle('active',Number(p.dataset.panel)===current));steps().forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===current));const l=$('#stepLabel');if(l)l.textContent=`STEP ${current} OF 4`;if(typeof window.updateReview==='function')window.updateReview();if(typeof window.updateReq==='function')window.updateReq();}
$$('.next',form).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const panel=btn.closest('.form-step');if(panel){for(const input of $$('input[required]',panel)){if(!input.checkValidity()){input.reportValidity();return}}}if(current===3){const vals=$$('.fee-input',panel||form).map(x=>Number(x.value)||0);if(vals.length===3&&Math.round(vals.reduce((a,b)=>a+b,0)*100)/100!==100){if(window.toast)window.toast('Fee allocation must total 100%.');return}}render(current+1)},true));
$$('.back',form).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();render(current-1)},true));
steps().forEach(btn=>{const c=btn.cloneNode(true);btn.replaceWith(c)});$$('.step').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();render(Number(btn.dataset.step))},true));
const identity=$('.form-step[data-panel="1"]');
if(identity&&!$('#launchBanner')){const box=document.createElement('div');box.className='launch-media-fields';box.innerHTML='<label>Token banner<input id="launchBanner" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG or WebP · max 3 MB</small></label><label>Token description<textarea id="launchDescription" maxlength="500" rows="4" placeholder="Tell people what this token is about..."></textarea><small><span id="descCount">0</span>/500</small></label><div id="bannerPreview" class="banner-preview" hidden></div>';const handle=$('#xHandle',identity);handle?.closest('label')?.after(box);const file=$('#launchBanner');file.addEventListener('change',()=>{const f=file.files?.[0];if(!f)return;if(f.size>3*1024*1024){file.value='';if(window.toast)window.toast('Banner must be 3 MB or smaller.');return}const p=$('#bannerPreview');p.hidden=false;p.style.backgroundImage=`url("${URL.createObjectURL(f)}")`;p.innerHTML='<span>Banner preview</span>'});$('#launchDescription').addEventListener('input',e=>$('#descCount').textContent=e.target.value.length)}
render(1);
})();