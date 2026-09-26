use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer as SolTransfer};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

// Generated placeholder program id. Replace it with the deployed Devnet program keypair
// before deployment; never reuse a production keypair in source control.
declare_id!("DK4Bd9x8aSK2tWuCVbRk7EEhSfZLRXGhimPYz6NFXMJJ");

const BPS: u128 = 10_000;
const MAX_FEE_BPS: u64 = 1_000;

#[program]
pub mod leafx_curve {
    use super::*;

    pub fn initialize_launch(
        ctx: Context<InitializeLaunch>,
        virtual_sol_reserve: u64,
        virtual_token_reserve: u64,
        real_token_reserve: u64,
        graduation_sol: u64,
        fee_bps: u16,
    ) -> Result<()> {
        require!(virtual_sol_reserve > 0, CurveError::InvalidReserve);
        require!(virtual_token_reserve > 0, CurveError::InvalidReserve);
        require!(real_token_reserve > 0, CurveError::InvalidReserve);
        require!(graduation_sol > 0, CurveError::InvalidGraduation);
        require!((fee_bps as u64) <= MAX_FEE_BPS, CurveError::InvalidFee);
        require!(real_token_reserve <= virtual_token_reserve, CurveError::InvalidReserve);

        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.mint = ctx.accounts.mint.key();
        launch.token_vault = ctx.accounts.token_vault.key();
        launch.virtual_sol_reserve = virtual_sol_reserve;
        launch.virtual_token_reserve = virtual_token_reserve;
        launch.real_token_reserve = real_token_reserve;
        launch.real_sol_reserve = 0;
        launch.graduation_sol = graduation_sol;
        launch.fee_bps = fee_bps;
        launch.bump = ctx.bumps.launch;
        launch.status = LaunchStatus::Active;
        launch.total_buys = 0;
        launch.total_sells = 0;
        launch.total_volume_sol = 0;
        launch.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn buy(ctx: Context<Trade>, sol_in: u64, min_tokens_out: u64) -> Result<()> {
        require!(sol_in > 0, CurveError::ZeroAmount);
        require!(ctx.accounts.launch.status == LaunchStatus::Active, CurveError::NotActive);

        let (tokens_out, fee) = quote_buy(
            ctx.accounts.launch.virtual_sol_reserve,
            ctx.accounts.launch.virtual_token_reserve,
            sol_in,
            ctx.accounts.launch.fee_bps,
        )?;
        require!(tokens_out >= min_tokens_out, CurveError::SlippageExceeded);
        require!(tokens_out <= ctx.accounts.launch.real_token_reserve, CurveError::InsufficientTokens);

        let transfer = SolTransfer {
            from: ctx.accounts.trader.to_account_info(),
            to: ctx.accounts.launch.to_account_info(),
        };
        system_program::transfer(CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer), sol_in)?;

        let signer_seeds: &[&[&[u8]]] = &[&[b"launch", ctx.accounts.mint.key().as_ref(), &[ctx.accounts.launch.bump]]];
        let token_cpi = TransferChecked {
            from: ctx.accounts.token_vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.trader_token_account.to_account_info(),
            authority: ctx.accounts.launch.to_account_info(),
        };
        token_interface::transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), token_cpi, signer_seeds),
            tokens_out,
            ctx.accounts.mint.decimals,
        )?;

        let launch = &mut ctx.accounts.launch;
        launch.virtual_sol_reserve = launch.virtual_sol_reserve.checked_add(sol_in).ok_or(CurveError::MathOverflow)?;
        launch.virtual_token_reserve = launch.virtual_token_reserve.checked_sub(tokens_out).ok_or(CurveError::MathOverflow)?;
        launch.real_token_reserve = launch.real_token_reserve.checked_sub(tokens_out).ok_or(CurveError::MathOverflow)?;
        launch.real_sol_reserve = launch.real_sol_reserve.checked_add(sol_in.saturating_sub(fee)).ok_or(CurveError::MathOverflow)?;
        launch.total_buys = launch.total_buys.checked_add(1).ok_or(CurveError::MathOverflow)?;
        launch.total_volume_sol = launch.total_volume_sol.checked_add(sol_in).ok_or(CurveError::MathOverflow)?;
        if launch.real_sol_reserve >= launch.graduation_sol || launch.real_token_reserve == 0 {
            launch.status = LaunchStatus::Graduated;
        }
        emit!(TradeEvent { launch: launch.key(), trader: ctx.accounts.trader.key(), side: TradeSide::Buy, sol_amount: sol_in, token_amount: tokens_out, fee });
        Ok(())
    }

    pub fn sell(ctx: Context<Trade>, tokens_in: u64, min_sol_out: u64) -> Result<()> {
        require!(tokens_in > 0, CurveError::ZeroAmount);
        require!(ctx.accounts.launch.status == LaunchStatus::Active, CurveError::NotActive);

        let (sol_out, fee) = quote_sell(
            ctx.accounts.launch.virtual_sol_reserve,
            ctx.accounts.launch.virtual_token_reserve,
            tokens_in,
            ctx.accounts.launch.fee_bps,
        )?;
        require!(sol_out >= min_sol_out, CurveError::SlippageExceeded);
        require!(sol_out <= ctx.accounts.launch.real_sol_reserve, CurveError::InsufficientSol);

        let token_cpi = TransferChecked {
            from: ctx.accounts.trader_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            authority: ctx.accounts.trader.to_account_info(),
        };
        token_interface::transfer_checked(CpiContext::new(ctx.accounts.token_program.to_account_info(), token_cpi), tokens_in, ctx.accounts.mint.decimals)?;

        let signer_seeds: &[&[&[u8]]] = &[&[b"launch", ctx.accounts.mint.key().as_ref(), &[ctx.accounts.launch.bump]]];
        let transfer = SolTransfer { from: ctx.accounts.launch.to_account_info(), to: ctx.accounts.trader.to_account_info() };
        system_program::transfer(CpiContext::new_with_signer(ctx.accounts.system_program.to_account_info(), transfer, signer_seeds), sol_out)?;

        let launch = &mut ctx.accounts.launch;
        launch.virtual_sol_reserve = launch.virtual_sol_reserve.checked_sub(sol_out).ok_or(CurveError::MathOverflow)?;
        launch.virtual_token_reserve = launch.virtual_token_reserve.checked_add(tokens_in).ok_or(CurveError::MathOverflow)?;
        launch.real_token_reserve = launch.real_token_reserve.checked_add(tokens_in).ok_or(CurveError::MathOverflow)?;
        launch.real_sol_reserve = launch.real_sol_reserve.checked_sub(sol_out).ok_or(CurveError::MathOverflow)?;
        launch.total_sells = launch.total_sells.checked_add(1).ok_or(CurveError::MathOverflow)?;
        launch.total_volume_sol = launch.total_volume_sol.checked_add(sol_out).ok_or(CurveError::MathOverflow)?;
        emit!(TradeEvent { launch: launch.key(), trader: ctx.accounts.trader.key(), side: TradeSide::Sell, sol_amount: sol_out, token_amount: tokens_in, fee });
        Ok(())
    }

    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        require!(ctx.accounts.launch.status == LaunchStatus::Graduated, CurveError::NotGraduated);
        ctx.accounts.launch.status = LaunchStatus::Migrating;
        emit!(GraduationEvent { launch: ctx.accounts.launch.key(), sol_reserve: ctx.accounts.launch.real_sol_reserve, token_reserve: ctx.accounts.launch.real_token_reserve });
        Ok(())
    }
}

fn quote_buy(vs: u64, vt: u64, input: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = ((input as u128) * fee_bps as u128 / BPS) as u64;
    let net = input.checked_sub(fee).ok_or(CurveError::MathOverflow)? as u128;
    let k = (vs as u128).checked_mul(vt as u128).ok_or(CurveError::MathOverflow)?;
    let new_vs = (vs as u128).checked_add(net).ok_or(CurveError::MathOverflow)?;
    let new_vt = k.checked_div(new_vs).ok_or(CurveError::MathOverflow)?;
    let out = (vt as u128).checked_sub(new_vt).ok_or(CurveError::MathOverflow)?;
    require!(out <= u64::MAX as u128, CurveError::MathOverflow);
    Ok((out as u64, fee))
}

fn quote_sell(vs: u64, vt: u64, input: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let k = (vs as u128).checked_mul(vt as u128).ok_or(CurveError::MathOverflow)?;
    let new_vt = (vt as u128).checked_add(input as u128).ok_or(CurveError::MathOverflow)?;
    let new_vs = k.checked_div(new_vt).ok_or(CurveError::MathOverflow)?;
    let gross = (vs as u128).checked_sub(new_vs).ok_or(CurveError::MathOverflow)?;
    let fee = gross.checked_mul(fee_bps as u128).ok_or(CurveError::MathOverflow)? / BPS;
    let out = gross.checked_sub(fee).ok_or(CurveError::MathOverflow)?;
    require!(out <= u64::MAX as u128 && fee <= u64::MAX as u128, CurveError::MathOverflow);
    Ok((out as u64, fee as u64))
}

#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(mut)] pub creator: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", mint.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,
    #[account(mut, constraint = token_vault.mint == mint.key(), constraint = token_vault.owner == launch.key())]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)] pub trader: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"launch", mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Account<'info, Launch>,
    #[account(mut, address = launch.token_vault, constraint = token_vault.mint == mint.key(), constraint = token_vault.owner == launch.key())]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = trader_token_account.mint == mint.key(), constraint = trader_token_account.owner == trader.key())]
    pub trader_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    pub creator: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"launch", mint.key().as_ref()], bump = launch.bump, has_one = mint, has_one = creator)]
    pub launch: Account<'info, Launch>,
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub token_vault: Pubkey,
    pub virtual_sol_reserve: u64,
    pub virtual_token_reserve: u64,
    pub real_sol_reserve: u64,
    pub real_token_reserve: u64,
    pub graduation_sol: u64,
    pub total_volume_sol: u64,
    pub total_buys: u64,
    pub total_sells: u64,
    pub created_at: i64,
    pub fee_bps: u16,
    pub bump: u8,
    pub status: LaunchStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LaunchStatus { Active, Graduated, Migrating }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TradeSide { Buy, Sell }

#[event]
pub struct TradeEvent { pub launch: Pubkey, pub trader: Pubkey, pub side: TradeSide, pub sol_amount: u64, pub token_amount: u64, pub fee: u64 }

#[event]
pub struct GraduationEvent { pub launch: Pubkey, pub sol_reserve: u64, pub token_reserve: u64 }

#[error_code]
pub enum CurveError {
    #[msg("Invalid reserve configuration")] InvalidReserve,
    #[msg("Invalid graduation target")] InvalidGraduation,
    #[msg("Fee is outside the permitted protocol range")] InvalidFee,
    #[msg("Amount must be greater than zero")] ZeroAmount,
    #[msg("Launch is not active")] NotActive,
    #[msg("Output amount is below the user's minimum")] SlippageExceeded,
    #[msg("Curve does not have enough tokens")] InsufficientTokens,
    #[msg("Curve does not have enough SOL")] InsufficientSol,
    #[msg("Arithmetic overflow or invalid division")] MathOverflow,
    #[msg("Launch has not reached graduation")] NotGraduated,
}
