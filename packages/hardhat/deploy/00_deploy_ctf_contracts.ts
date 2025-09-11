import { HardhatNetworkHDAccountsConfig, HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HDNodeWallet } from "ethers";
import { Contract, Mnemonic } from "ethers";

/**
 * Deploys all the needed CTF contracts
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployCtfContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, save } = hre.deployments;

  // :: NFT Flags ::
  await deploy("NFTFlags", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  const nftFlags = await hre.ethers.getContract<Contract>("NFTFlags", deployer);
  console.log("🚩 NFT Flag contract deployed");

  if (hre.network.name === "localhost") {
    await nftFlags.enable();
    console.log("🔓 Minting enabled");
  }

  // :: Challenge 1 ::
  await deploy("Challenge1", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #1 deployed");

  // :: Challenge 2 ::
  await deploy("Challenge2", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #2 deployed");

  // :: Challenge 3 ::
  await deploy("Challenge3", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #3 deployed");

  // :: Challenge 4 ::
  await deploy("Challenge4", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #4 deployed");

  // :: Challenge 5 ::
  await deploy("Challenge5", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #5 deployed");

  // :: Challenge 6 ::
  await deploy("Challenge6", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #6 deployed");

  // :: Challenge 7 ::
  await deploy("Challenge7", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #7 deployed");

  // :: Challenge 8 ::
  const challenge8BytecodeBase =
    "0x608060405234801561001057600080fd5b5060405161093d38038061093d83398101604081905261002f916100d4565b338061005557604051631e4fbdf760e01b81526000600482015260240160405180910390fd5b61005e81610084565b50600180546001600160a01b0319166001600160a01b0392909216919091179055610104565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6000602082840312156100e657600080fd5b81516001600160a01b03811681146100fd57600080fd5b9392505050565b61082a806101136000396000f3fe608060405234801561001057600080fd5b50600436106100885760003560e01c8063983b2d561161005b578063983b2d56146100e7578063aa271e1a146100fa578063d56d229d1461012d578063f2fde38b1461014057600080fd5b806323cfec7e1461008d5780633092afd5146100a2578063715018a6146100b55780638da5cb5b146100bd575b600080fd5b6100a061009b3660046106fa565b610153565b005b6100a06100b03660046107bc565b610351565b6100a06103a2565b6000546001600160a01b03165b6040516001600160a01b0390911681526020015b60405180910390f35b6100a06100f53660046107bc565b6103b6565b61011d6101083660046107bc565b60026020526000908152604090205460ff1681565b60405190151581526020016100de565b6001546100ca906001600160a01b031681565b6100a061014e3660046107bc565b61040a565b6001600160a01b03821660009081526002602052604090205460ff166101af5760405162461bcd60e51b815260206004820152600c60248201526b2737ba10309036b4b73a32b960a11b60448201526064015b60405180910390fd5b60408051602080820183905260126060830152710848e4086a88c4086d0c2d8d8cadcceca40760731b60808084019190915233838501528351808403909101815260a090920190925280519101207f19457468657265756d205369676e6564204d6573736167653a0a3332000000006000908152601c829052603c8120906102378285610448565b9050846001600160a01b0316816001600160a01b0316146102e65760405162461bcd60e51b815260206004820152605b60248201527f496e76616c6964207369676e61747572652e204d65737361676520746f20736960448201527f676e3a206b656363616b323536286162692e656e636f6465282242472043544660648201527f204368616c6c656e67652038222c206d73672e73656e64657229290000000000608482015260a4016101a6565b6001546040516340c10f1960e01b8152336004820152600860248201526001600160a01b03909116906340c10f1990604401600060405180830381600087803b15801561033257600080fd5b505af1158015610346573d6000803e3d6000fd5b505050505050505050565b610359610472565b6001600160a01b038116600081815260026020526040808220805460ff19169055517fe94479a9f7e1952cc78f2d6baab678adc1b772d936c6583def489e524cb666929190a250565b6103aa610472565b6103b4600061049f565b565b6103be610472565b6001600160a01b038116600081815260026020526040808220805460ff19166001179055517f6ae172837ea30b801fbfcdd4108aa1d5bf8ff775444fd70256b44e6bf3dfc3f69190a250565b610412610472565b6001600160a01b03811661043c57604051631e4fbdf760e01b8152600060048201526024016101a6565b6104458161049f565b50565b60008060008061045886866104ef565b925092509250610468828261053c565b5090949350505050565b6000546001600160a01b031633146103b45760405163118cdaa760e01b81523360048201526024016101a6565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b600080600083516041036105295760208401516040850151606086015160001a61051b888285856105f9565b955095509550505050610535565b50508151600091506002905b9250925092565b6000826003811115610550576105506107de565b03610559575050565b600182600381111561056d5761056d6107de565b0361058b5760405163f645eedf60e01b815260040160405180910390fd5b600282600381111561059f5761059f6107de565b036105c05760405163fce698f760e01b8152600481018290526024016101a6565b60038260038111156105d4576105d46107de565b036105f5576040516335e2f38360e21b8152600481018290526024016101a6565b5050565b600080807f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a084111561063457506000915060039050826106be565b604080516000808252602082018084528a905260ff891692820192909252606081018790526080810186905260019060a0016020604051602081039080840390855afa158015610688573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b0381166106b4575060009250600191508290506106be565b9250600091508190505b9450945094915050565b80356001600160a01b03811681146106df57600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b6000806040838503121561070d57600080fd5b610716836106c8565b9150602083013567ffffffffffffffff8082111561073357600080fd5b818501915085601f83011261074757600080fd5b813581811115610759576107596106e4565b604051601f8201601f19908116603f01168101908382118183101715610781576107816106e4565b8160405282815288602084870101111561079a57600080fd5b8260208601602083013760006020848301015280955050505050509250929050565b6000602082840312156107ce57600080fd5b6107d7826106c8565b9392505050565b634e487b7160e01b600052602160045260246000fdfea26469706673582212203818de7f7567e1b8ef1aa4a6712819bfe29b49b0643989d1687370a97e9d0e9864736f6c63430008140033";
  const nftFlagsAddress = await nftFlags.getAddress();
  const challenge8Bytecode = challenge8BytecodeBase + nftFlagsAddress.slice(2).padStart(64, "0");
  const deployerSigner = await hre.ethers.getSigner(deployer);
  const nonce = await deployerSigner.getNonce();

  const feeData = await hre.ethers.provider.getFeeData();
  const rawTx = {
    nonce: nonce,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit: 800_000,
    to: null,
    value: 0,
    data: challenge8Bytecode,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
  };

  const txResponse = await deployerSigner.sendTransaction(rawTx);
  const txReceipt = await txResponse.wait();
  const challenge8Address = txReceipt?.contractAddress;

  if (challenge8Address) await save("Challenge8", { address: challenge8Address, abi: [] });

  console.log("🚩 Challenge #8 deployed at:", challenge8Address);

  const hAccounts8 = hre.config.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig;
  const derivationPath8 = "m/44'/60'/0'/0/12";
  const challenge8Account = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(hAccounts8.mnemonic), derivationPath8);

  const functionSelector = "0x983b2d56";

  const encodedParams = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [challenge8Account.address]);

  const data = functionSelector + encodedParams.slice(2);

  const txHash = await deployerSigner.sendTransaction({
    to: challenge8Address,
    data,
  });

  console.log("Transaction hash challenge 8 after deploy: ", txHash.hash);

  // :: Challenge 9 ::
  await deploy("Challenge9", {
    from: deployer,
    args: [await nftFlags.getAddress(), hre.ethers.randomBytes(32)],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #9 deployed");

  // :: Challenge 10 ::
  await deploy("Challenge10Inventory", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  await deploy("Challenge10Quest", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  await deploy("Challenge10Dungeon", {
    from: deployer,
    args: [await (await hre.ethers.getContract<Contract>("Challenge10Quest", deployer)).getAddress()],
    log: true,
    autoMine: true,
  });

  await deploy("Challenge10Victory", {
    from: deployer,
    args: [await (await hre.ethers.getContract<Contract>("Challenge10Dungeon", deployer)).getAddress()],
    log: true,
    autoMine: true,
  });

  await deploy("Challenge10HeroNFT", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  await deploy("Challenge10GoldToken", {
    from: deployer,
    args: [
      await (await hre.ethers.getContract<Contract>("Challenge10HeroNFT", deployer)).getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10Dungeon", deployer)).getAddress(),
    ],
    log: true,
    autoMine: true,
  });

  const challenge10Inventory = await hre.ethers.getContract<Contract>("Challenge10Inventory", deployer);

  await deploy("Challenge10", {
    from: deployer,
    args: [
      await nftFlags.getAddress(),
      await challenge10Inventory.getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10Quest", deployer)).getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10Dungeon", deployer)).getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10Victory", deployer)).getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10GoldToken", deployer)).getAddress(),
      await (await hre.ethers.getContract<Contract>("Challenge10HeroNFT", deployer)).getAddress(),
    ],
    log: true,
    autoMine: true,
  });

  const challenge10Address = await (await hre.ethers.getContract<Contract>("Challenge10", deployer)).getAddress();

  await challenge10Inventory.transferOwnership(challenge10Address);

  console.log("🚩 Challenge #10 deployed");

  // :: Challenge 11 ::
  await deploy("Challenge11", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #11 deployed");

  // :: Challenge 12 ::
  await deploy("Challenge12", {
    from: deployer,
    args: [await nftFlags.getAddress()],
    log: true,
    autoMine: true,
  });

  console.log("🚩 Challenge #12 deployed");

  // Set addAllowedMinterMultiple in NFTFlags
  const challengeAddresses = [
    await (await hre.ethers.getContract<Contract>("Challenge1", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge2", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge3", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge4", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge5", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge6", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge7", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge8", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge9", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge10", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge11", deployer)).getAddress(),
    await (await hre.ethers.getContract<Contract>("Challenge12", deployer)).getAddress(),
  ];

  const tx = await nftFlags.addAllowedMinterMultiple(challengeAddresses);
  await tx.wait();

  console.log("Added allowed minters to NFTFlags");
};

export default deployCtfContracts;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags CTF
deployCtfContracts.tags = ["CTF"];
