import Challenge1 from "../../hardhat/contracts/Challenge1.sol";
import Challenge2 from "../../hardhat/contracts/Challenge2.sol";
import Challenge3 from "../../hardhat/contracts/Challenge3.sol";
import Challenge4 from "../../hardhat/contracts/Challenge4.sol";
import Challenge5 from "../../hardhat/contracts/Challenge5.sol";
import Challenge6 from "../../hardhat/contracts/Challenge6.sol";
import Challenge7 from "../../hardhat/contracts/Challenge7.sol";
import Challenge8 from "../../hardhat/contracts/Challenge8.sol";
import Challenge9 from "../../hardhat/contracts/Challenge9.sol";
import Challenge10 from "../../hardhat/contracts/Challenge10.sol";
import Challenge11 from "../../hardhat/contracts/Challenge11.sol";
import Challenge12 from "../../hardhat/contracts/Challenge12.sol";

// The Solidity every challenge is played against, bundled straight from
// packages/hardhat so the arena can show the code without a round trip.
export const CHALLENGE_SOURCES: Record<number, string> = {
  1: Challenge1,
  2: Challenge2,
  3: Challenge3,
  4: Challenge4,
  5: Challenge5,
  6: Challenge6,
  7: Challenge7,
  8: Challenge8,
  9: Challenge9,
  10: Challenge10,
  11: Challenge11,
  12: Challenge12,
};

export const challengeContractName = (id: number) => `Challenge${id}`;

export const challengeSourceUrl = (id: number) =>
  `https://github.com/BuidlGuidl/ai.ctf.buidlguidl.com/blob/main/packages/hardhat/contracts/Challenge${id}.sol`;
