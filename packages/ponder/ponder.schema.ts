import { index, onchainTable, relations } from "ponder";

// GraphQL field names come from the exported variable name, so `team` serves `team` / `teams`.
export const team = onchainTable("team", t => ({
  id: t.hex().primaryKey(),
  name: t.text(),
  size: t.integer(),
  points: t.integer().notNull(),
  updated: t.integer().notNull(),
  sortOrder: t.bigint().notNull(),
}));

export const teamRelations = relations(team, ({ many }) => ({
  challenges: many(challenge),
}));

export const challenge = onchainTable(
  "challenge",
  t => ({
    id: t.bigint().primaryKey(),
    challengeId: t.bigint().notNull(),
    tokenURI: t.text().notNull(),
    points: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    ownerId: t.hex().notNull(),
  }),
  table => ({
    // Relations don't create indexes, and every team row resolves its challenges by ownerId.
    ownerIdx: index().on(table.ownerId),
  }),
);

export const challengeRelations = relations(challenge, ({ one }) => ({
  owner: one(team, {
    fields: [challenge.ownerId],
    references: [team.id],
  }),
}));
