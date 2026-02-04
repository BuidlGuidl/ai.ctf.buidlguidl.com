//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title IIdentityRegistry
 * @notice Minimal ERC-8004 Identity Registry interface
 * @dev https://eips.ethereum.org/EIPS/eip-8004
 */
interface IIdentityRegistry {
    function getAgentWallet(uint256 agentId) external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
