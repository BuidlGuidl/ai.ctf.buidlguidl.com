# SE-2 Ponder Extension

This extension allows to use Ponder (https://ponder.sh/) for event indexing on an SE-2 dapp.

Ponder is an open-source framework for blockchain application backends. With Ponder, you can rapidly build & deploy an API that serves custom data from smart contracts on any EVM blockchain.

## Config

Ponder config (`packages/ponder/ponder.config.ts`) is set automatically from the deployed contracts and using the first blockchain network setup at `packages/nextjs/scaffold.config.ts`.

## Design your schema

You can define your Ponder data schema on the file at `packages/ponder/ponder.schema.ts` following the Ponder documentation (https://ponder.sh/docs/schema).

## Indexing data

You can index events by adding files to `packages/ponder/src/` (https://ponder.sh/docs/indexing/create-update-records)

## Start the development server

Run `yarn ponder:dev` to start the Ponder development server, for indexing and serving the GraphQL API endpoint at http://localhost:42069

## Query the GraphQL API

With the dev server running, open http://localhost:42069 in your browser to use the GraphiQL interface. GraphiQL is a useful tool for exploring your schema and testing queries during development. (https://ponder.sh/docs/query/graphql)

GraphQL is served by `src/api/index.ts`, mounted at both `/` and `/graphql`.

You can query data on a page using `@tanstack/react-query`. Check the code at `packages/nextjs/components/TeamData.tsx` to get the team data and show it.

## Deploy

To deploy the Ponder indexer please refer to the Ponder Deploy documentation https://ponder.sh/docs/production/self-hosting

At **Settings** -> **Deploy** -> you must set **Custom Start Command** to `yarn ponder:start`.

### Required environment variables

- `DATABASE_URL` (or `DATABASE_PRIVATE_URL`, which takes precedence and is what Railway injects) — a Postgres connection string. Without it Ponder falls back to PGlite on the local filesystem, which does not survive a redeploy.
- `DATABASE_SCHEMA` — the Postgres schema to index into. `ponder start` has no default and exits with `Database schema required` if this is unset; only `ponder dev` defaults to `public`. You can pass `--schema` instead of the env var.
- `PONDER_RPC_URL_<chainId>` — the RPC endpoint for the target chain. If unset, the indexer silently falls back to the chain's public RPC and will be rate limited.

Each deploy should use its own `DATABASE_SCHEMA`, so a new version indexes alongside the running one instead of overwriting it. Use `yarn ponder:db list` to see the schemas in use and `yarn ponder:db prune` to drop the ones no longer served.

For faster indexing, set `startBlock` in `packages/nextjs/scaffold.config.ts` to the block the contracts were deployed at.

And then you have to set up the `NEXT_PUBLIC_PONDER_URL` env variable on your SE-2 dapp to use the deployed ponder indexer.
