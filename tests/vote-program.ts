import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import chai, { assert, expect } from "chai";
import { VoteProgram } from "../target/types/vote_program";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

// Configure the client to use the local cluster.
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.VoteProgram as Program<VoteProgram>;
const CREATOR = Keypair.generate();
const VOTER = Keypair.generate();

async function findVoteMarkerAddress(voteTopic: PublicKey, voter: PublicKey) {
  return PublicKey.findProgramAddress(
    [Buffer.from("vote_marker"), voteTopic.toBuffer(), voter.toBuffer()],
    program.programId
  );
}

async function findVoteTopicAddress(creator: PublicKey, name: string) {
  return PublicKey.findProgramAddress(
    [Buffer.from("vote_topic"), creator.toBuffer(), Buffer.from(name)],
    program.programId
  );
}

async function requestAirdrops(
  wallets: Array<Keypair>,
  connection: Connection
) {
  await Promise.all(
    wallets.map(async (wallet) => {
      const airdrop = await connection.requestAirdrop(
        wallet.publicKey,
        50 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdrop, "confirmed");
    })
  );
}

async function createVoteTopic(creator: Keypair, name: string) {
  const [voteTopicAddress] = await findVoteTopicAddress(
    creator.publicKey,
    name
  );
  await program.methods
    .createVoteTopic(name)
    .accounts({
      creator: creator.publicKey,
      systemProgram: SystemProgram.programId,
      voteTopic: voteTopicAddress,
    })
    .signers([creator])
    .rpc();
  const voteTopicAccount = await program.account.voteTopic.fetch(
    voteTopicAddress
  );

  expect(voteTopicAccount.creator.toString()).eq(creator.publicKey.toString());
  expect(voteTopicAccount.downvotes).eq(0);
  expect(voteTopicAccount.name).eq(name);
  expect(voteTopicAccount.upvotes).eq(0);

  return voteTopicAddress;
}

describe("vote-program", () => {
  before(async () => {
    await requestAirdrops([CREATOR, VOTER], program.provider.connection);
  });

  it("Create vote topic", async () => {
    await createVoteTopic(CREATOR, "test");
  });

  it("Vote on topic", async () => {
    const name = "test2";
    const voteTopicAddress = await createVoteTopic(CREATOR, name);

    const [voteMarkerAddress] = await findVoteMarkerAddress(
      voteTopicAddress,
      VOTER.publicKey
    );

    await program.methods
      .vote(name, true)
      .accounts({
        voter: VOTER.publicKey,
        creator: CREATOR.publicKey,
        voteTopic: voteTopicAddress,
        voteMarker: voteMarkerAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([VOTER])
      .rpc();

    const voteTopicAccount = await program.account.voteTopic.fetch(
      voteTopicAddress
    );
    expect(voteTopicAccount.upvotes).eq(1);

    const promise = program.methods
      .vote(name, true)
      .accounts({
        voter: VOTER.publicKey,
        creator: CREATOR.publicKey,
        voteTopic: voteTopicAddress,
        voteMarker: voteMarkerAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([VOTER])
      .rpc();
    await assert.isRejected(promise);
  });
});
