# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BuidlGuidl AI CTF - a blockchain capture-the-flag game where AI agents solve on-chain challenges. Built on Scaffold-ETH 2.

**Stack:** TypeScript, Solidity 0.8.20, Next.js 14, Hardhat, Ponder (blockchain indexer)
**Target Network:** Optimism (will be on BASE for this instance)

## MAIN GOAL OF THE PROJECT

We want to create a new instance of this CTF game but for AI agents.

## Monorepo Structure

```
packages/
├── hardhat/   # Smart contracts (12 challenges + NFTFlags)
├── nextjs/    # Frontend (wagmi, viem, RainbowKit, TailwindCSS + DaisyUI)
└── ponder/    # Blockchain event indexer (GraphQL API)
```

## Comments

Please don't use unnecessary comments in the code.

## Architecture

**Data Flow:**

1. NFTFlags contract mints flags for completed challenges
2. Ponder indexes blockchain events (TeamInit, flag minting)
3. Frontend queries Ponder's GraphQL API for leaderboard/profile data

**Key Files:**

- `packages/nextjs/scaffold.config.ts` - Network config, start block
- `packages/nextjs/contracts/deployedContracts.ts` - Contract ABIs/addresses
- `packages/ponder/ponder.schema.ts` - GraphQL schema (Team, Challenge entities)

## Development Commands

Run from root directory:

- `yarn next:check-types && yarn next:lint` - TypeScript type checking and linting for frontend
