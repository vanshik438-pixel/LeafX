(() => {
  const RPC = 'https://api.devnet.solana.com';
  const EXPLORER = 'https://explorer.solana.com';
  const CHAIN = 'solana:devnet';

  const $ = (s) => document.querySelector(s);
  const toast = (msg) => {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__leafMintToast);
    window.__leafMintToast = setTimeout(() => t.classList.remove('show'), 5000);
  };

  async function libs() {
    const [web3, spl, std] = await Promise.all([
      import('https://esm.sh/@solana/web3.js@1.98.4'),
      import('https://esm.sh/@solana/spl-token@0.4.14'),
      import('https://esm.sh/@wallet-standard/app@1.1.0')
    ]);
    return { web3, spl, std };
  }

  function walletName() {
    const text = $('#dashNetwork')?.textContent || '';
    const m = text.match(/Connected via (.+)$/);
    return m ? m[1].trim() : '';
  }

  function providerFor(name) {
    if (name === 'Phantom' && window.phantom?.solana) return window.phantom.solana;
    if (name === 'Solflare' && window.solflare) return window.solflare;
    if (name === 'Backpack' && window.backpack?.solana) return window.backpack.solana;
    if (name === 'Brave Wallet' && window.braveSolana) return window.braveSolana;
    if (name === 'Coinbase Wallet' && window.coinbaseSolana) return window.coinbaseSolana;
    return null;
  }

  async function standardWallet(name, std) {
    const registry = std.getWallets();
    const wallet = [...registry.get()].find(w => w.name === name) || [...registry.get()].find(w => w.chains?.includes(CHAIN));
    if (!wallet) return null;
    let accounts = wallet.accounts || [];
    if (!accounts.length) {
      const connect = wallet.features?.['standard:connect']?.connect;
      if (connect) accounts = (await connect()).accounts || [];
    }
    const account = accounts.find(a => a.chains?.includes(CHAIN)) || accounts[0];
    return account ? { wallet, account } : null;
  }

  async function sendWithWallet(tx, name, std) {
    const direct = providerFor(name);
    if (direct?.signAndSendTransaction) {
      const result = await direct.signAndSendTransaction(tx);
      return result?.signature || result?.txid || result?.result || result;
    }

    const found = await standardWallet(name, std);
    if (!found) throw new Error('LeafX could not recover the connected wallet. Please disconnect and reconnect it.');
    const feature = found.wallet.features?.['solana:signAndSendTransaction'];
    if (!feature) throw new Error(`${name} does not support Solana transaction signing in this browser.`);

    const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const output = await feature.signAndSendTransaction({
      transaction: bytes,
      account: found.account,
      chain: CHAIN
    });
    const sig = output?.[0]?.signature;
    if (!sig) throw new Error('The wallet returned no transaction signature.');
    if (typeof sig === 'string') return sig;

    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = 0n;
    for (const byte of sig) n = (n << 8n) + BigInt(byte);
    let out = '';
    while (n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; }
    for (const byte of sig) { if (byte === 0) out = '1' + out; else break; }
    return out || '1';
  }

  async function mint() {
    const { web3, spl, std } = await libs();
    const connection = new web3.Connection(RPC, 'confirmed');
    const name = walletName();
    const provider = providerFor(name);
    const publicKey = provider?.publicKey?.toString?.();

    if (!publicKey) {
      const found = await standardWallet(name, std);
      if (!found?.account?.address) throw new Error('Wallet account not available. Reconnect your wallet and try again.');
    }

    const payerAddress = publicKey || (await standardWallet(name, std))?.account?.address;
    const payer = new web3.PublicKey(payerAddress);
    const balance = await connection.getBalance(payer);

    const mintKeypair = web3.Keypair.generate();
    const mintRent = await connection.getMinimumBalanceForRentExemption(spl.MINT_SIZE);
    const latest = await connection.getLatestBlockhash('confirmed');
    const tx = new web3.Transaction({ recentBlockhash: latest.blockhash, feePayer: payer });

    tx.add(web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: spl.MINT_SIZE,
      lamports: mintRent,
      programId: spl.TOKEN_PROGRAM_ID
    }));
    tx.add(spl.createInitializeMintInstruction(
      mintKeypair.publicKey,
      9,
      payer,
      payer,
      spl.TOKEN_PROGRAM_ID
    ));

    // The mint account is generated locally, so its signature must be attached
    // before the wallet signs as the fee payer. This is the normal SPL mint flow.
    tx.partialSign(mintKeypair);

    const feeInfo = await connection.getFeeForMessage(tx.compileMessage(), 'confirmed');
    const fee = feeInfo.value ?? 5000;
    const required = mintRent + fee + 10000;
    if (balance < required) {
      throw new Error(`Not enough Devnet SOL. You need about ${(required / 1e9).toFixed(5)} SOL, but this wallet has ${(balance / 1e9).toFixed(5)} SOL. Get Devnet SOL and try again.`);
    }

    const signature = await sendWithWallet(tx, name, std);
    const sig = typeof signature === 'string' ? signature : String(signature);
    await connection.confirmTransaction({
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight
    }, 'confirmed');

    return { sig, mint: mintKeypair.publicKey.toBase58() };
  }

  const form = $('#launchForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const wallet = walletName();
      if (!wallet) {
        toast('Connect a Solana wallet first.');
        $('#walletModal')?.classList.add('open');
        return;
      }

      toast(`Preparing a real SPL mint for ${wallet}…`);
      const result = await mint();

      form.style.display = 'none';
      $('#success')?.classList.add('show');
      const symbol = ($('#tokenSymbol')?.value || 'LEAF').toUpperCase();
      $('#successText').innerHTML = `<b>$${symbol}</b> SPL mint created on Solana Devnet.<br><small>Mint: ${result.mint}<br>Transaction: ${result.sig}</small>`;
      $('#txLink').href = `${EXPLORER}/tx/${result.sig}?cluster=devnet`;
      $('#mintLink').href = `${EXPLORER}/address/${result.mint}?cluster=devnet`;
      toast('SPL mint confirmed on Devnet ✓');
    } catch (error) {
      console.error('LeafX mint error:', error);
      const message = error?.message || String(error);
      toast(message.includes('User rejected') || message.includes('rejected') ? 'Transaction was rejected in your wallet.' : `Mint failed: ${message}`);
    }
  }, true);
})();
