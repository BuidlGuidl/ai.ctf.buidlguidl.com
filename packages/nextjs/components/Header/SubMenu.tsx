"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuLink } from "./types";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useOutsideClick } from "~~/hooks/scaffold-eth";

interface SubMenuProps {
  label: string;
  icon: React.ReactNode;
  sublinks: MenuLink[];
  isActive: boolean;
}

export const SubMenu: React.FC<SubMenuProps> = ({ label, sublinks, isActive }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const handleDropdownToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  useOutsideClick(buttonRef, () => {
    setIsOpen(false);
  });

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleDropdownToggle}
        className={`${
          isActive ? "text-yellow-400" : "text-green-400"
        } max-lg:hidden hover:text-green-300 py-1 px-2 text-sm flex items-center gap-1 bg-transparent border-0`}
      >
        <span className="text-gray-500">[</span>
        <span>{label}</span>
        <ChevronDownIcon className="h-4 w-4" />
        <span className="text-gray-500">]</span>
      </button>
      <ul
        className={`${
          isOpen ? "block" : "lg:hidden"
        } lg:absolute dropdown-end ml-0 z-[2] p-2 mt-1 bg-black border border-green-600 font-mono`}
      >
        {sublinks.map(sublink => (
          <li key={sublink.href} className="list-none">
            <Link
              href={sublink.href}
              className={`block px-3 py-1 text-sm hover:text-green-300 ${
                pathname === sublink.href ? "text-yellow-400" : "text-green-400"
              }`}
              onClick={handleLinkClick}
            >
              {sublink.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
