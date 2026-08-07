"use client";

// @refresh reset
import { useCallback, useId, useRef, useState } from "react";
import { Balance } from "../Balance";
import { BlockieAvatar } from "../BlockieAvatar";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import CopyToClipboard from "react-copy-to-clipboard";
import type { Address } from "viem";
import { useDisconnect } from "wagmi";
import { useOutsideClick } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

const chipClassName = "rounded border px-2 py-1 text-[10px] font-bold tracking-wide font-mono";
const menuItemClassName = "w-full whitespace-nowrap rounded px-2 py-1.5 text-left hover:bg-[#00FBFF]/10";

/**
 * The site's one wallet control: compact terminal-style chip. Auth-aware on
 * /arena (where the RainbowKit authentication provider is mounted); plain
 * connect elsewhere.
 */
export const RainbowKitCustomConnectButton = () => {
  const { disconnect } = useDisconnect();
  const { targetNetwork } = useTargetNetwork();
  const [addressCopied, setAddressCopied] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  const closeDropdown = useCallback(() => dropdownRef.current?.removeAttribute("open"), []);
  // The covered site header keeps its own instance mounted under the arena, so
  // the QR modal's checkbox id must be unique per instance.
  const qrModalId = `qrcode-modal-${useId()}`;

  useOutsideClick(dropdownRef, closeDropdown);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const connected =
          mounted && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");
        const ready = mounted && authenticationStatus !== "loading";
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!ready ? (
              <button className={`${chipClassName} border-[#00FBFF]/40 text-[#00FBFF]`} type="button">
                CONNECT
              </button>
            ) : !account || !chain ? (
              <button
                className={`${chipClassName} border-[#00FBFF]/40 text-[#00FBFF] hover:bg-[#00FBFF]/10`}
                onClick={openConnectModal}
                type="button"
              >
                CONNECT
              </button>
            ) : chain.unsupported || chain.id !== targetNetwork.id ? (
              <button
                className={`${chipClassName} border-[#FF5861]/60 text-[#FF5861]`}
                onClick={openChainModal}
                type="button"
              >
                WRONG NETWORK
              </button>
            ) : authenticationStatus === "unauthenticated" ? (
              <div className="flex items-center gap-1.5">
                {/* The wallet about to sign, visible before it signs: a non-operator
                    address is only diagnosable here. */}
                <span className="font-mono text-[10px] text-[#00FBFF]/40">
                  {`${account.address.slice(0, 6)}…${account.address.slice(-4)}`}
                </span>
                <button
                  className={`${chipClassName} border-[#FFBE00]/50 text-[#FFBE00]`}
                  onClick={openConnectModal}
                  type="button"
                >
                  SIGN IN
                </button>
              </div>
            ) : connected ? (
              <div className="flex items-center gap-1.5">
                <Balance
                  address={account.address as Address}
                  className="text-[10px] text-[#00FBFF]/50 min-h-0 h-auto p-0"
                  usdMode
                />
                <details ref={dropdownRef} className="dropdown dropdown-end">
                  <summary className={`${chipClassName} border-[#00FBFF]/40 text-[#00FBFF] flex items-center gap-1.5`}>
                    <BlockieAvatar address={account.address} ensImage={account.ensAvatar} size={16} />
                    <span className="text-[11px]">{`${account.address.slice(0, 6)}…${account.address.slice(-4)}`}</span>
                    <span className="text-[8px]">▾</span>
                  </summary>
                  <ul
                    tabIndex={0}
                    className="dropdown-content bg-black border border-[#00FBFF]/25 rounded mt-1 z-[70] p-1 text-[11px] font-mono text-[#00FBFF] min-w-44"
                  >
                    <li>
                      <CopyToClipboard
                        text={account.address}
                        onCopy={() => {
                          setAddressCopied(true);
                          setTimeout(() => setAddressCopied(false), 800);
                        }}
                      >
                        <button className={menuItemClassName} type="button">
                          {addressCopied ? "COPIED" : "COPY ADDRESS"}
                        </button>
                      </CopyToClipboard>
                    </li>
                    <li>
                      <label
                        htmlFor={qrModalId}
                        className={`${menuItemClassName} block cursor-pointer`}
                        onClick={closeDropdown}
                      >
                        VIEW QR
                      </label>
                    </li>
                    {blockExplorerAddressLink && (
                      <li>
                        <a
                          className={`${menuItemClassName} block`}
                          href={blockExplorerAddressLink}
                          onClick={closeDropdown}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          VIEW ON EXPLORER
                        </a>
                      </li>
                    )}
                    <li>
                      <button
                        className={`${menuItemClassName} text-[#FF5861]`}
                        onClick={() => {
                          closeDropdown();
                          disconnect();
                        }}
                        type="button"
                      >
                        DISCONNECT
                      </button>
                    </li>
                  </ul>
                </details>
                <AddressQRCodeModal address={account.address as Address} modalId={qrModalId} />
              </div>
            ) : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
