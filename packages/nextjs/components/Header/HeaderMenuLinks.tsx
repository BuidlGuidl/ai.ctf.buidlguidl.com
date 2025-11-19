import { HeaderMenuLinksClient } from "./HeaderMenuLinksClient";
import { MenuLink } from "./types";

export const HeaderMenuLinks = async () => {
  const menuLinks: MenuLink[] = [];

  return <HeaderMenuLinksClient menuLinks={menuLinks} />;
};
