const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const state = { step: 1, wallet: null };

function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast = setTimeout(()=>t.classList.remove("show"), 2200);
}

function goStep(n){
  state.step = Math.max(1, Math.min(4,n));
  $$(".step").forEach(x=>x.classList.toggle("active", Number(x.dataset.step)===state.step));
  $$(".form-step").forEach(x=>x.classList.toggle("active", Number(x.dataset.panel)===state.step));
  $("#stepLabel").textContent = `STEP ${state.step} OF 4`;
  updateReview();
}
$$(".step").forEach(b=>b.addEventListener("click",()=>goStep(Number(b.dataset.step))));
$$(".next").forEach(b=>b.addEventListener("click",()=>goStep(state.step+1)));
$$(".back").forEach(b=>b.addEventListener("click",()=>goStep(state.step-1)));
$$("[data-scroll]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.scroll).scrollIntoView({behavior:"smooth"})));

function updateReview(){
  const handle=$("#xHandle").value || "@creator";
  const sym=($("#tokenSymbol").value || "PAID").toUpperCase();
  $("#reviewHandle").textContent=handle.startsWith("@")?handle:"@"+handle;
  $("#reviewToken").textContent="$"+sym;
  $("#reviewPair").textContent=$("#pair").value;
}
$("#xHandle").addEventListener("input",updateReview);
$("#tokenSymbol").addEventListener("input",()=>{ updateReview(); $("#previewSymbol").textContent="$"+($("#tokenSymbol").value||"PAID").toUpperCase()+" / "+$("#pair").value; });
$("#tokenName").addEventListener("input",()=>$("#previewName").textContent=$("#tokenName").value||"Paid");
$("#pair").addEventListener("change",()=>{updateReview();$("#previewSymbol").textContent="$"+($("#tokenSymbol").value||"PAID").toUpperCase()+" / "+$("#pair").value;});

const feeInputs = {
  creator: {input: $('[data-target="creator"]'), range: $("#creatorRange")},
  holders: {input: $('[data-target="holders"]'), range: $("#holdersRange")},
  launchpad: {input: $('[data-target="launchpad"]'), range: $("#launchpadRange")}
};
function syncFee(key, val){
  val = Math.max(0,Math.min(100,Number(val)||0));
  feeInputs[key].input.value=val; feeInputs[key].range.value=val;
  feeInputs[key].input.closest(".fee-row").querySelector("b").textContent=val+"%";
  const total=Object.values(feeInputs).reduce((s,o)=>s+Number(o.input.value),0);
  $("#feeTotal").textContent=total+"%";
  $("#feeTotal").style.color=total===100?"var(--green)":"var(--danger)";
}
Object.entries(feeInputs).forEach(([k,o])=>{
  o.input.addEventListener("input",e=>syncFee(k,e.target.value));
  o.range.addEventListener("input",e=>syncFee(k,e.target.value));
});

$("#launchForm").addEventListener("submit",e=>{
  e.preventDefault();
  const total=Object.values(feeInputs).reduce((s,o)=>s+Number(o.input.value),0);
  if(total!==100){toast("Fee allocation must total 100%."); return;}
  if(!$("#lockCheck").checked){toast("Enable the on-chain lock to continue.");return;}
  $("#launchForm").style.display="none"; $("#success").classList.add("show");
  $("#successText").textContent=`$${($("#tokenSymbol").value||"PAID").toUpperCase()} is now shown as a demo launch.`;
  toast("Demo launch created successfully");
});
$("#reset").addEventListener("click",()=>{ $("#launchForm").reset(); $("#launchForm").style.display="block"; $("#success").classList.remove("show"); goStep(1); syncFee("creator",45);syncFee("holders",45);syncFee("launchpad",10); });

const walletModal=$("#walletModal");
$("#walletBtn").addEventListener("click",()=>walletModal.classList.add("open"));
$(".modal-close").addEventListener("click",()=>walletModal.classList.remove("open"));
walletModal.addEventListener("click",e=>{if(e.target===walletModal) walletModal.classList.remove("open")});
$$(".wallet-option").forEach(b=>b.addEventListener("click",()=>{
  state.wallet=b.dataset.wallet; $("#walletBtn").textContent="0x7A…41F2"; walletModal.classList.remove("open"); toast(state.wallet+" connected (demo)");
}));

const launches=[
 {sym:"$PAID",name:"Paid",handle:"@leafdotfun",pair:"DOGE",pct:"+12.8%",tag:"trending",value:"$184K"},
 {sym:"$STNK",name:"STonk",handle:"@marketleaf",pair:"ETH",pct:"+8.4%",tag:"trending",value:"$92K"},
 {sym:"$MINT",name:"Mint",handle:"@mintcreator",pair:"SOL",pct:"+21.6%",tag:"creator",value:"$61K"},
 {sym:"$LOOP",name:"Loop",handle:"@loopx",pair:"USDC",pct:"+5.2%",tag:"creator",value:"$44K"},
 {sym:"$BUD",name:"Bud",handle:"@budsocial",pair:"DOGE",pct:"+17.1%",tag:"trending",value:"$77K"},
 {sym:"$NOVA",name:"Nova",handle:"@novaonx",pair:"ETH",pct:"+3.7%",tag:"creator",value:"$31K"}
];
function card(x,i){
 return `<article class="launch-card" data-kind="${x.tag}">
   <div class="launch-head"><div class="mini-coin">${x.sym.slice(1,2)}</div><span class="trend">${x.pct}</span></div>
   <h3>${x.sym} · ${x.name}</h3><div class="handle">${x.handle} · paired with ${x.pair}</div>
   <div class="spark"><svg viewBox="0 0 260 55" preserveAspectRatio="none"><path d="M0 46 ${[...Array(10)].map((_,j)=>`L${j*29} ${44-Math.sin(j+i)*12-j*2}`).join(" ")} L290 7" fill="none" stroke="#38df8d" stroke-width="2"/></svg></div>
   <div class="launch-meta"><span>LIQUIDITY ${x.value}</span><span>LOCKED ✓</span></div>
 </article>`
}
function render(filter="all"){ $("#launchGrid").innerHTML=launches.filter(x=>filter==="all"||x.tag===filter).map(card).join("")}
render();
$$(".filter").forEach(b=>b.addEventListener("click",()=>{ $$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render(b.dataset.filter)}));

const canvas=$("#chart"), ctx=canvas.getContext("2d");
function drawChart(){
 const dpr=devicePixelRatio||1, w=canvas.clientWidth, h=canvas.clientHeight; canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
 ctx.clearRect(0,0,w,h);ctx.beginPath();
 const vals=[.76,.72,.74,.68,.69,.63,.58,.62,.55,.57,.49,.52,.45,.47,.42,.44,.37,.38,.29,.31,.26,.21,.22,.18,.12,.13];
 vals.forEach((v,i)=>{const x=i*(w/(vals.length-1));const y=v*h; i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#35e28a";ctx.lineWidth=2;ctx.stroke();
}
new ResizeObserver(drawChart).observe(canvas); drawChart();

$("#themeBtn").addEventListener("click",()=>{
 document.body.classList.toggle("light");
 if(document.body.classList.contains("light")){
   document.documentElement.style.setProperty("--bg","#f3f7f4");document.documentElement.style.setProperty("--panel","#fff");document.documentElement.style.setProperty("--panel2","#f0f6f2");document.documentElement.style.setProperty("--text","#0a1a11");document.documentElement.style.setProperty("--muted","#607168");document.documentElement.style.setProperty("--line","#d5e1da");
 }else{
   document.documentElement.style.setProperty("--bg","#06100b");document.documentElement.style.setProperty("--panel","#0b1711");document.documentElement.style.setProperty("--panel2","#0f1e16");document.documentElement.style.setProperty("--text","#f3faf5");document.documentElement.style.setProperty("--muted","#9eaea4");document.documentElement.style.setProperty("--line","#203127");
 }
});
