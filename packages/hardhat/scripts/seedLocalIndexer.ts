import { Contract, ContractTransactionReceipt, LogDescription, Signer, solidityPackedKeccak256 } from "ethers";
import hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

type SeedAgent = {
  signer: Signer;
  address: string;
  agentId: bigint;
  tokenIds: bigint[];
};

const requireReceipt = (receipt: ContractTransactionReceipt | null): ContractTransactionReceipt => {
  if (!receipt) {
    throw new Error("Transaction was not mined");
  }

  return receipt;
};

const findEvent = (receipt: ContractTransactionReceipt, contract: Contract, eventName: string): LogDescription => {
  for (const log of receipt.logs) {
    try {
      const event = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (event?.name === eventName) {
        return event;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`${eventName} was not emitted in transaction ${receipt.hash}`);
};

const seedLocalIndexer = async function (hre: HardhatRuntimeEnvironment) {
  const network = await hre.ethers.provider.getNetwork();
  if (hre.network.name !== "localhost" || network.chainId !== 31337n) {
    throw new Error(`Expected localhost chain 31337, received ${hre.network.name} chain ${network.chainId}`);
  }

  const { deployer } = await hre.getNamedAccounts();
  const allSigners = await hre.ethers.getSigners();
  const signersWithAddresses = await Promise.all(
    allSigners.map(async signer => ({ signer, address: await signer.getAddress() })),
  );
  const agentSigners = signersWithAddresses
    .filter(({ address }) => address.toLowerCase() !== deployer.toLowerCase())
    .slice(0, 3);

  if (agentSigners.length !== 3) {
    throw new Error(`Expected three non-deployer signers, received ${agentSigners.length}`);
  }

  const identityRegistry = await hre.ethers.getContract<Contract>("MockIdentityRegistry", deployer);
  const challenge1 = await hre.ethers.getContract<Contract>("Challenge1", deployer);
  const challenge2 = await hre.ethers.getContract<Contract>("Challenge2", deployer);
  const nftFlags = await hre.ethers.getContract<Contract>("NFTFlags", deployer);

  const existingRegistrations = await identityRegistry.queryFilter(identityRegistry.filters.AgentRegistered());
  if (existingRegistrations.length > 0) {
    throw new Error(
      `already registered: MockIdentityRegistry contains ${existingRegistrations.length} agent registration(s)`,
    );
  }

  const registeredStates = await Promise.all(
    agentSigners.map(({ address }) => challenge1.registered(address) as Promise<boolean>),
  );
  const alreadyRegistered = agentSigners.filter((_, index) => registeredStates[index]).map(({ address }) => address);

  if (alreadyRegistered.length > 0) {
    throw new Error(`already registered in Challenge1: ${alreadyRegistered.join(", ")}`);
  }

  if (!(await nftFlags.enabled())) {
    throw new Error("NFTFlags minting is disabled");
  }

  const [challenge1Allowed, challenge2Allowed] = await Promise.all(
    [challenge1, challenge2].map(async challenge => nftFlags.allowedMinters(await challenge.getAddress())),
  );
  if (!challenge1Allowed || !challenge2Allowed) {
    throw new Error("Challenge1 and Challenge2 must both be allowed NFTFlags minters");
  }

  const agents: SeedAgent[] = [];
  for (const [index, { signer, address }] of agentSigners.entries()) {
    const expectedAgentId = BigInt(index + 1);
    const registryForAgent = identityRegistry.connect(signer) as Contract;
    const receipt = requireReceipt(
      await (await registryForAgent.registerAgent(`local-agent-${expectedAgentId}`)).wait(),
    );
    const registration = findEvent(receipt, identityRegistry, "AgentRegistered");
    const agentId = registration.args.agentId as bigint;

    if (agentId !== expectedAgentId) {
      throw new Error(`Expected agentId ${expectedAgentId}, received ${agentId}`);
    }

    const registeredWallet = (await identityRegistry.getAgentWallet(agentId)) as string;
    if (registeredWallet.toLowerCase() !== address.toLowerCase()) {
      throw new Error(`Identity registry wallet mismatch for agentId ${agentId}`);
    }

    agents.push({ signer, address, agentId, tokenIds: [] });
  }

  for (const agent of agents) {
    const challengeForAgent = challenge1.connect(agent.signer) as Contract;
    const receipt = requireReceipt(await (await challengeForAgent.registerAgent(agent.agentId)).wait());
    const agentInit = findEvent(receipt, challenge1, "AgentInit");

    if (
      (agentInit.args.agent as string).toLowerCase() !== agent.address.toLowerCase() ||
      (agentInit.args.agentId as bigint) !== agent.agentId
    ) {
      throw new Error(`AgentInit data mismatch for agentId ${agent.agentId}`);
    }

    const flagMinted = findEvent(receipt, nftFlags, "FlagMinted");
    agent.tokenIds.push(flagMinted.args.tokenId as bigint);
  }

  const secondFlagAgent = agents[0];
  const challenge2Address = await challenge2.getAddress();
  const key = solidityPackedKeccak256(["address", "address"], [secondFlagAgent.address, challenge2Address]);
  const challenge2ForAgent = challenge2.connect(secondFlagAgent.signer) as Contract;
  const challenge2Receipt = requireReceipt(await (await challenge2ForAgent.mintFlag(key)).wait());
  const secondFlag = findEvent(challenge2Receipt, nftFlags, "FlagMinted");

  if ((secondFlag.args.challengeId as bigint) !== 2n) {
    throw new Error(`Expected challengeId 2, received ${secondFlag.args.challengeId}`);
  }
  secondFlagAgent.tokenIds.push(secondFlag.args.tokenId as bigint);

  console.log("Seeded local indexer events:");
  for (const agent of agents) {
    console.log(`address=${agent.address} agentId=${agent.agentId} tokenIds=[${agent.tokenIds.join(", ")}]`);
  }
};

seedLocalIndexer(hre).catch(error => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
