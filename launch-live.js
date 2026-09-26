(()=>{
'use strict';
function boot(){
 const form=document.getElementById('launchForm'),button=form?.querySelector('.launch-btn');
 if(!form||!button)return;
 button.type='button';
 button.addEventListener('click',e=>{
   e.preventDefault(); e.stopImmediatePropagation();
   if(button.disabled)return;
   const toast=m=>{const t=document.getElementById('toast');if(t){t.textContent=m;t.classList.add('show');clearTimeout(window.__leafLaunchToast);window.__leafLaunchToast=setTimeout(()=>t.classList.remove('show'),5000)}};
   if(window.__leafxLaunchStep!==4){toast('Finish the launch setup first.');return;}
   if(!window.__leafConnectedAddress){toast('Connect your Solana wallet to launch.');document.getElementById('walletModal')?.classList.add('open');return;}
   if(typeof window.__leafxMintWithRetry==='function'){
     // Use the real mint action exposed by the mint module when available.
     button.disabled=true;button.innerHTML='◎ Preparing wallet transaction…';
     window.__leafxMintWithRetry().then(r=>{
       const symbol=(document.getElementById('launchTicker')?.value||document.getElementById('tokenSymbol')?.value||'LEAF').toUpperCase();
       form.style.display='none';document.getElementById('success')?.classList.add('show');
       const text=document.getElementById('successText');if(text)text.innerHTML=`<b>$${symbol}</b> SPL mint created on Solana Devnet.<br><small>Mint: ${r.mint}<br>Token account: ${r.ata}<br>Transaction: ${r.sig}</small>`;
       const ex='https://explorer.solana.com';const tx=document.getElementById('txLink'),mint=document.getElementById('mintLink');if(tx)tx.href=`${ex}/tx/${r.sig}?cluster=devnet`;if(mint)mint.href=`${ex}/address/${r.mint}?cluster=devnet`;
       toast(`$${symbol} created on Devnet ✓`);
     }).catch(err=>{console.error(err);toast(`Launch failed: ${err?.message||err}`);}).finally(()=>{button.disabled=false;button.innerHTML='Launch token <span>↗</span>';});
   }else{
     // Fallback to the existing real submit handler.
     form.requestSubmit();
   }
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();