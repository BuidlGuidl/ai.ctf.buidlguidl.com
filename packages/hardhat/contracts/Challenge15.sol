// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./INFTFlags.sol";

contract Challenge15 {
    address public nftContract;
    mapping(address => bytes4) public codes;

    constructor(address _nftContract) {
        nftContract = _nftContract;
    }

    function mintFlag() public {
        require((bytes4(bytes20(codes[tx.origin]) ^ bytes20(tx.origin)) & 0x0000FFFF) == 0x0000CAFE, "Wrong code");
        INFTFlags(nftContract).mint(tx.origin, 15);
    }

    function switch1() public {
        codes[tx.origin] = codes[tx.origin] | 0x00000001;
    }

    function switch2() public {
        codes[tx.origin] = codes[tx.origin] << 4;
    }

    function switch3() public {
        codes[tx.origin] = codes[tx.origin] >> 1;
    }

    function callSwitches(uint8[] memory switchs) public {
        for (uint8 i = 0; i < switchs.length; i++) {
            if (switchs[i] == 1) {
                switch1();
            } else if (switchs[i] == 2) {
                switch2();
            } else if (switchs[i] == 3) {
                switch3();
            }
        }
    }
}
