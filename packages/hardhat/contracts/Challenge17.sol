// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./NFTFlags.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC721URIStorage, ERC721 } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// Gamified contract names
contract Challenge17HeroNFT is ERC721URIStorage {
    uint256 private _nextTokenId;

    constructor() ERC721("Challenge17HeroNFT", "C17HERO") {}

    function mint(string memory tokenURI) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);

        _setTokenURI(tokenId, tokenURI);

        return tokenId;
    }
}

contract Challenge17GoldToken is ERC20 {
    address public challenge17HeroNFT;
    address public challenge17Dungeon;

    constructor(address _challenge17HeroNFT, address _challenge17Dungeon) ERC20("Challenge17GoldToken", "C17GOLD") {
        challenge17HeroNFT = _challenge17HeroNFT;
        challenge17Dungeon = _challenge17Dungeon;
    }

    function mint() public {
        _mint(msg.sender, 1000 * 10 ** decimals());
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(Challenge17HeroNFT(challenge17HeroNFT).balanceOf(msg.sender) > 0, "Insufficient NFT balance");
        require(
            Challenge17HeroNFT(challenge17HeroNFT).balanceOf(msg.sender) <
                uint256(Challenge17Dungeon(challenge17Dungeon).dungeon(tx.origin)),
            "Wrong NFT balance"
        );
        _transfer(msg.sender, to, amount);
        return true;
    }
}

contract Challenge17Inventory is Ownable(msg.sender) {
    mapping(address => uint256) public inventory;

    function setValue(uint256 value) public onlyOwner {
        inventory[tx.origin] = value;
    }
}

contract Challenge17Quest {
    mapping(address => uint256) public quest;

    function setCurrentQuest(uint256 value) public {
        quest[tx.origin] = value;
    }
}

contract Challenge17Dungeon {
    address public challenge17Quest;
    mapping(address => bytes32) public dungeon;

    constructor(address _challenge17Quest) {
        challenge17Quest = _challenge17Quest;
    }

    function setPosition(bytes32 value) public {
        dungeon[tx.origin] = value;
    }

    function getCurrentPosition() public view returns (uint256) {
        return Challenge17Quest(challenge17Quest).quest(tx.origin) * uint256(dungeon[tx.origin]);
    }
}

contract Challenge17Victory {
    address public challenge17Dungeon;
    mapping(address => bool) public victory;

    constructor(address _challenge17Dungeon) {
        challenge17Dungeon = _challenge17Dungeon;
    }

    function free(bool value) public {
        victory[tx.origin] = value;
    }

    function winner() public view returns (bool) {
        return (Challenge17Dungeon(challenge17Dungeon).dungeon(tx.origin) > 0) ? victory[tx.origin] : false;
    }
}

contract Challenge17 {
    address public nftContract;
    address public challenge17Inventory;
    address public challenge17Quest;
    address public challenge17Dungeon;
    address public challenge17Victory;
    address public challenge17GoldToken;
    address public challenge17HeroNFT;

    constructor(
        address _nftContract,
        address _challenge17Inventory,
        address _challenge17Quest,
        address _challenge17Dungeon,
        address _challenge17Victory,
        address _challenge17GoldToken,
        address _challenge17HeroNFT
    ) {
        nftContract = _nftContract;
        challenge17Inventory = _challenge17Inventory;
        challenge17Quest = _challenge17Quest;
        challenge17Dungeon = _challenge17Dungeon;
        challenge17Victory = _challenge17Victory;
        challenge17GoldToken = _challenge17GoldToken;
        challenge17HeroNFT = _challenge17HeroNFT;
    }

    modifier winner() {
        require(Challenge17Victory(challenge17Victory).winner(), "Not winner");
        _;
    }

    modifier rich() {
        require(
            Challenge17GoldToken(challenge17GoldToken).balanceOf(address(~bytes20(tx.origin))) >= 1 ether,
            "Insufficient balance"
        );
        _;
    }

    function mintFlag(uint256 tokenId) public winner rich {
        Challenge17GoldToken(challenge17GoldToken).transferFrom(msg.sender, address(this), 1 ether);

        uint256 inventoryValue = stringToUint(Challenge17HeroNFT(challenge17HeroNFT).tokenURI(tokenId));
        Challenge17Inventory(challenge17Inventory).setValue(inventoryValue);

        bytes32 hash = keccak256(
            abi.encodePacked(
                blockhash(block.number - 1),
                address(this),
                Challenge17Inventory(challenge17Inventory).inventory(tx.origin)
            )
        );

        uint256 balance = Challenge17GoldToken(challenge17GoldToken).balanceOf(msg.sender);

        require(balance == uint256(hash) % 100 ether, "Wrong balance");
        require(balance == Challenge17Dungeon(challenge17Dungeon).getCurrentPosition(), "Wrong position");
        require(
            Challenge17GoldToken(challenge17GoldToken).balanceOf(tx.origin) ==
                Challenge17GoldToken(challenge17GoldToken).balanceOf(address(~bytes20(tx.origin))),
            "Wrong enemy balance"
        );

        require(
            Challenge17GoldToken(challenge17GoldToken).allowance(msg.sender, address(this)) ==
                Challenge17Inventory(challenge17Inventory).inventory(tx.origin),
            "Wrong allowance"
        );

        NFTFlags(nftContract).mint(tx.origin, 17);
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
