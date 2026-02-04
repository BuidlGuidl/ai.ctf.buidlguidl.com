import { ChallengeContractLink } from "./ChallengeContractLink";
import { MDXRemote } from "next-mdx-remote/rsc";

interface ChallengeSectionProps {
  challengeNumber: number;
  content: string;
}

export const ChallengeSection = ({ challengeNumber, content }: ChallengeSectionProps) => {
  return (
    <div className="border border-green-600 p-6">
      <div className="flex items-center gap-4 mb-6">
        <span className="text-yellow-400 text-xl font-bold">
          [ CHALLENGE {String(challengeNumber).padStart(2, "0")} ]
        </span>
      </div>

      <div className="prose prose-invert max-w-none prose-headings:text-green-400 prose-headings:font-mono prose-h1:text-lg prose-h1:mb-4 prose-p:text-gray-300 prose-a:text-cyan-400 prose-li:text-gray-300 prose-h2:text-base prose-h2:text-yellow-400/80 prose-h2:mt-6">
        <MDXRemote source={content} />
      </div>

      <div className="mt-6 pt-4 border-t border-green-600/50">
        <span className="text-gray-500">Contract: </span>
        <ChallengeContractLink challengeNumber={challengeNumber} />
      </div>
    </div>
  );
};
