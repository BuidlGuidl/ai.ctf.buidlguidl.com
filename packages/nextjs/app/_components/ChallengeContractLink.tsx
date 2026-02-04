"use client";

import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";
import { ContractName } from "~~/utils/scaffold-eth/contract";

export const ChallengeContractLink = ({ challengeNumber }: { challengeNumber: number }) => {
  const contractName = `Challenge${challengeNumber}` as ContractName;
  const { data: contractInfo, isLoading } = useDeployedContractInfo(contractName);
  const { targetNetwork } = useTargetNetwork();

  if (isLoading) {
    return <span className="text-gray-500">Loading...</span>;
  }

  if (!contractInfo?.address) {
    return <span className="text-red-400">Contract not found</span>;
  }

  const explorerLink = getBlockExplorerAddressLink(targetNetwork, contractInfo.address);

  return (
    <a
      href={explorerLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 hover:text-cyan-300 underline break-all"
    >
      {contractInfo.address}
    </a>
  );
};
