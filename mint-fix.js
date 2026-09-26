(() => {
  const RPC = 'https://api.devnet.solana.com';
  const EXPLORER = 'https://explorer.solana.com';
  const CHAIN = 'solana:devnet';
  const $ = (s) => document.querySelector(s);
  const toast = (msg) => { const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(window.__leafMintToast); window.__leafMintToast=setTimeout(()=>t.classList.remove('show'),6000); };
  const b58 = (bytes) => { const a='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n=0n; for(const b of bytes)n=(n<<8n)+BigInt(b); let s=''; while(n){s=a[Number(n%58n)]+s;n/=58n;} for(const b of bytes){if(b===0)s='1'+s;else break;} return s||'1'; };
  async function libs(){ const [web3,spl]=await Promise.all([import('https://esm.sh/@solana/web3.js@1.98.4'),import('https://esm.sh/@solana/spl-token@0.4.14')]); return {web3,spl}; }
  function walletName(){ return window.__leafConnectedWallet?.name || ($('#dashNetwork')?.textContent.match(/Connected via (.+)$/)?.[1]||''); }
  function providerFor(name){ if(name==='Phantom')return window.phantom?.solana||null; if(name==='Solflare')return window.solflare||null; if(name==='Backpack')return window.backpack?.solana||null; if(name==='Brave Wallet')return window.braveSolana||null; if(name==='Coinbase Wallet')return window.coinbaseSolana||null; return null; }
  async function findStandard(name){ try{const m=await import('https://esm.sh/@wallet-standard/app@1.1.0');const r=m.getWallets();const w=[...r.get()].find(x=>x.name===name)||[...r.get()].find(x=>x.chains?.includes(CHAIN));if(!w)return null;const a=w.accounts?.find(x=>x.chains?.includes(CHAIN))||w.accounts?.[0];return w&&a?{wallet:w,account:a}:null;}catch{return null;} }
  async function send(tx,name){
    const p=providerFor(name);
    if(p?.signAndSendTransaction){ const r=await p.signAndSendTransaction(tx); return r?.signature||r?.txid||r; }
    const f=window.__leafConnectedWallet?.features?.['solana:signAndSendTransaction']; const account=window.__leafConnectedAccount;
    if(f&&account){ const raw=tx.serialize({requireAllSignatures:false,verifySignatures:false}); const out=await f.signAndSendTransaction({transaction:raw,account,chain:CHAIN}); const sig=out?.[0]?.signature; if(!sig)throw Error('Wallet returned no transaction signature.'); return typeof sig==='string'?sig:b58(sig); }
    const found=await findStandard(name); if(!found)throw Error('LeafX could not recover the connected wallet. Disconnect and reconnect it.');
    const sf=found.wallet.features?.['solana:signAndSendTransaction']; if(!sf)throw Error(`${name} cannot sign Solana transactions in this browser.`);
    const raw=tx.serialize({requireAllSignatures:false,verifySignatures:false}); const out=await sf.signAndSendTransaction({transaction:raw,account:found.account,chain:CHAIN}); const sig=out?.[0]?.signature; if(!sig)throw Error('Wallet returned no transaction signature.'); return typeof sig==='string'?sig:b58(sig);
  }
  async function waitForSignature(connection,sig,lastValidBlockHeight){
    for(let i=0;i<180;i++){ const status=(await connection.getSignatureStatuses([sig],{searchTransactionHistory:false})).value[0]; if(status?.err)throw Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`); if(status?.confirmationStatus==='confirmed'||status?.confirmationStatus==='finalized')return; const height=await connection.getBlockHeight('confirmed'); if(height>lastValidBlockHeight)throw Error('TRANSACTION_EXPIRED'); await new Promise(r=>setTimeout(r,500)); }
    throw Error('TRANSACTION_EXPIRED');
  }
  function pairConfig(){
    const pair=$('#pair')?.value||'SOL';
    const custom=pair==='SPL';
    const mint=$('#pairMint')?.value?.trim()||'';
    const quoteAmount=Number($('#quoteAmount')?.value||0);
    const initialSupply=Number($('#initialSupply')?.value||1000000);
    const decimals=Number($('#tokenDecimals')?.value||9);
    return {pair, mint, quoteAmount, initialSupply, decimals, custom};
  }
  async function validatePair(connection){
    const cfg=pairConfig();
    if(cfg.pair==='SOL') return {symbol:'SOL',decimals:9,mint:null,quoteAmount:cfg.quoteAmount};
    const {web3,spl}=await libs();
    const mintAddress=cfg.pair==='USDC'?'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU':cfg.mint;
    if(!mintAddress)throw Error('Enter the quote token mint address.');
    let pk; try{pk=new web3.PublicKey(mintAddress);}catch{throw Error('Quote mint address is invalid.');}
    const info=await spl.getMint(connection,pk,'confirmed',spl.TOKEN_PROGRAM_ID).catch(()=>null);
    if(!info)throw Error('Quote mint was not found on Solana Devnet or is not a legacy SPL Token mint.');
    if(!Number.isFinite(cfg.quoteAmount)||cfg.quoteAmount<=0)throw Error('Enter an initial quote-asset amount greater than 0.');
    const symbol=cfg.pair==='USDC'?'USDC':'Custom SPL';
    return {symbol,decimals:info.decimals,mint:pk.toBase58(),quoteAmount:cfg.quoteAmount};
  }
  async function mintOnce(){
    const {web3,spl}=await libs(); const c=new web3.Connection(RPC,'confirmed');
    const name=walletName(); if(!name)throw Error('Connect a Solana wallet first.');
    const p=providerFor(name); const payerAddress=p?.publicKey?.toString?.()||window.__leafConnectedAddress; if(!payerAddress)throw Error('Wallet address is unavailable. Disconnect and reconnect.');
    const payer=new web3.PublicKey(payerAddress);
    const cfg=pairConfig(); if(!Number.isInteger(cfg.decimals)||cfg.decimals<0||cfg.decimals>9)throw Error('Decimals must be between 0 and 9.'); if(!Number.isFinite(cfg.initialSupply)||cfg.initialSupply<=0)throw Error('Initial supply must be greater than 0.');
    const pair=await validatePair(c);
    const balance=await c.getBalance(payer,'confirmed'); const rent=await c.getMinimumBalanceForRentExemption(spl.MINT_SIZE,'confirmed'); const latest=await c.getLatestBlockhash('processed'); const mint=web3.Keypair.generate();
    const ata=spl.getAssociatedTokenAddressSync(mint.publicKey,payer,false,spl.TOKEN_PROGRAM_ID,spl.ASSOCIATED_TOKEN_PROGRAM_ID);
    const rawSupply=BigInt(Math.round(cfg.initialSupply*(10**cfg.decimals)));
    const tx=new web3.Transaction({recentBlockhash:latest.blockhash,feePayer:payer});
    tx.add(web3.SystemProgram.createAccount({fromPubkey:payer,newAccountPubkey:mint.publicKey,space:spl.MINT_SIZE,lamports:rent,programId:spl.TOKEN_PROGRAM_ID}));
    tx.add(spl.createInitializeMintInstruction(mint.publicKey,cfg.decimals,payer,payer,spl.TOKEN_PROGRAM_ID));
    tx.add(spl.createAssociatedTokenAccountInstruction(payer,ata,payer,mint.publicKey,spl.TOKEN_PROGRAM_ID,spl.ASSOCIATED_TOKEN_PROGRAM_ID));
    tx.add(spl.createMintToInstruction(mint.publicKey,ata,payer,rawSupply,[],spl.TOKEN_PROGRAM_ID));
    tx.partialSign(mint);
    const fee=(await c.getFeeForMessage(tx.compileMessage(),'processed')).value??10000;
    if(balance<rent+fee+10000)throw Error(`Not enough Devnet SOL. You need about ${((rent+fee+10000)/1e9).toFixed(5)} SOL, but this wallet has ${(balance/1e9).toFixed(5)} SOL.`);
    const sig=String(await send(tx,name)); await waitForSignature(c,sig,latest.lastValidBlockHeight);
    return {sig,mint:mint.publicKey.toBase58(),ata:ata.toBase58(),pair};
  }
  async function mintWithRetry(){ for(let attempt=1;attempt<=3;attempt++){ try{return await mintOnce();}catch(e){if(String(e?.message)==='TRANSACTION_EXPIRED'&&attempt<3){toast(`Transaction expired. Rebuilding with a fresh blockhash (${attempt+1}/3)…`);continue;}throw e;} } throw Error('Transaction expired after 3 fresh attempts. Please try again.'); }
  function renderPairUI(){
    const pair=$('#pair'); if(!pair||document.getElementById('quoteAmount'))return;
    const wrap=document.createElement('div'); wrap.id='pairingAdvanced'; wrap.innerHTML=`<div class="grid-2"><label>Initial quote liquidity<input id="quoteAmount" type="number" min="0" step="any" value="1" placeholder="e.g. 10 SOL / 500 USDC"></label><label>Starting price<input id="startPrice" type="number" min="0" step="any" value="0.00001" placeholder="Quote per 1 token"></label></div><div id="pairInfo" style="margin:10px 0;padding:12px 14px;border:1px solid rgba(112,255,184,.18);border-radius:14px;background:rgba(10,30,22,.5);font-size:13px;color:var(--muted)"></div>`;
    const anchor=document.getElementById('pairMintWrap'); (anchor?.parentNode||pair.parentNode).insertBefore(wrap,anchor||null);
    const info=()=>{const v=pair.value;const q=v==='SOL'?'SOL':v==='USDC'?'USDC':'custom SPL/RWA';const amount=Number($('#quoteAmount')?.value||0);const price=Number($('#startPrice')?.value||0);const supply=Number($('#initialSupply')?.value||0);const implied=price>0?price*supply:0;$('#pairInfo').innerHTML=`<b style="color:#9fffc4">Pair: ${$('#tokenSymbol')?.value?.toUpperCase()||'LEAF'} / ${q}</b><br><span>Quote liquidity: ${amount||0} ${q} · Starting price: ${price||0} ${q} per token${implied?` · Implied quote value: ${implied.toLocaleString()} ${q}`:''}</span>`;};
    [pair,$('#quoteAmount'),$('#startPrice'),$('#initialSupply'),$('#tokenSymbol')].forEach(x=>x?.addEventListener('input',info)); info();
  }
  const form=$('#launchForm'); if(!form)return;
  setTimeout(renderPairUI,0);
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const total=[...document.querySelectorAll('.fee-input')].reduce((s,x)=>s+Number(x.value||0),0); if(total!==100){toast('Fee allocation must total 100%.');return;}
    if(!window.__leafConnectedAddress){toast('Connect a Solana wallet first.');$('#walletModal')?.classList.add('open');return;}
    const button=form.querySelector('.launch-btn'); if(button){button.disabled=true;button.innerHTML='◎ Building token + pair configuration…';}
    try{
      const r=await mintWithRetry();
      const cfg=pairConfig();
      localStorage.setItem('leafx_last_pair',JSON.stringify({pair:cfg.pair,quoteMint:r.pair.mint,quoteSymbol:r.pair.symbol,quoteAmount:r.pair.quoteAmount,startPrice:Number($('#startPrice')?.value||0),tokenMint:r.mint,createdAt:Date.now()}));
      form.style.display='none';$('#success')?.classList.add('show');
      const symbol=($('#tokenSymbol')?.value||'LEAF').toUpperCase(); const pairLabel=`${symbol} / ${r.pair.symbol}`;
      $('#successText').innerHTML=`<b>$${symbol}</b> SPL mint created on Solana Devnet.<br><small>Pair configuration: ${pairLabel}<br>Quote mint: ${r.pair.mint||'Native SOL'}<br>Initial quote liquidity: ${r.pair.quoteAmount}<br>Mint: ${r.mint}<br>Token account: ${r.ata}<br>Transaction: ${r.sig}</small><br><span style="color:#9fffc4">Pool creation is the next on-chain step; this screen never pretends a pool exists before it is actually created.</span>`;
      $('#txLink').href=`${EXPLORER}/tx/${r.sig}?cluster=devnet`; $('#mintLink').href=`${EXPLORER}/address/${r.mint}?cluster=devnet`; toast(`SPL token created with ${pairLabel} configuration ✓`);
    }catch(e){console.error('LeafX mint error:',e);const m=String(e?.message||e);toast(/rejected|denied|cancel/i.test(m)?'Transaction cancelled in your wallet.':m==='TRANSACTION_EXPIRED'?'Transaction expired. Please try again.':`Mint failed: ${m}`);}
    finally{if(button){button.disabled=false;button.innerHTML='◎ Create SPL mint & sign <span>↗</span>';}}
  },true);
})();
