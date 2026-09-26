# LeafX Curve Program — Devnet

This is the first on-chain implementation of the LeafX bonding-curve engine.

## Scope

The program currently implements:

- `initialize_launch`
- `buy`
- `sell`
- `graduate`
- PDA-owned token vault authority
- constant-product virtual reserves
- protocol fee cap
- user-provided slippage limits
- checked `u64/u128` arithmetic
- trade and graduation events

The curve is **SOL-paired in this first Devnet implementation**. USDC and arbitrary SPL/RWA quote assets are intentionally not enabled in this program yet; they require explicit quote-vault/account validation and should be added as a separate, tested instruction set.

## Important deployment requirement

`declare_id!` currently contains a generated placeholder program address. Generate a dedicated deploy keypair with Anchor/solana tooling and replace the program ID before deployment. Never commit the deploy keypair or any wallet secret.

## Launch initialization

The client must create a token vault whose:

- mint equals the launch mint
- owner/authority is the LeafX launch PDA

The client must then fund that vault with the real token inventory before opening trading. The program verifies the vault mint and owner on every trade.

PDAs are deterministic addresses with no private key; the program can sign for its PDA during CPIs. citeturn0search0turn0search1

## Security model

The program does not trust frontend price or reserve values. Buy/sell output is calculated from on-chain curve state. Users provide a minimum acceptable output for slippage protection. Token transfers use the Token Program through CPI, with the launch PDA signing where required. citeturn0search2

## Graduation

When the configured graduation SOL threshold is reached (or the real token reserve is exhausted), the launch enters `Graduated`. Calling `graduate` moves it to `Migrating` as an explicit boundary for the future AMM migration instruction.

**AMM migration is not yet implemented.** The frontend must not display a migrated pool as live until a real AMM transaction has completed.
