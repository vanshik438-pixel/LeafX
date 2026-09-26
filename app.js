const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = "0xaa36a7";
const EXPLORER = "https://sepolia.etherscan.io";
const state = { step: 1, wallet: null, provider: null, signer: null, chainId: null };

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),3000); }
function shortAddress(a){ return a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—"; }
function formatBalance(v){ return Number(v).toFixed(4); }
function hasMetaMask(){ return typeof window.ethereum !== "undefined"; }
async function getProvider(){ if(!hasMetaMask()) throw new Error("MetaMask is not installed. Install the MetaMask browser extension first."); return new ethers.BrowserProvider(window.ethereum); }

function goStep(n){state.step=Math.max(1,Math.min(4,n));$$('.step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===state.step));$$('.form-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.panel)===state.step));$('#stepLabel').textContent=`STEP ${state.step} OF 4`;updateReview();updateLaunchRequirement();}
$$('.step').forEach(b=>b.addEventListener('click',()=>goStep(Number(b.dataset.step))));
$$('.next').forEach(b=>b.addEventListener('click',()=>goStep(state.step+1)));
$$('.back').forEach(b=>b.addEventListener('click',()=>goStep(state.step-1)));
$$('[data-scroll]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.scroll).scrollIntoView({behavior:'smooth'})));

function updateReview(){const handle=$('#xHandle').value||'@creator',sym=($('#tokenSymbol').value||'PAID').toUpperCase();$('#reviewHandle').textContent=handle.startsWith('@')?handle:'@'+handle;$('#reviewToken').textContent='$'+sym;$('#reviewPair').textContent=$('#pair').value;}
$('#xHandle').addEventListener('input',updateReview);$('#tokenSymbol').addEventListener('input',()=>{updateReview();$('#previewSymbol').textContent='$'+($('#tokenSymbol').value||'PAID').toUpperCase()+' / '+$('#pair').value;});$('#tokenName').addEventListener('input',()=>$('#previewName').textContent=$('#tokenName').value||'Paid');$('#pair').addEventListener('change',()=>{updateReview();$('#previewSymbol').textContent='$'+($('#tokenSymbol').value||'PAID').toUpperCase()+' / '+$('#pair').value;});

const feeInputs={creator:{input:$('[data-target="creator"]'),range:$('#creatorRange')},holders:{input:$('[data-target="holders"]'),range:$('#holdersRange')},launchpad:{input:$('[data-target="launchpad"]'),range:$('#launchpadRange')}};
function syncFee(key,val){val=Math.max(0,Math.min(100,Number(val)||0));feeInputs[key].input.value=val;feeInputs[key].range.value=val;feeInputs[key].input.closest('.fee-row').querySelector('b').textContent=val+'%';const total=Object.values(feeInputs).reduce((s,o)=>s+Number(o.input.value),0);$('#feeTotal').textContent=total+'%';$('#feeTotal').style.color=total===100?'var(--green)':'var(--danger)';}
Object.entries(feeInputs).forEach(([k,o])=>{o.input.addEventListener('input',e=>syncFee(k,e.target.value));o.range.addEventListener('input',e=>syncFee(k,e.target.value));});

async function switchToSepolia(){
 if(!hasMetaMask())throw new Error('MetaMask is not installed.');
 try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:SEPOLIA_HEX}]});}
 catch(e){if(e.code===4902){await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:SEPOLIA_HEX,chainName:'Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:['https://rpc.sepolia.org'],blockExplorerUrls:[EXPLORER]}]});}else throw e;}
 state.provider=await getProvider();
}

async function connectWallet(){
 try{
  if(!hasMetaMask()){toast('MetaMask is not installed — opening MetaMask download page.');window.open('https://metamask.io/download/','_blank','noopener');return;}
  toast('Opening MetaMask…');
  state.provider=await getProvider();
  await state.provider.send('eth_requestAccounts',[]);
  let network=await state.provider.getNetwork();
  state.chainId=Number(network.chainId);
  if(state.chainId!==SEPOLIA_CHAIN_ID){toast('Please approve the Sepolia network switch in MetaMask…');await switchToSepolia();network=await state.provider.getNetwork();state.chainId=Number(network.chainId);}
  state.signer=await state.provider.getSigner();state.wallet=await state.signer.getAddress();
  await refreshWalletUI();
  toast('MetaMask connected to Sepolia ✓');
 }catch(e){console.error(e);toast(e.code===4001?'Request rejected in MetaMask':e.message||'MetaMask connection failed');}
}

async function refreshWalletUI(){
 if(!state.provider||!state.wallet)return;
 const network=await state.provider.getNetwork();state.chainId=Number(network.chainId);
 if(state.chainId!==SEPOLIA_CHAIN_ID){$('#walletBtn').textContent='Switch to Sepolia';$('#networkStatus').innerHTML='<i></i> Wrong network';updateLaunchRequirement();return;}
 const balance=await state.provider.getBalance(state.wallet);$('#walletBtn').textContent=shortAddress(state.wallet);$('#dashAddress').textContent=shortAddress(state.wallet);$('#dashBalance').textContent=formatBalance(ethers.formatEther(balance))+' ETH';$('#dashChain').textContent='Sepolia';$('#dashNetwork').textContent='Connected via MetaMask';$('#networkStatus').innerHTML='<i></i> Sepolia connected';updateLaunchRequirement();
}
function updateLaunchRequirement(){const el=$('#walletRequirement');if(!el)return;if(!state.wallet){el.textContent='Connect MetaMask on Sepolia before launching.';el.className='wallet-requirement warning';return;}if(state.chainId!==SEPOLIA_CHAIN_ID){el.textContent='Wrong network. Click Connect Wallet to switch MetaMask to Sepolia.';el.className='wallet-requirement warning';return;}el.textContent=`Connected: ${shortAddress(state.wallet)} · Sepolia`;el.className='wallet-requirement connected';}

// IMPORTANT: the main button directly requests MetaMask. There is no fake/demo wallet step.
$('#walletBtn').addEventListener('click',async()=>{if(state.wallet){try{const n=await state.provider.getNetwork();if(Number(n.chainId)!==SEPOLIA_CHAIN_ID)await switchToSepolia();await refreshWalletUI();}catch(e){toast(e.message||'Network switch failed');}}else await connectWallet();});
$('#metaMaskConnect').addEventListener('click',connectWallet);
$('#switchSepolia').addEventListener('click',async()=>{try{await switchToSepolia();if(state.wallet)await refreshWalletUI();toast('Sepolia selected in MetaMask ✓');}catch(e){toast(e.message||'Could not switch network');}});
const walletModal=$('#walletModal');$('.modal-close').addEventListener('click',()=>walletModal.classList.remove('open'));walletModal.addEventListener('click',e=>{if(e.target===walletModal)walletModal.classList.remove('open')});

function bindEthereumEvents(){if(!hasMetaMask()||!window.ethereum.on)return;window.ethereum.on('accountsChanged',async(accounts)=>{if(!accounts.length){state.wallet=null;state.signer=null;$('#walletBtn').textContent='🦊 Connect MetaMask';$('#dashAddress').textContent='—';$('#dashBalance').textContent='—';$('#dashChain').textContent='—';$('#networkStatus').innerHTML='<i></i> Wallet not connected';updateLaunchRequirement();return;}state.provider=await getProvider();state.wallet=accounts[0];state.signer=await state.provider.getSigner();await refreshWalletUI();});window.ethereum.on('chainChanged',async()=>{state.provider=await getProvider();if(state.wallet)await refreshWalletUI();});}
if(hasMetaMask())bindEthereumEvents();

$('#launchForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const total=Object.values(feeInputs).reduce((s,o)=>s+Number(o.input.value),0);if(total!==100){toast('Fee allocation must total 100%.');return;}
 try{
  if(!state.wallet){await connectWallet();if(!state.wallet)return;}
  const network=await state.provider.getNetwork();if(Number(network.chainId)!==SEPOLIA_CHAIN_ID){await switchToSepolia();await refreshWalletUI();}
  state.signer=await state.provider.getSigner();const address=await state.signer.getAddress();toast('Confirm the real Sepolia transaction in MetaMask…');
  const tx=await state.signer.sendTransaction({to:address,value:0});
  $('#launchForm').style.display='none';$('#success').classList.add('show');$('#successText').textContent=`Transaction ${tx.hash.slice(0,10)}… was submitted from ${shortAddress(address)}.`;$('#txLink').href=`${EXPLORER}/tx/${tx.hash}`;toast('Transaction submitted to Sepolia');await tx.wait();toast('Sepolia transaction confirmed ✓');await refreshWalletUI();
 }catch(err){console.error(err);toast(err.code===4001?'Transaction rejected in MetaMask':err.reason||err.shortMessage||err.message||'Transaction failed');}
});
$('#reset').addEventListener('click',()=>{$('#launchForm').reset();$('#launchForm').style.display='block';$('#success').classList.remove('show');$('#txLink').removeAttribute('href');goStep(1);syncFee('creator',45);syncFee('holders',45);syncFee('launchpad',10);});

const launches=[{sym:'$PAID',name:'Paid',handle:'@leafdotfun',pair:'DOGE',pct:'+12.8%',tag:'trending',value:'$184K'},{sym:'$STNK',name:'STonk',handle:'@marketleaf',pair:'ETH',pct:'+8.4%',tag:'trending',value:'$92K'},{sym:'$MINT',name:'Mint',handle:'@mintcreator',pair:'SOL',pct:'+21.6%',tag:'creator',value:'$61K'},{sym:'$LOOP',name:'Loop',handle:'@loopx',pair:'USDC',pct:'+5.2%',tag:'creator',value:'$44K'},{sym:'$BUD',name:'Bud',handle:'@budsocial',pair:'DOGE',pct:'+17.1%',tag:'trending',value:'$77K'},{sym:'$NOVA',name:'Nova',handle:'@novaonx',pair:'ETH',pct:'+3.7%',tag:'creator',value:'$31K'}];
function card(x,i){return `<article class="launch-card"><div class="launch-head"><div class="mini-coin">${x.sym.slice(1,2)}</div><span class="trend">${x.pct}</span></div><h3>${x.sym} · ${x.name}</h3><div class="handle">${x.handle} · paired with ${x.pair}</div><div class="spark"><svg viewBox="0 0 260 55" preserveAspectRatio="none"><path d="M0 46 ${[...Array(10)].map((_,j)=>`L${j*29} ${44-Math.sin(j+i)*12-j*2}`).join(' ')} L290 7" fill="none" stroke="#38df8d" stroke-width="2"/></svg></div><div class="launch-meta"><span>LIQUIDITY ${x.value}</span><span>TESTNET</span></div></article>`}
function render(filter='all'){$('#launchGrid').innerHTML=launches.filter(x=>filter==='all'||x.tag===filter).map(card).join('')}
render();$$('.filter').forEach(b=>b.addEventListener('click',()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.filter)}));

const canvas=$('#chart'),ctx=canvas.getContext('2d');function drawChart(){const dpr=devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.beginPath();const vals=[.76,.72,.74,.68,.69,.63,.58,.62,.55,.57,.49,.52,.45,.47,.42,.44,.37,.38,.29,.31,.26,.21,.22,.18,.12,.13];vals.forEach((v,i)=>{const x=i*(w/(vals.length-1)),y=v*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#35e28a';ctx.lineWidth=2;ctx.stroke()}
new ResizeObserver(drawChart).observe(canvas);drawChart();
$('#themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light');const light=document.body.classList.contains('light');const vals=light?['#f3f7f4','#fff','#f0f6f2','#0a1a11','#607168','#d5e1da']:['#06100b','#0b1711','#0f1e16','#f3faf5','#9eaea4','#203127'];['--bg','--panel','--panel2','--text','--muted','--line'].forEach((k,i)=>document.documentElement.style.setProperty(k,vals[i]));});

(async()=>{try{if(!hasMetaMask())return;state.provider=await getProvider();const accounts=await state.provider.send('eth_accounts',[]);if(accounts.length){state.wallet=accounts[0];state.signer=await state.provider.getSigner();await refreshWalletUI();}}catch(e){console.debug('Wallet restore skipped',e);}})();
