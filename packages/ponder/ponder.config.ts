import { createConfig } from "ponder";
import { hardhat } from "viem/chains";
import deployedContracts from "../nextjs/contracts/deployedContracts";
import scaffoldConfig from "../nextjs/scaffold.config";

const targetNetwork = scaffoldConfig.targetNetworks[0];

// Widened, because scaffold.config pins one chain and TS otherwise reads this
// comparison as two literals that can never overlap.
const targetChainId: number = targetNetwork.id;
const isLocalChain = targetChainId === hardhat.id;

const chainContracts = deployedContracts[targetNetwork.id];

// A local chain restarts from genesis on every `yarn chain`, so the live-network
// startBlock would never arrive.
const startBlock = isLocalChain ? 0 : scaffoldConfig.startBlock;

const rpc = process.env[`PONDER_RPC_URL_${targetNetwork.id}`] ?? targetNetwork.rpcUrls.default.http[0];

const chains = {
  [targetNetwork.name]: {
    id: targetNetwork.id,
    rpc,
    // A local chain reuses block numbers across restarts, so a warm cache serves stale logs.
    disableCache: isLocalChain,
  },
} as Record<typeof targetNetwork.name, { id: typeof targetNetwork.id; rpc: string; disableCache: boolean }>;

// Register every deployed contract. Ponder skips the ones with no indexing function.
const contracts = Object.fromEntries(
  Object.entries(chainContracts).map(([contractName, contract]) => [
    contractName,
    {
      chain: targetNetwork.name,
      abi: contract.abi,
      address: contract.address,
      startBlock,
    },
  ]),
) as {
  [contractName in keyof typeof chainContracts]: {
    chain: typeof targetNetwork.name;
    abi: (typeof chainContracts)[contractName]["abi"];
    address: (typeof chainContracts)[contractName]["address"];
    startBlock: number;
  };
};

export default createConfig({
  chains,
  contracts,
});
