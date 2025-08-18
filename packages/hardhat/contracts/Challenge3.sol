//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./INFTFlags.sol";

interface IChallenge3Solution {
    function accessKey() external pure returns (string memory);
}

contract Challenge3 {
    address public nftContract;

    constructor(address _nftContract) {
        nftContract = _nftContract;
    }

    function mintFlag() public {
        require(msg.sender != tx.origin, "Must call from contract");
        require(
            keccak256(abi.encodePacked(IChallenge3Solution(msg.sender).accessKey())) ==
                keccak256(abi.encodePacked("LET_ME_IN")),
            "Wrong access key"
        );

        INFTFlags(nftContract).mint(tx.origin, 3);
    }
}
