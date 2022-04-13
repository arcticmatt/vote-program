use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const VOTE_MARKER: &str = "vote_marker";
const VOTE_TOPIC: &str = "vote_topic";
pub const MAX_NAME_LENGTH: usize = 32;

#[program]
pub mod vote_program {
    use super::*;

    pub fn create_vote_topic<'info>(ctx: Context<CreateVoteTopic>, name: String) -> Result<()> {
        let creator = &ctx.accounts.creator;
        let vote_topic = &mut ctx.accounts.vote_topic;

        if name.len() > MAX_NAME_LENGTH {
            return Err(ErrorCode::NameTooLong.into());
        }

        vote_topic.downvotes = 0;
        vote_topic.upvotes = 0;

        vote_topic.creator = creator.key();
        vote_topic.name = name;

        Ok(())
    }

    pub fn vote<'info>(ctx: Context<Vote>, _name: String, upvote: bool) -> Result<()> {
        let vote_topic = &mut ctx.accounts.vote_topic;

        if upvote {
            vote_topic.upvotes += 1;
        } else {
            vote_topic.downvotes += 1;
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateVoteTopic<'info> {
    #[account(mut)]
    creator: Signer<'info>,

    #[account(init, payer = creator, space = VOTE_TOPIC_SIZE, seeds=[VOTE_TOPIC.as_bytes(), creator.key().as_ref(), name.as_bytes()], bump)]
    vote_topic: Account<'info, VoteTopic>,

    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Vote<'info> {
    #[account(mut)]
    voter: Signer<'info>,

    /// CHECK: no validation necessary
    creator: UncheckedAccount<'info>,

    #[account(mut, seeds=[VOTE_TOPIC.as_bytes(), creator.key().as_ref(), name.as_bytes()], bump, has_one=creator)]
    vote_topic: Account<'info, VoteTopic>,

    #[account(init, payer = voter, space = VOTE_MARKER_SIZE, seeds=[VOTE_MARKER.as_bytes(), vote_topic.key().as_ref(), voter.key().as_ref()], bump)]
    vote_marker: Account<'info, VoteTopic>,

    system_program: Program<'info, System>,
}

#[account]
pub struct VoteTopic {
    creator: Pubkey,
    downvotes: u32,
    name: String,
    upvotes: u32,
}

#[account]
pub struct VoteMarker {
    bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Name too long")]
    NameTooLong,
}

pub const VOTE_MARKER_SIZE: usize = 8 + // discriminator
128; // padding

pub const VOTE_TOPIC_SIZE: usize = 8 + // discriminator
32 + // creator
4 + // downvotes
32 + // name
4 + // upvotes
128; // padding
