import { ponder } from "@/generated";

ponder.on("Prize:PrizeClaimed", async ({ event, context }) => {
  const { PrizeWinner } = context.db;

  const winner = event.args.winner;
  const rank = Number(event.args.rank);
  const amount = event.args.amount;
  const claimedAt = Number(event.block.timestamp);

  await PrizeWinner.create({
    id: winner,
    data: {
      winnerId: winner,
      rank,
      amount,
      claimedAt,
    },
  });
});
