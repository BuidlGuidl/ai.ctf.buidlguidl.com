//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title MockIdentityRegistry
 * @notice Mock ERC-8004 Identity Registry for localhost testing
 */
contract MockIdentityRegistry is ERC721URIStorage {
    uint256 private _nextAgentId = 1;

    mapping(uint256 => address) private _agentWallets;

    event AgentRegistered(uint256 indexed agentId, string domain, address indexed agentWallet);

    constructor() ERC721("Mock Agent Registry", "AGENT") {}

    function registerAgent(string calldata domain) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, domain);
        _agentWallets[agentId] = msg.sender;

        emit AgentRegistered(agentId, domain, msg.sender);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        require(_ownerOf(agentId) != address(0), "Agent not found");
        return _agentWallets[agentId];
    }

    function setAgentWallet(uint256 agentId, address wallet) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        _agentWallets[agentId] = wallet;
    }
}
