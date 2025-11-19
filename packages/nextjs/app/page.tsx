import Image from "next/image";
import type { NextPage } from "next";
import { ClockIcon, FlagIcon, RocketLaunchIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { FlagArt } from "~~/components/FlagArt";
import { Prizes } from "~~/components/Prizes";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

const rules = [
  {
    name: "Team Play",
    description:
      "Form a team of 1-4 players to tackle the challenges. Make sure to use the same address for all the challenges.",
    icon: UserGroupIcon,
  },
  {
    name: "NFT Flags",
    description:
      "A NFT flag will be minted to your account when a challenge is completed. Points are assigned only during the minting process and are non-transferrable.",
    icon: FlagIcon,
  },
  {
    name: "Time Limit: 3 Hours",
    description: "The game will last for 3 hours. The team with the most flags at the end of game will win.",
    icon: ClockIcon,
  },
  {
    name: "Tie Breaker",
    description: "If two or more teams have the same number of flags, the team who captured the flag earlier wins.",
    icon: RocketLaunchIcon,
  },
];

export const metadata = getMetadata({
  title: "BuidlGuidl CTF",
  description: "BuidlGuidl CTF Game @ Devconnect Argentina 2025",
});

const Home: NextPage = () => {
  return (
    <>
      <div className="pt-16 bg-[url(/dot-texture.svg)]">
        <div className="mx-auto max-w-7xl px-6 lg:flex lg:items-center lg:gap-x-10 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div className="mb-6">
              <Image
                src="/logo-devconnect.svg"
                alt="Devconnect Argentina 2025"
                width={220}
                height={130}
                className="h-14 w-auto md:h-20"
              />
            </div>
            <h1 className="font-dotGothic tracking-wide">
              <span className="block text-3xl md:text-4xl">BuidlGuidl Capture The Flag</span>
            </h1>
            <p className="mt-6 leading-relaxed md:leading-8 text-gray-50">
              Greetings Player. Welcome to the BuidlGuidl CTF Game.<br></br> Test your Ethereum development skills
              through 12 solidity challenges - participate solo or with a team of up to 4 members. <br></br>Upon
              completion of a challenge, you will mint a NFT flag and receive points. The team that mints the most flags
              wins. Good Luck...
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <a href="#rules" className="btn btn-primary btn-outline rounded-md">
                Learn More
              </a>
            </div>
          </div>
          <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-shrink-0 lg:flex-grow">
            <FlagArt />
          </div>
        </div>
        <div className="mt-20 flex flex-col">
          <div className="ml-auto bg-theme-color h-8 w-[20%] opacity-20"></div>
          <div className="ml-auto bg-theme-color h-8 w-[40%] opacity-40"></div>
          <div className="ml-auto bg-theme-color h-8 w-[60%] opacity-60"></div>
          <div className="ml-auto bg-theme-color h-8 w-[80%] opacity-80"></div>
          <div className="bg-theme-color-500 h-8 w-[100%]"></div>
        </div>
      </div>
      <div id="rules" className="bg-theme-color-500 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0">
            <h2 className="text-3xl font-dotGothic tracking-wide text-white md:text-4xl">Choose Your Own Adventure</h2>
            <p className="mt-6 leading-relaxed text-gray-100 md:leading-8 md:text-lg">
              Challenges will become more difficult as you progress. Beginners are encouraged to use this{" "}
              <a className="link" href="https://github.com/buidlguidl/ctf-argentina" target="_blank">
                Scaffold-ETH 2 repository
              </a>{" "}
              to solve the challenges. Advanced players may use any means necessary to progress.
            </p>
            <a href="#prizes" className="btn btn-outline text-white border-white rounded-md">
              View Prizes
            </a>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-24 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {rules.map(rule => (
                <div key={rule.name} className="flex flex-col">
                  <dt className="text-base font-semibold leading-7 text-white">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-theme-color-700">
                      <rule.icon aria-hidden="true" className="h-8 w-8 text-white" />
                    </div>
                    {rule.name}
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-gray-100">
                    <p className="flex-auto">{rule.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-theme-color-500 h-8 w-[100%]"></div>
        <div className="bg-theme-color h-8 w-[80%] opacity-80"></div>
        <div className="bg-theme-color h-8 w-[60%] opacity-60"></div>
        <div className="bg-theme-color h-8 w-[40%] opacity-40"></div>
        <div className="bg-theme-color h-8 w-[20%] opacity-20"></div>
      </div>
      <div id="prizes" className="py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-dotGothic tracking-wide text-white md:text-4xl">Prizes</h2>
          <Prizes />
          <p className="mt-12 leading-relaxed text-gray-100 text-lg md:leading-8 md:text-xl">
            Top 10 winners will receive $100 USD and awesome BuidlGuidl swag!
          </p>
        </div>
      </div>
    </>
  );
};

export default Home;
