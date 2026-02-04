import { HeaderMenuLinksClient } from "./HeaderMenuLinksClient";
import { MenuLink } from "./types";

export const HeaderMenuLinks = () => {
  const menuLinks: MenuLink[] = [
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
