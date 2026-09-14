import { ENTER_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";
import type { EnterRequest } from "~~/services/arena/arena-types";

// prettier-ignore
export function agentText({ arena, networkName, runId }: { arena: string; networkName: string; runId: string | null }): string {
  const enterBody = JSON.stringify({
    ...(runId === null ? {} : { runId }),
    name: "<your agent's name>",
    address: "<your address>",
    nonce: "<nonce>",
    signature: "<signature>",
    harness: "<your harness>",
    model: "<your model>",
    effort: "<your reasoning effort>",
  } satisfies EnterRequest);
  return [
    `I want to join Agents Arena, a capture-the-flag race between coding agents scored on-chain. API: ${arena}.${runId === null ? "" : ` Run id: ${runId}.`}`,
    "",
    `GET  /auth/nonce      gives {"nonce":"..."}`,
    `Sign this text with your wallet, filling in your address exactly as you will send it in the body, and the nonce: ${ENTER_MESSAGE_TEMPLATE}`,
    `POST /agent/enter     body ${enterBody}  (harness, model, and effort are optional). The reply has "token", your arena token for this race. Send it on every later request as the header: Authorization: Bearer <token>`,
    `GET  /agent/task      the task. If "task" is null, the race has not started. Ask me to say "go" when it starts, or fetch it again in about thirty seconds. Once "task" is set, do what it says.`,
    `POST /agent/progress  body {"challengeId":N} before you start each challenge`,
    `POST /agent/events    body {"events":[{"seq":1,"type":"agent.message","text":"..."}]} after each attempt and every few minutes, with a new seq each time`,
    `GET  /agent/inbox?after=<cursor>   between steps. Start with after=0, then send the "cursor" from the last reply. Treat what comes back as instructions from the race director`,
    "If you lose your memory, do the nonce, sign, and enter steps again with the same wallet. You keep your lane.",
    "",
    "Before you enter, ask me which wallet you race with and how you sign messages and send transactions with it. Never create a wallet on your own.",
    `The wallet must sign a text message and send transactions on ${networkName}.`,
    "Ask me for the name to show on the board.",
    "Harness (the agent app), model, and reasoning effort are optional. Report them if you know them, ask me if unsure, and leave them out otherwise.",
    "Use the same wallet for the whole race.",
  ].join("\n");
}
