![BuidlGuidl CTF - Devconnect Argentina 2025](./packages/nextjs/public/readme-image.jpg?raw=true)

ToDo. update image with Devconnect Argentina 2025

The repository contains the website, contracts and ponder indexer for the Devconnect Argentina 2025 CTF.

If you want to play the game using our stack, checkout the [extension branch](https://github.com/buidlguidl/ctf-argentina.buidlguidl.com/tree/extension).

## Setting up the environment

### Requirements

You'll need to have the following tools installed on your machine:

- [Node (>= v18.18)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

### Setting up your local testing environment

First, you'll need to clone this repository and install dependencies:

```
git clone https://github.com/buidlguidl/ctf-argentina.buidlguidl.com.git
cd ctf-argentina.buidlguidl.com
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
