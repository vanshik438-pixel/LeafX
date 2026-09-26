# LeafX Level 6 build audit

## Real / on-chain
- Solana Devnet RPC is used for token creation.
- Wallet signing uses Wallet Standard `solana:signAndSendTransaction` where available, with legacy browser-wallet fallback.
- SPL mint account is generated locally and partially signed by the browser.
- Mint rent is calculated from the current Devnet RPC.
- Mint initialization uses the selected decimals.
- An Associated Token Account is created for the connected wallet.
- Initial supply is converted using the selected decimals and minted on-chain.
- The transaction uses a fresh blockhash and is confirmed with its last-valid block height.
- Explorer links point to the actual Devnet transaction and mint address.
- Created launches are stored locally only after confirmed on-chain minting.

## Intentionally configured values
- Devnet RPC endpoint.
- Devnet Explorer base URL.
- Solana Devnet chain identifier.
- SDK versions loaded from esm.sh.
- Default form values such as 9 decimals and 1,000,000 supply are starter values, not claimed blockchain state.
- Default fee split is a UI starting point and is not an on-chain fee program.

## Removed from visible UI
- Fake launch cards and fake liquidity/volume figures are replaced by an empty state until a real mint exists in the browser's local launch registry.
- The hero terminal no longer claims a live LEAF/SOL market, supply, or pool.
- Unused legacy files `level3.css`, `launchpad-v3.js`, and `pairing.js` were removed.

## Still not on-chain
- Selecting SOL/USDC/custom SPL/RWA currently records a **pair intent**; it does not create an AMM pool or deposit liquidity.
- There is no fake claim that a pool exists.
- Token metadata is not yet written to a metadata program.
- Market price, volume, holders and liquidity are not fabricated; a future indexer/data layer is required for those values.

## Legacy code
`app.js` and `mint-fix.js` contain older client-side flow code kept temporarily for compatibility with the current UI. Level 6 replaces the launch form submit handler after those scripts load, so the live launch action uses the Level 6 transaction engine. These legacy files should be consolidated into a single application bundle before Mainnet production.

## Mainnet readiness blockers
1. Production RPC/provider and failover strategy.
2. Real pool creation and liquidity deposit through a supported Solana AMM.
3. Token metadata creation and validation.
4. Indexing for live prices, holders, liquidity and activity.
5. Automated tests for wallet connect/disconnect and transaction edge cases.
6. Domain/wallet-provider production verification.
7. Security review before any Mainnet deployment.
