import fs from "fs";
import path from "path";

export type ChallengeDoc = {
  number: number;
  content: string;
};

export const getChallengeDocs = async (): Promise<ChallengeDoc[]> => {
  const challengesDir = path.join(process.cwd(), "data", "challenges");
  const files = await fs.promises.readdir(challengesDir);

  return Promise.all(
    files
      .filter(f => f.endsWith(".md"))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(async file => ({
        number: parseInt(file.replace(".md", "")),
        content: await fs.promises.readFile(path.join(challengesDir, file), "utf8"),
      })),
  );
};
