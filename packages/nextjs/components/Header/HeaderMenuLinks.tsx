import { HeaderMenuLinksClient } from "./HeaderMenuLinksClient";
import { MenuLink } from "./types";
import fs from "fs/promises";
import path from "path";

async function getChallenges() {
  const challengesDir = path.join(process.cwd(), "data", "challenges");
  const files = await fs.readdir(challengesDir);
  const challenges = files.map(file => path.parse(file).name).sort((a, b) => Number(a) - Number(b));

  return challenges.map(challenge => ({
    label: `#${challenge.padStart(2, "0")}`,
    href: `/challenge/${challenge}`,
  }));
}

export const HeaderMenuLinks = async () => {
  const challenges = await getChallenges();

  const menuLinks: MenuLink[] = [
    {
      label: "/challenges",
      href: "#",
      sublinks: challenges,
    },
    {
      label: "/leaderboard",
      href: "/leaderboard",
    },
    {
      label: "/debug",
      href: "/debug",
    },
  ];

  return <HeaderMenuLinksClient menuLinks={menuLinks} />;
};
