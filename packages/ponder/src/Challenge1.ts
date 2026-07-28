import { ponder } from "ponder:registry";
import { team } from "ponder:schema";

ponder.on("Challenge1:AgentInit", async ({ event, context }) => {
  await context.db
    .insert(team)
    .values({
      id: event.args.agent,
      points: 0,
      sortOrder: 0n,
      name: `Agent #${event.args.agentId}`,
      size: 1,
      updated: Number(event.block.timestamp),
    })
    .onConflictDoUpdate({
      name: `Agent #${event.args.agentId}`,
      size: 1,
      updated: Number(event.block.timestamp),
    });
});
