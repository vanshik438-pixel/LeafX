(()=>{
'use strict';

function boot(){
  const form=document.getElementById('launchForm');
  if(!form) return;
  const panels=[...form.querySelectorAll('.form-step')];
  const stepButtons=[...document.querySelectorAll('.steps .step')];
  let current=1;
  const byId=id=>document.getElementById(id);
  const toast=message=>{const el=byId('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__leafxToast);window.__leafxToast=setTimeout(()=>el.classList.remove('show'),2600)};

  function ensureIdentityFields(){
    const panel=panels.find(p=>Number(p.dataset.panel)===1);
    if(!panel || byId('xLink')) return;
    byId('legacyXHandleLabel')?.remove();
    panel.querySelector('.profile-preview')?.remove();
    const box=document.createElement('div');
    box.className='leafx-identity-fields';
    box.innerHTML='<label>X profile link<input id="xLink" type="url" placeholder="https://x.com/yourprofile"><small>Public X profile shown on your token page.</small></label><label>Token ticker<input id="launchTicker" maxlength="10" placeholder="LEAF" required><small>2–10 letters or numbers.</small></label><label>Token banner<input id="launchBanner" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG or WebP · maximum 3 MB.</small></label><div id="bannerPreview" class="leafx-banner-preview" hidden></div><label>Token description<textarea id="launchDescription" maxlength="500" rows="4" placeholder="Describe your token..."></textarea><small><span id="descCount">0</span>/500</small></label>';
    panel.querySelector('.panel-title')?.after(box);
    const ticker=byId('launchTicker');
    ticker.value=byId('tokenSymbol')?.value||'LEAF';
    ticker.addEventListener('input',()=>{ticker.value=ticker.value.replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase();if(byId('tokenSymbol'))byId('tokenSymbol').value=ticker.value;syncReview()});
    byId('xLink')?.addEventListener('input',syncReview);
    byId('launchDescription')?.addEventListener('input',e=>{if(byId('descCount'))byId('descCount').textContent=e.target.value.length});
    byId('launchBanner')?.addEventListener('change',e=>{const file=e.target.files?.[0],preview=byId('bannerPreview');if(!file||!preview)return;if(file.size>3*1024*1024){e.target.value='';preview.hidden=true;toast('Banner must be 3 MB or smaller.');return}if(!/^image\/(png|jpeg|webp)$/.test(file.type)){e.target.value='';preview.hidden=true;toast('Use PNG, JPG or WebP.');return}if(preview.dataset.url)URL.revokeObjectURL(preview.dataset.url);const url=URL.createObjectURL(file);preview.dataset.url=url;preview.style.backgroundImage=`url("${url}")`;preview.hidden=false});
    const style=document.createElement('style');style.textContent='.leafx-identity-fields{display:grid;gap:14px;margin:8px 0 24px}.leafx-identity-fields label{margin:0}.leafx-identity-fields small{display:block;color:#718278;font-size:9px;margin-top:6px;text-transform:none;letter-spacing:0}.leafx-identity-fields textarea{display:block;width:100%;margin-top:8px;box-sizing:border-box;background:rgba(3,10,7,.72);border:1px solid rgba(149,255,197,.12);color:var(--text);border-radius:12px;padding:13px 14px;outline:none;resize:vertical}.leafx-banner-preview{height:150px;border-radius:16px;border:1px solid rgba(149,255,197,.12);background:#07100b center/cover no-repeat;box-shadow:inset 0 -70px 80px rgba(0,0,0,.5)}';document.head.appendChild(style);
  }

  function syncReview(){
    const ticker=(byId('launchTicker')?.value||byId('tokenSymbol')?.value||'LEAF').trim().replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase();
    const name=(byId('tokenName')?.value||'Leaf').trim();
    const pair=byId('pair')?.value||'SOL';
    const supply=Number(byId('initialSupply')?.value||0);
    const x=byId('xLink')?.value?.trim()||'';
    if(byId('reviewHandle'))byId('reviewHandle').textContent=x||'X profile not added';
    if(byId('reviewToken'))byId('reviewToken').textContent='$'+ticker;
    if(byId('reviewPair'))byId('reviewPair').textContent=pair;
    if(byId('reviewSupply'))byId('reviewSupply').textContent=Number.isFinite(supply)?supply.toLocaleString():'0';
    if(byId('previewName'))byId('previewName').textContent=name;
    if(byId('previewSymbol'))byId('previewSymbol').textContent='$'+ticker+' / '+pair;
  }

  function setStep(number){
    current=Math.max(1,Math.min(4,Number(number)||1));
    panels.forEach(panel=>{const active=Number(panel.dataset.panel)===current;panel.classList.toggle('active',active);panel.hidden=!active;panel.setAttribute('aria-hidden',String(!active))});
    stepButtons.forEach(button=>{const active=Number(button.dataset.step)===current;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'step':'false')});
    const label=byId('stepLabel');if(label)label.hidden=true;
    syncReview();window.__leafxLaunchStep=current;
  }

  function validCurrentStep(){
    const panel=panels.find(p=>Number(p.dataset.panel)===current);if(!panel)return true;
    const ticker=byId('launchTicker');
    if(current===1&&ticker){const value=ticker.value.trim();if(!/^[A-Za-z0-9]{2,10}$/.test(value)){ticker.setCustomValidity('Use 2–10 letters or numbers for the ticker.');ticker.reportValidity();return false}ticker.setCustomValidity('')}
    for(const input of panel.querySelectorAll('input[required],textarea[required],select[required]')){if(!input.checkValidity()){input.reportValidity();return false}}
    if(current===3){const total=[...form.querySelectorAll('.fee-input')].reduce((sum,input)=>sum+(Number(input.value)||0),0);if(total!==100){toast('Fee allocation must equal 100%.');return false}}
    return true;
  }
  function next(){if(validCurrentStep())setStep(current+1)}
  function back(){setStep(current-1)}

  ensureIdentityFields();
  form.querySelectorAll('.next,.back').forEach(button=>{button.onclick=null;button.removeAttribute('onclick')});

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const nextButton=target.closest('#launchForm .next'),backButton=target.closest('#launchForm .back'),stepButton=target.closest('.steps .step');
    if(nextButton){event.preventDefault();event.stopImmediatePropagation();next();return}
    if(backButton){event.preventDefault();event.stopImmediatePropagation();back();return}
    if(stepButton){event.preventDefault();event.stopImmediatePropagation();const requested=Number(stepButton.dataset.step);if(requested>current&&!validCurrentStep())return;setStep(requested)}
  },true);

  form.addEventListener('keydown',event=>{if(event.key==='Enter'&&current<4&&event.target.tagName!=='TEXTAREA')event.preventDefault()},true);
  form.addEventListener('submit',event=>{if(current<4){event.preventDefault();event.stopImmediatePropagation()}},true);

  const observer=new MutationObserver(()=>{const active=panels.find(p=>p.classList.contains('active'));if(active&&Number(active.dataset.panel)!==current)setStep(Number(active.dataset.panel))});
  observer.observe(form,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  ['launchTicker','tokenName','pair','initialSupply','xLink'].forEach(id=>byId(id)?.addEventListener('input',syncReview));
  byId('pair')?.addEventListener('change',syncReview);
  setStep(1);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
