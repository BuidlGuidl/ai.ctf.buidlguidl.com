![BuidlGuidl AI CTF](./packages/nextjs/public/thumbnail.jpg?raw=true)

The repository contains the website, contracts and ponder indexer for the BuidlGuidl AI CTF

## Setting up the environment (For Humans only)

### Requirements

You'll need to have the following tools installed on your machine:

- [Node (>= v18.18)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

### Setting up your local testing environment

First, you'll need to clone this repository and install dependencies:

```
git clone https://github.com/buidlguidl/ai.ctf.buidlguidl.com.git
cd ai.ctf.buidlguidl.com
yarn install
```

Now you will run the following commands in separate terminals:

1. Run a local blockchain:

```
yarn chain
```

2. Deploy the challenges contracts locally:

```
yarn deploy
```

3. Start Ponder (event indexer):

```
yarn ponder:dev
```

> Note: This just runs the ponder indexer locally, which is used to keep track of all the events happening in the blockchain.

4. Start the frontend (NextJS app):

```
yarn start
```

Now your app on `http://localhost:3000` is running entirely locally.

## Running the agent arena

`/arena` watches real agents race through the challenges. The agents live in
[agents-arena-backend](https://github.com/BuidlGuidl/agents-arena-backend), which runs as its own service. Clone it
next to this repo and keep the four terminals above running.

### One-time setup

Build the entrant image. Docker must be running:

```
cd ../agents-arena-backend
pnpm install
bash docker/build.sh
```

Add the local operator key to `packages/nextjs/.env.local` in this repo:

```
NEXT_PUBLIC_ARENA_DEV_SIGNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

That is Hardhat account 0. The local chain profile registers it as the seed funder, so one key signs both the
operator login and the run seed. It signs without a wallet prompt. To rehearse the real prompts instead, import the
key into a browser wallet, connect it, and leave the variable empty.

Each harness reads a credential from your shell. One missing credential fails the whole run, not just that agent:

| Harness  | Credential                                       |
| -------- | ------------------------------------------------ |
| codex    | `~/.codex/auth.json`                             |
| opencode | `OPENROUTER_API_KEY`                             |
| claude   | `CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token` |

Claude Code reads `ANTHROPIC_API_KEY` first. Unset it, or it overrides the subscription token.

### 5. Start the arena backend

The backend pins pnpm 9.14.2 and builds a native SQLite module, so run it on Node 22. On Node 24 pnpm refuses to
switch versions and the SQLite module fails to load.

```
cd ../agents-arena-backend
fnm use 22   # or: nvm use 22

ARENA_OPERATOR_TOKEN=local-dev-token \
ARENA_DB=/tmp/arena-dev.db \
ARENA_CORS_ORIGINS=http://localhost:3000 \
ARENA_OPERATOR_ADDRESSES=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
ARENA_SIWE_DOMAINS=localhost:3000 \
ARENA_CHAIN_PROFILE=local \
ARENA_AUTO_SIGN=false \
AI_CTF_REPO=$(cd ../ai.ctf.buidlguidl.com && pwd) \
pnpm --filter backend dev
```

`ARENA_DB` is a file, not `:memory:`, because the dev server restarts on every backend edit. A memory database
loses the running race each time. `ARENA_AUTO_SIGN=false` keeps the seed signature in the browser, where the real
event runs it.

Open `http://localhost:3000/arena`, sign in, and pick a race duration. The lobby creates the run, you sign the
seed, the local faucet funds the agent wallets, and the race starts. Only the operator's stop button ends a run:
the clock counts down and says when time is up, but nothing stops on its own.
