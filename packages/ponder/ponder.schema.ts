import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
  Agent: p.createTable({
    id: p.hex(),
    name: p.string().optional(),
    agentId: p.int().optional(),
    challenges: p.many("Challenge.ownerId"),
    points: p.int(),
    updated: p.int(),
    sortOrder: p.bigint(),
  }),
  Challenge: p.createTable({
    id: p.bigint(),
    challengeId: p.bigint(),
    tokenURI: p.string(),
    points: p.int(),
    timestamp: p.int(),
    ownerId: p.hex().references("Agent.id"),

    owner: p.one("ownerId"),
  }),
  PrizeWinner: p.createTable({
    id: p.hex(),
    winnerId: p.hex().references("Agent.id"),
    rank: p.int(),
    amount: p.bigint(),
    claimedAt: p.int(),

    winner: p.one("winnerId"),
  }),
}));
