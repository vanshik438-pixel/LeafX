(()=>{
'use strict';

function boot(){
  const form=document.getElementById('launchForm');
  if(!form) return;

  const panels=[...form.querySelectorAll('.form-step')];
  const stepButtons=[...document.querySelectorAll('.steps .step')];
  let current=1;

  const byId=id=>document.getElementById(id);
  const toast=message=>{
    const el=byId('toast');
    if(!el) return;
    el.textContent=message;
    el.classList.add('show');
    clearTimeout(window.__leafxToast);
    window.__leafxToast=setTimeout(()=>el.classList.remove('show'),2600);
  };

  function syncReview(){
    const ticker=(byId('launchTicker')?.value || byId('tokenSymbol')?.value || 'LEAF').trim().replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase();
    const name=(byId('tokenName')?.value || 'Leaf').trim();
    const pair=byId('pair')?.value || 'SOL';
    const supply=Number(byId('initialSupply')?.value || 0);
    const x=byId('xLink')?.value?.trim() || '';
    if(byId('reviewHandle')) byId('reviewHandle').textContent=x ? x : 'X profile not added';
    if(byId('reviewToken')) byId('reviewToken').textContent='$'+ticker;
    if(byId('reviewPair')) byId('reviewPair').textContent=pair;
    if(byId('reviewSupply')) byId('reviewSupply').textContent=Number.isFinite(supply)?supply.toLocaleString():'0';
    if(byId('previewName')) byId('previewName').textContent=name;
    if(byId('previewSymbol')) byId('previewSymbol').textContent='$'+ticker+' / '+pair;
  }

  function setStep(number){
    current=Math.max(1,Math.min(4,Number(number)||1));
    panels.forEach(panel=>{
      const active=Number(panel.dataset.panel)===current;
      panel.classList.toggle('active',active);
      panel.hidden=!active;
      panel.setAttribute('aria-hidden',String(!active));
    });
    stepButtons.forEach(button=>{
      const active=Number(button.dataset.step)===current;
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'step':'false');
    });
    const label=byId('stepLabel');
    if(label) label.hidden=true;
    syncReview();
    window.__leafxLaunchStep=current;
  }

  function validCurrentStep(){
    const panel=panels.find(p=>Number(p.dataset.panel)===current);
    if(!panel) return true;
    const ticker=byId('launchTicker');
    if(current===1 && ticker){
      const value=ticker.value.trim();
      if(!/^[A-Za-z0-9]{2,10}$/.test(value)){
        ticker.setCustomValidity('Use 2–10 letters or numbers for the ticker.');
        ticker.reportValidity();
        return false;
      }
      ticker.setCustomValidity('');
    }
    for(const input of panel.querySelectorAll('input[required],textarea[required],select[required]')){
      if(!input.checkValidity()){
        input.reportValidity();
        return false;
      }
    }
    if(current===3){
      const total=[...form.querySelectorAll('.fee-input')].reduce((sum,input)=>sum+(Number(input.value)||0),0);
      if(total!==100){
        toast('Fee allocation must equal 100%.');
        return false;
      }
    }
    return true;
  }

  function next(){
    if(validCurrentStep()) setStep(current+1);
  }

  function back(){setStep(current-1);}

  // Remove legacy inline handlers from the actual navigation buttons.
  form.querySelectorAll('.next,.back').forEach(button=>{
    button.onclick=null;
    button.removeAttribute('onclick');
  });

  // One delegated controller owns the wizard. Capture phase prevents the legacy app.js
  // handlers from changing the state a second time.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element ? event.target : null;
    if(!target) return;
    const nextButton=target.closest('#launchForm .next');
    const backButton=target.closest('#launchForm .back');
    const stepButton=target.closest('.steps .step');
    if(nextButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      next();
      return;
    }
    if(backButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      back();
      return;
    }
    if(stepButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      const requested=Number(stepButton.dataset.step);
      if(requested>current && !validCurrentStep()) return;
      setStep(requested);
    }
  },true);

  // Prevent Enter from submitting while the user is still configuring the launch.
  form.addEventListener('keydown',event=>{
    if(event.key==='Enter' && current<4 && event.target.tagName!=='TEXTAREA'){
      event.preventDefault();
    }
  },true);

  form.addEventListener('submit',event=>{
    if(current<4){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  // If another legacy script changes the panels, restore the controller's state.
  const observer=new MutationObserver(()=>{
    const active=panels.find(p=>p.classList.contains('active'));
    if(active && Number(active.dataset.panel)!==current) setStep(Number(active.dataset.panel));
  });
  observer.observe(form,{subtree:true,attributes:true,attributeFilter:['class','style']});

  ['launchTicker','tokenName','pair','initialSupply','xLink'].forEach(id=>byId(id)?.addEventListener('input',syncReview));
  byId('pair')?.addEventListener('change',syncReview);

  setStep(1);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
