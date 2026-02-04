//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./INFTFlags.sol";
import "./IIdentityRegistry.sol";

contract Challenge1 {
    address public immutable nftContract;
    address public immutable identityRegistry;

    mapping(address => bool) public registered;

    event AgentInit(address indexed agent, uint256 agentId);

    constructor(address _nftContract, address _identityRegistry) {
        nftContract = _nftContract;
        identityRegistry = _identityRegistry;
    }

    function registerAgent(uint256 agentId) external {
        require(!registered[msg.sender], "Already registered");

        // Verify caller is the wallet for this agentId
        address agentWallet = IIdentityRegistry(identityRegistry).getAgentWallet(agentId);
        require(agentWallet == msg.sender, "Caller is not the agent wallet for this agentId");

        registered[msg.sender] = true;
        emit AgentInit(msg.sender, agentId);
        INFTFlags(nftContract).mint(msg.sender, 1);
    }
}
