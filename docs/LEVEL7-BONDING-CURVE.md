# LeafX Level 7 — Bonding Curve Specification

LeafX Level 7 is a Devnet-first bonding-curve trading protocol inspired by the general launch → curve → graduation → AMM pattern used by token launchpads. It is an independent implementation and does not copy another protocol's code or proprietary parameters.

## State model

A launch stores:

- token mint
- quote mint / SOL mode
- creator
- virtual token reserve
- virtual quote reserve
- real token reserve
- real quote reserve
- total supply
- graduation threshold
- collected fees
- status: Active | Graduated | Paused

The authoritative values live in a program account. Frontend values are previews only.

## Pricing

For a constant-product curve, use `k = virtual_token_reserve * virtual_quote_reserve`.

For a buy that adds quote amount `q`:

`newQuote = quoteReserve + q`

`newToken = k / newQuote`

`tokensOut = tokenReserve - newToken`

For a sell of `t` tokens:

`newToken = tokenReserve + t`

`newQuote = k / newToken`

`quoteOut = quoteReserve - newQuote`

All production calculations must use integer arithmetic with explicit decimal scaling and checked overflow. Fees are applied according to immutable launch configuration before reserve updates.

## Program instructions

The planned Anchor program exposes:

1. `initialize_launch`
2. `buy`
3. `sell`
4. `graduate`
5. `pause_launch` / `resume_launch` under tightly controlled authority
6. `close_launch` only where the state machine permits it

The program must validate every mint, token account, PDA, authority and reserve account. No client-supplied price may be trusted.

## Graduation

Graduation is a state transition, not a frontend flag. Once the configured threshold is reached, the program prevents additional curve trades according to the protocol design and starts the migration process.

Migration should atomically or safely establish the destination AMM pool and transfer the designated liquidity. The exact AMM integration must be implemented and tested separately before being enabled.

## Events

Emit compact Anchor events for launch creation, buy, sell, fee collection and graduation. Events are for indexing; balances and permissions remain in program accounts because Solana documentation warns that RPC logs can be truncated.

## Security requirements

- No floating-point arithmetic on-chain.
- No hardcoded production fees or graduation numbers.
- No arbitrary token-program substitution.
- Verify token program IDs and account ownership.
- Check slippage limits supplied by the user.
- Check minimum output / maximum input.
- Reject stale or invalid state.
- Use PDA-controlled vault authorities.
- Keep upgrade authority documented and secured.
- Test every instruction against adversarial account substitutions and arithmetic edge cases.

## Devnet rollout

Phase 1: local program tests.
Phase 2: Devnet deployment.
Phase 3: frontend integration with simulated quotes.
Phase 4: real Devnet buy/sell transactions.
Phase 5: graduation and AMM migration on Devnet.
Phase 6: independent review/audit and only then consider Mainnet.

The UI must never display a pool, volume, price, holder count, or graduation status unless it can be derived from confirmed on-chain state or an explicitly labeled estimate.