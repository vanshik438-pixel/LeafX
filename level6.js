(()=>{
'use strict';
const RPC='https://api.devnet.solana.com', EXPLORER='https://explorer.solana.com', CHAIN='solana:devnet';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const toast=m=>{const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(window.__lx6t);window.__lx6t=setTimeout(()=>t.classList.remove('show'),4200)};
const short=a=>a?`${a.slice(0,5)}…${a.slice(-5)}`:'—';
let sdk=null, connection=null, busy=false;
async function load(){if(sdk)return sdk;const [{Connection,PublicKey,Keypair,SystemProgram,Transaction},spl]=await Promise.all([import('https://esm.sh/@solana/web3.js@1.98.4'),import('https://esm.sh/@solana/spl-token@0.4.14')]);sdk={Connection,PublicKey,Keypair,SystemProgram,Transaction,spl};connection=new Connection(RPC,'confirmed');return sdk}
function wallet(){return window.__leafConnectedWallet||null}
function address(){return window.__leafConnectedAddress||wallet()?.provider?.publicKey?.toString?.()||''}
function account(){return window.__leafConnectedAccount||wallet()?.accounts?.find(a=>a.chains?.includes(CHAIN))||wallet()?.accounts?.find(a=>a.address)||null}
function b58(bytes){const abc='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const x of bytes)n=(n<<8n)+BigInt(x);let s='';while(n){s=abc[Number(n%58n)]+s;n/=58n}for(const x of bytes){if(x===0)s='1'+s;else break}return s||'1'}
async function signAndSend(tx){const w=wallet();if(!w)throw Error('Connect a Solana wallet first.');if(w.legacy){const r=await w.provider.signAndSendTransaction(tx);return r?.signature||r?.txid||r}const f=w.features?.['solana:signAndSendTransaction'];if(!f)throw Error(`${w.name||'Wallet'} does not support Solana transaction signing.`);const bytes=tx.serialize({requireAllSignatures:false,verifySignatures:false});const out=await f.signAndSendTransaction({transaction:bytes,account:account(),chain:CHAIN});const sig=out?.[0]?.signature;if(!sig)throw Error('Wallet returned no transaction signature.');return typeof sig==='string'?sig:b58(sig)}
async function createRealMint({name,symbol,decimals,supply}){
 const {Connection,PublicKey,Keypair,SystemProgram,Transaction,spl}=await load();
 const payer=new PublicKey(address());
 const mint=Keypair.generate();
 const rent=await connection.getMinimumBalanceForRentExemption(spl.MINT_SIZE);
 const ata=spl.getAssociatedTokenAddressSync(mint.publicKey,payer,false,spl.TOKEN_PROGRAM_ID,spl.ASSOCIATED_TOKEN_PROGRAM_ID);
 const amount=BigInt(supply)*10n**BigInt(decimals);
 const bh=await connection.getLatestBlockhash('confirmed');
 const tx=new Transaction({feePayer:payer,recentBlockhash:bh.blockhash});
 tx.add(SystemProgram.createAccount({fromPubkey:payer,newAccountPubkey:mint.publicKey,space:spl.MINT_SIZE,lamports:rent,programId:spl.TOKEN_PROGRAM_ID}));
 tx.add(spl.createInitializeMintInstruction(mint.publicKey,decimals,payer,payer,spl.TOKEN_PROGRAM_ID));
 tx.add(spl.createAssociatedTokenAccountInstruction(payer,ata,payer,mint.publicKey,spl.TOKEN_PROGRAM_ID,spl.ASSOCIATED_TOKEN_PROGRAM_ID));
 if(amount>0n)tx.add(spl.createMintToInstruction(mint.publicKey,ata, payer, amount, [], spl.TOKEN_PROGRAM_ID));
 tx.partialSign(mint);
 const sig=await signAndSend(tx);
 await connection.confirmTransaction({signature:sig,blockhash:bh.blockhash,lastValidBlockHeight:bh.lastValidBlockHeight},'confirmed');
 const bal=await connection.getTokenAccountBalance(ata).catch(()=>null);
 return {sig,mint:mint.publicKey.toBase58(),ata:ata.toBase58(),supply,decimals,balance:bal?.value?.uiAmountString||String(supply),name,symbol};
}
function pairData(){const type=$('#pair')?.value||'SOL';const mint=$('#pairMint')?.value?.trim()||'';return {type,mint,status:type==='SOL'||type==='USDC'?'POOL_PENDING':'QUOTE_MINT_PENDING'} }
function saveLaunch(result,pair){const key='leafx.launches.v2';const old=JSON.parse(localStorage.getItem(key)||'[]');old.unshift({...result,pair,createdAt:new Date().toISOString(),network:'devnet',status:'minted'});localStorage.setItem(key,JSON.stringify(old.slice(0,50)))}
function renderRealLaunches(){const box=$('#launchGrid');if(!box)return;const rows=JSON.parse(localStorage.getItem('leafx.launches.v2')||'[]');if(!rows.length){box.innerHTML='<article class="l6-empty"><div class="l6-empty-icon">◇</div><h3>No live launches yet</h3><p>Create your first real Devnet SPL token. It will appear here after the transaction is confirmed.</p><a href="#create" class="primary-btn">Create first token →</a></article>';return}box.innerHTML=rows.map(x=>`<article class="launch-card l6-real-card"><div class="launch-head"><div class="mini-coin">${String(x.symbol||'L').slice(0,1)}</div><span class="trend l6-status">${x.status==='minted'?'MINTED':'LIVE'}</span></div><h3>$${esc(x.symbol)} · ${esc(x.name)}</h3><div class="handle">${esc(x.pair.type)} · ${esc(x.network)}</div><div class="l6-address"><span>Mint</span><code>${esc(short(x.mint))}</code><button data-copy="${esc(x.mint)}">Copy</button></div><div class="launch-meta"><span>SUPPLY ${Number(x.supply).toLocaleString()}</span><a target="_blank" rel="noopener" href="${EXPLORER}/address/${encodeURIComponent(x.mint)}?cluster=devnet">Explorer ↗</a></div></article>`).join('');box.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied'}catch{}})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function hardcodeAudit(){const warnings=[];const text=document.body.innerText;const fake=['$PAID','STonk','@marketleaf','184K','92K','61K','44K','77K','31K','paired with SOL'];fake.forEach(x=>{if(text.includes(x))warnings.push(x)});console.info('[LeafX Level 6 audit] Demo literals still present in loaded DOM:',warnings);return warnings}
function wire(){
 const form=$('#launchForm');if(!form)return;
 // Replace the old demo mint submit handler with the real full mint flow.
 const clean=form.cloneNode(true);form.replaceWith(clean);const f=$('#launchForm');
 f.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const fees=$$('.fee-input').reduce((s,x)=>s+Number(x.value||0),0);if(fees!==100){toast('Fee allocation must total exactly 100%.');return}if(!address()){toast('Connect a Solana wallet first.');$('#walletModal')?.classList.add('open');window.__leafWalletUI?.scan?.();return}
  const name=$('#tokenName')?.value?.trim()||'';const symbol=($('#tokenSymbol')?.value||'').trim().toUpperCase();const decimals=Number($('#tokenDecimals')?.value||9);const supply=Number($('#initialSupply')?.value||0);const pair=pairData();
  if(!name||!symbol)return toast('Enter a token name and symbol.');if(!Number.isInteger(decimals)||decimals<0||decimals>9)return toast('Decimals must be between 0 and 9.');if(!Number.isFinite(supply)||supply<=0)return toast('Initial supply must be greater than zero.');if(pair.type==='SPL'&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pair.mint))return toast('Enter a valid Solana quote-token mint address.');
  busy=true;const btn=f.querySelector('.launch-btn');if(btn){btn.disabled=true;btn.innerHTML='Creating real SPL token… <span>↗</span>'}toast('Review the real SPL mint transaction in your wallet…');
  try{const result=await createRealMint({name,symbol,decimals,supply});saveLaunch(result,pair);const success=$('#success');f.style.display='none';success?.classList.add('show');$('#successText').innerHTML=`<b>$${esc(symbol)}</b> created on Solana Devnet.<br><small>Mint: ${esc(result.mint)}<br>Token account: ${esc(result.ata)}<br>Initial balance: ${esc(result.balance)} ${esc(symbol)}<br>Pair intent: ${esc(pair.type)} · pool creation pending</small>`;$('#txLink').href=`${EXPLORER}/tx/${encodeURIComponent(result.sig)}?cluster=devnet`;$(`#mintLink`).href=`${EXPLORER}/address/${encodeURIComponent(result.mint)}?cluster=devnet`;renderRealLaunches();toast('Real SPL token confirmed on Devnet ✓')}catch(err){console.error('[LeafX] mint failed',err);toast(err?.message||'Transaction failed. No token was published by the UI.')}finally{busy=false;if(btn){btn.disabled=false;btn.innerHTML='◎ Create SPL mint & sign <span>↗</span>'}}
 });
 $('#reset')?.addEventListener('click',()=>{f.style.display='block';$('#success')?.classList.remove('show');f.reset();renderRealLaunches()});
}
function boot(){wire();renderRealLaunches();const pair=$('#pair'),wrap=$('#pairMintWrap');pair?.addEventListener('change',()=>{if(wrap)wrap.style.display=pair.value==='SPL'?'block':'none'});setTimeout(hardcodeAudit,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();