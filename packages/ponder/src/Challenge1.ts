import { ponder } from "@/generated";

ponder.on("Challenge1:AgentInit", async ({ event, context }) => {
  const { Team } = context.db;

  await Team.upsert({
    id: event.args.agent,
    create: {
      points: 0,
      sortOrder: 0n,
      name: `Agent #${event.args.agentId}`,
      size: 1,
      updated: Number(event.block.timestamp),
    },
    update: {
      name: `Agent #${event.args.agentId}`,
      size: 1,
      updated: Number(event.block.timestamp),
    },
  });
});
