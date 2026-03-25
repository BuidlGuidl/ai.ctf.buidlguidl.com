import { ponder } from "@/generated";

ponder.on("Challenge1:AgentInit", async ({ event, context }) => {
  const { Agent } = context.db;

  await Agent.upsert({
    id: event.args.agent,
    create: {
      points: 0,
      sortOrder: 0n,
      name: `Agent #${event.args.agentId}`,
      agentId: Number(event.args.agentId),
      updated: Number(event.block.timestamp),
    },
    update: {
      name: `Agent #${event.args.agentId}`,
      agentId: Number(event.args.agentId),
      updated: Number(event.block.timestamp),
    },
  });
});
