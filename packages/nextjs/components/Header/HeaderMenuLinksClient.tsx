"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SubMenu } from "./SubMenu";
import { MenuLink } from "./types";
import { useAccount } from "wagmi";

export const HeaderMenuLinksClient = ({ menuLinks }: { menuLinks: MenuLink[] }) => {
  const pathname = usePathname();
  const { address: connectedAddress } = useAccount();

  const finalMenuLinks = [
    // Add profile link if there is a connected address
    ...(connectedAddress
      ? [
          {
            label: "/profile",
            href: `/profile/${connectedAddress}`,
          },
        ]
      : []),
    ...menuLinks,
  ] as MenuLink[];

  return (
    <>
      {finalMenuLinks.map(({ label, href, icon, sublinks }) => {
        const isActive = pathname === href || (sublinks && sublinks.some(sublink => pathname === sublink.href));
        const hasSublinks = sublinks && sublinks.length > 0;

        return (
          <li key={label} className={`relative list-none ${hasSublinks ? "dropdown" : ""}`}>
            {hasSublinks ? (
              <SubMenu label={label} icon={icon} sublinks={sublinks} isActive={Boolean(isActive)} />
            ) : (
              <Link
                href={href}
                passHref
                className={`${
                  isActive ? "text-yellow-400" : "text-green-400"
                } hover:text-green-300 py-1 px-2 text-sm flex items-center gap-1`}
              >
                <span className="text-gray-500">[</span>
                <span>{label}</span>
                <span className="text-gray-500">]</span>
              </Link>
            )}
          </li>
        );
      })}
    </>
  );
};
