/* LeafX Pairing & Pool UI
 * Safe-by-default: validates quote mint addresses and prepares pair data.
 * Actual pool creation must be performed through a deployed/selected AMM program.
 */
(() => {
  const PAIRS = {
    SOL: { label: 'SOL', kind: 'native', mint: null, decimals: 9 },
    USDC: { label: 'USDC', kind: 'spl', mint: '', decimals: 6 },
  };
  const $ = (s) => document.querySelector(s);
  const toast = (m) => window.toast ? window.toast(m) : alert(m);
  const state = { quote: null, quoteMint: null, quoteDecimals: null, quoteSymbol: null };

  function isBase58(s) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || '').trim()); }
  function show(id, on) { const e = $(id); if (e) e.style.display = on ? 'block' : 'none'; }
  function updatePairUI() {
    const type = $('#pair');
    if (!type) return;
    const v = type.value;
    show('#pairMintWrap', v === 'SPL' || v === 'RWA');
    show('#rwaFields', v === 'RWA');
    const label = $('#pairTypeLabel');
    if (label) label.textContent = v === 'SOL' ? 'SOL' : v === 'USDC' ? 'USDC' : v === 'RWA' ? 'Tokenized RWA' : 'SPL token';
    updatePrice();
  }
  async function inspectMint() {
    const mint = $('#pairMint')?.value?.trim();
    if (!mint) return;
    if (!isBase58(mint)) return toast('Enter a valid Solana mint address.');
    try {
      if (!window.__leafxState?.connection || !window.__leafxState?.web3) return toast('Connect/load Solana first.');
      const pk = new window.__leafxState.web3.PublicKey(mint);
      const info = await window.__leafxState.connection.getParsedAccountInfo(pk, 'confirmed');
      if (!info?.value) throw Error('Mint account was not found on this network.');
      const data = info.value.data?.parsed?.info;
      if (!data?.decimals && data?.decimals !== 0) throw Error('Address is not a supported SPL mint.');
      state.quoteMint = mint; state.quoteDecimals = data.decimals;
      state.quoteSymbol = $('#pairSymbol')?.value?.trim() || 'SPL';
      $('#pairDetected').textContent = `Detected mint · ${mint.slice(0,4)}…${mint.slice(-4)} · ${data.decimals} decimals`;
      $('#pairDetected').classList.add('show');
      updatePrice();
    } catch (e) { state.quoteMint = null; $('#pairDetected')?.classList.remove('show'); toast(e.message || 'Could not inspect mint.'); }
  }
  function updatePrice() {
    const supply = Number($('#initialSupply')?.value || 0);
    const quoteAmount = Number($('#initialQuote')?.value || 0);
    const price = supply > 0 ? quoteAmount / supply : 0;
    const out = $('#startingPrice');
    if (out) out.textContent = price ? price.toPrecision(8) : '—';
    const sym = $('#pair')?.value === 'SOL' ? 'SOL' : ($('#pairSymbol')?.value || 'USDC');
    const pair = $('#pairPreview');
    if (pair) pair.textContent = `LEAF / ${sym}`;
    const rp = $('#reviewPair'); if (rp) rp.textContent = `LEAF / ${sym}`;
  }
  function wire() {
    const pair = $('#pair'); if (!pair) return;
    pair.addEventListener('change', updatePairUI);
    ['#initialSupply','#initialQuote','#pairSymbol'].forEach(s => $(s)?.addEventListener('input', updatePrice));
    $('#inspectPairMint')?.addEventListener('click', inspectMint);
    updatePairUI();
  }
  window.LeafXPairing = {
    getConfig() {
      const type = $('#pair')?.value || 'SOL';
      if (type === 'SOL') return { type, symbol: 'SOL', mint: null, decimals: 9 };
      const mint = $('#pairMint')?.value?.trim();
      if (!isBase58(mint)) throw Error('A valid quote-token mint address is required.');
      return { type, symbol: $('#pairSymbol')?.value?.trim() || (type === 'USDC' ? 'USDC' : 'SPL'), mint, decimals: state.quoteDecimals };
    },
    updatePrice
  };
  window.addEventListener('load', wire);
})();
