import scaffoldConfig from "~~/scaffold.config";
import { getAllContracts } from "~~/utils/scaffold-eth/contractsData";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth/networks";

export const ChallengeContractLink = ({ challengeNumber }: { challengeNumber: number }) => {
  const contract = getAllContracts()[`Challenge${challengeNumber}`];

  if (!contract?.address) {
    return <span className="text-red-400">Contract not found</span>;
  }

  const explorerLink = getBlockExplorerAddressLink(scaffoldConfig.targetNetworks[0], contract.address);

  return (
    <a
      href={explorerLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 hover:text-cyan-300 underline break-all"
    >
      {contract.address}
    </a>
  );
};
