import { ponder } from "ponder:registry";
import { challenge, team } from "ponder:schema";

const POINTS_PER_CHALLENGE = 100;

// Points dominate the ordering; the timestamp only breaks ties, earliest first.
const sortOrderFor = (points: number, blockTimestamp: bigint) => 100000000000n * BigInt(points) - blockTimestamp;

ponder.on("NFTFlags:FlagMinted", async ({ event, context }) => {
  const { client } = context;
  const { NFTFlags } = context.contracts;

  const tokenUri = await client.readContract({
    abi: NFTFlags.abi,
    address: NFTFlags.address,
    functionName: "tokenURI",
    args: [event.args.tokenId],
  });

  await context.db
    .insert(team)
    .values({
      id: event.args.minter,
      points: POINTS_PER_CHALLENGE,
      sortOrder: sortOrderFor(POINTS_PER_CHALLENGE, event.block.timestamp),
      updated: Number(event.block.timestamp),
    })
    .onConflictDoUpdate(row => ({
      points: row.points + POINTS_PER_CHALLENGE,
      sortOrder: sortOrderFor(row.points + POINTS_PER_CHALLENGE, event.block.timestamp),
      updated: Number(event.block.timestamp),
    }));

  await context.db.insert(challenge).values({
    id: event.args.tokenId,
    challengeId: event.args.challengeId,
    tokenURI: tokenUri,
    timestamp: Number(event.block.timestamp),
    ownerId: event.args.minter,
    points: POINTS_PER_CHALLENGE,
  });
});
