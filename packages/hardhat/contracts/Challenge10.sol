// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./NFTFlags.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC721URIStorage, ERC721 } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// Gamified contract names
contract Challenge10HeroNFT is ERC721URIStorage {
    uint256 private _nextTokenId;

    constructor() ERC721("Challenge10HeroNFT", "C10HERO") {}

    function mint(string memory tokenURI) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);

        _setTokenURI(tokenId, tokenURI);

        return tokenId;
    }
}

contract Challenge10GoldToken is ERC20 {
    address public challenge10HeroNFT;
    address public challenge10Dungeon;
    address public nftContract;

    constructor(
        address _challenge10HeroNFT,
        address _challenge10Dungeon,
        address _nftContract
    ) ERC20("Challenge10GoldToken", "C10GOLD") {
        challenge10HeroNFT = _challenge10HeroNFT;
        challenge10Dungeon = _challenge10Dungeon;
        nftContract = _nftContract;
    }

    function mint(address _to) public {
        require(msg.sender == nftContract, "Only NFT contract can mint");

        _mint(_to, 1000 * 10 ** decimals());
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(Challenge10HeroNFT(challenge10HeroNFT).balanceOf(msg.sender) > 0, "Insufficient NFT balance");
        require(
            Challenge10HeroNFT(challenge10HeroNFT).balanceOf(msg.sender) <
                uint256(Challenge10Dungeon(challenge10Dungeon).dungeon(tx.origin)),
            "Wrong NFT balance"
        );
        _transfer(msg.sender, to, amount);
        return true;
    }
}

contract Challenge10Inventory is Ownable(msg.sender) {
    mapping(address => uint256) public inventory;

    function setValue(uint256 value) public onlyOwner {
        inventory[tx.origin] = value;
    }
}

contract Challenge10Quest {
    mapping(address => uint256) public quest;

    function setCurrentQuest(uint256 value) public {
        quest[tx.origin] = value;
    }
}

contract Challenge10Dungeon {
    address public challenge10Quest;
    mapping(address => bytes32) public dungeon;

    constructor(address _challenge10Quest) {
        challenge10Quest = _challenge10Quest;
    }

    function setPosition(bytes32 value) public {
        dungeon[tx.origin] = value;
    }

    function getCurrentPosition() public view returns (uint256) {
        return Challenge10Quest(challenge10Quest).quest(tx.origin) * uint256(dungeon[tx.origin]);
    }
}

contract Challenge10Victory {
    address public challenge10Dungeon;
    mapping(address => bool) public victory;

    constructor(address _challenge10Dungeon) {
        challenge10Dungeon = _challenge10Dungeon;
    }

    function free(bool value) public {
        victory[tx.origin] = value;
    }

    function winner() public view returns (bool) {
        return (Challenge10Dungeon(challenge10Dungeon).dungeon(tx.origin) > 0) ? victory[tx.origin] : false;
    }
}

contract Challenge10 {
    address public nftContract;
    address public challenge10Inventory;
    address public challenge10Quest;
    address public challenge10Dungeon;
    address public challenge10Victory;
    address public challenge10GoldToken;
    address public challenge10HeroNFT;

    constructor(
        address _nftContract,
        address _challenge10Inventory,
        address _challenge10Quest,
        address _challenge10Dungeon,
        address _challenge10Victory,
        address _challenge10GoldToken,
        address _challenge10HeroNFT
    ) {
        nftContract = _nftContract;
        challenge10Inventory = _challenge10Inventory;
        challenge10Quest = _challenge10Quest;
        challenge10Dungeon = _challenge10Dungeon;
        challenge10Victory = _challenge10Victory;
        challenge10GoldToken = _challenge10GoldToken;
        challenge10HeroNFT = _challenge10HeroNFT;
    }

    modifier winner() {
        require(Challenge10Victory(challenge10Victory).winner(), "Not winner");
        _;
    }

    modifier rich() {
        require(
            Challenge10GoldToken(challenge10GoldToken).balanceOf(address(~bytes20(tx.origin))) >= 1 ether,
            "Insufficient balance"
        );
        _;
    }

    function mintFlag(uint256 tokenId) public winner rich {
        Challenge10GoldToken(challenge10GoldToken).transferFrom(msg.sender, address(this), 1 ether);

        uint256 inventoryValue = stringToUint(Challenge10HeroNFT(challenge10HeroNFT).tokenURI(tokenId));
        Challenge10Inventory(challenge10Inventory).setValue(inventoryValue);

        bytes32 hash = keccak256(
            abi.encodePacked(
                blockhash(block.number - 1),
                address(this),
                Challenge10Inventory(challenge10Inventory).inventory(tx.origin)
            )
        );

        uint256 balance = Challenge10GoldToken(challenge10GoldToken).balanceOf(msg.sender);

        require(balance == uint256(hash) % 100 ether, "Wrong balance");
        require(balance == Challenge10Dungeon(challenge10Dungeon).getCurrentPosition(), "Wrong position");
        require(
            Challenge10GoldToken(challenge10GoldToken).balanceOf(tx.origin) ==
                Challenge10GoldToken(challenge10GoldToken).balanceOf(address(~bytes20(tx.origin))),
            "Wrong enemy balance"
        );

        require(
            Challenge10GoldToken(challenge10GoldToken).allowance(msg.sender, address(this)) ==
                Challenge10Inventory(challenge10Inventory).inventory(tx.origin),
            "Wrong allowance"
        );

        NFTFlags(nftContract).mint(tx.origin, 10);
    }

    function stringToUint(string memory _s) public pure returns (uint256) {
        bytes memory b = bytes(_s);
        uint256 res = 0;
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x30 && b[i] <= 0x39) {
                res = res * 10 + (uint256(uint8(b[i])) - 0x35);
            } else {
                return 0;
            }
        }
        return res;
    }
}
