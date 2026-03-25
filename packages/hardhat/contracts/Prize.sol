// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Prize pool for the top 5 agents.
 * Eligibility: wallet must hold exactly 12 `NFTFlags` tokens (one per challenge).
 * Claim order: first 5 successful calls to `claimPrize()`.
 * Payout order: 1st winner gets the highest share, then decreasing amounts.
 */
contract Prize is Ownable, ReentrancyGuard {
    IERC721 public immutable nftFlags;

    uint256 public constant ELIGIBLE_NFT_BALANCE = 12;
    uint256 public constant MAX_WINNERS = 5;

    // prizeAmounts[0] is paid to the first winner, and prizeAmounts[4] to the 5th.
    uint256[MAX_WINNERS] public prizeAmounts;
    uint256 public prizesClaimed;

    mapping(address => bool) public hasClaimed;
    mapping(uint256 => address) public winners; // rank => winner

    event PrizeClaimed(address indexed winner, uint256 indexed rank, uint256 amount);

    error AllPrizesClaimed();
    error AlreadyClaimed();
    error NotEligible();
    error InvalidNFTFlags();
    error IncorrectPrizePool();
    error ETHTransferFailed();
    error PrizesNotFullyClaimed();
    error NothingToWithdraw();
    error WithdrawFailed();

    constructor(address _nftFlags) payable Ownable(msg.sender) {
        if (_nftFlags == address(0)) revert InvalidNFTFlags();
        if (msg.value != 1 ether) revert IncorrectPrizePool();

        nftFlags = IERC721(_nftFlags);

        // Descending shares that sum to exactly 1 ETH.
        // 0.42 + 0.23 + 0.16 + 0.11 + 0.08 = 1.00 ETH
        prizeAmounts[0] = 420_000_000_000_000_000;
        prizeAmounts[1] = 230_000_000_000_000_000;
        prizeAmounts[2] = 160_000_000_000_000_000;
        prizeAmounts[3] = 110_000_000_000_000_000;
        prizeAmounts[4] = 80_000_000_000_000_000;
    }

    function claimPrize() external nonReentrant {
        if (prizesClaimed >= MAX_WINNERS) revert AllPrizesClaimed();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (nftFlags.balanceOf(msg.sender) != ELIGIBLE_NFT_BALANCE) revert NotEligible();

        uint256 rank = prizesClaimed;
        uint256 amount = prizeAmounts[rank];

        // Update state before transferring ETH to prevent re-entrancy.
        hasClaimed[msg.sender] = true;
        winners[rank] = msg.sender;
        prizesClaimed = rank + 1;

        (bool ok, ) = msg.sender.call{ value: amount }("");
        if (!ok) revert ETHTransferFailed();

        emit PrizeClaimed(msg.sender, rank, amount);
    }

    function withdrawUnclaimed() external onlyOwner {
        if (prizesClaimed < MAX_WINNERS) revert PrizesNotFullyClaimed();
        uint256 remaining = address(this).balance;
        if (remaining == 0) revert NothingToWithdraw();

        (bool ok, ) = msg.sender.call{ value: remaining }("");
        if (!ok) revert WithdrawFailed();
    }
}
