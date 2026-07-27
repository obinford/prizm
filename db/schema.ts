import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  decimal,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Prizm live-data model (ingested from statsapi.mlb.com + api-web.nhle.com)
// ---------------------------------------------------------------------------

/** A real player from the MLB/NHL source APIs. `slug` is the frontend id. */
export const players = mysqlTable(
  "players",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sport: mysqlEnum("sport", ["mlb", "nhl"]).notNull(),
    extId: int("extId").notNull(), // source API id (MLBAM id / NHL player id)
    slug: varchar("slug", { length: 140 }).notNull(), // frontend string id
    name: varchar("name", { length: 120 }).notNull(),
    team: varchar("team", { length: 8 }).notNull(),
    pos: varchar("pos", { length: 16 }).notNull().default(""),
    hand: varchar("hand", { length: 4 }).notNull().default(""), // bats/shoots/catches (throws for pitchers)
    role: varchar("role", { length: 16 }).notNull(), // 'pitcher'|'batter'|'goalie'|'skater'
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("players_sport_extId_uq").on(t.sport, t.extId),
    uniqueIndex("players_sport_slug_uq").on(t.sport, t.slug),
    index("players_role_idx").on(t.sport, t.role),
  ],
);

/** Season line per player. statsJson uses the frontend modules' field names. */
export const seasonStats = mysqlTable(
  "season_stats",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    playerId: bigint("playerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    statsJson: text("statsJson").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("season_stats_player_uq").on(t.playerId)],
);

/** Rolling window stats. MLB windows L30/L60/L90/L120 (PA for batters, BF for
 * pitchers); NHL windows MIN60/MIN120/MIN180/MIN240 (minutes of TOI) — keys
 * match the frontend modules exactly. */
export const windowStats = mysqlTable(
  "window_stats",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    playerId: bigint("playerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    window: varchar("window", { length: 8 }).notNull(),
    statsJson: text("statsJson").notNull(),
    sample: int("sample").notNull().default(0), // PA / BF / minutes in window
    computedAt: timestamp("computedAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("window_stats_player_window_uq").on(t.playerId, t.window)],
);

/** Raw per-game logs (one row per player per game) — source for windows/props. */
export const gameLogs = mysqlTable(
  "game_logs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    playerId: bigint("playerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gameDate: varchar("gameDate", { length: 10 }).notNull(), // YYYY-MM-DD
    extGameId: varchar("extGameId", { length: 32 }).notNull().default(""),
    statsJson: text("statsJson").notNull(), // raw stat line from the source API
  },
  (t) => [
    uniqueIndex("game_logs_player_game_uq").on(t.playerId, t.gameDate, t.extGameId),
  ],
);

/** Team-level stats (e.g. MLB bullpen season lines). */
export const teamStats = mysqlTable(
  "team_stats",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sport: mysqlEnum("sport", ["mlb", "nhl"]).notNull(),
    team: varchar("team", { length: 8 }).notNull(),
    statsJson: text("statsJson").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("team_stats_sport_team_uq").on(t.sport, t.team)],
);

/** One day's slate of games (probablesJson: {away?, home?, awayPlayerId?, homePlayerId?}). */
export const slateGames = mysqlTable(
  "slate_games",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sport: mysqlEnum("sport", ["mlb", "nhl"]).notNull(),
    extGameId: varchar("extGameId", { length: 32 }).notNull(),
    gameDate: varchar("gameDate", { length: 10 }).notNull(), // YYYY-MM-DD
    startTime: varchar("startTime", { length: 16 }).notNull().default(""), // 'H:MM PM ET'
    away: varchar("away", { length: 8 }).notNull(),
    home: varchar("home", { length: 8 }).notNull(),
    venue: varchar("venue", { length: 120 }).notNull().default(""),
    probablesJson: text("probablesJson"),
    weatherJson: text("weatherJson"),
  },
  (t) => [
    uniqueIndex("slate_games_ext_uq").on(t.extGameId),
    index("slate_games_date_idx").on(t.gameDate),
  ],
);

/** Derived prop lines (no odds feed — prices flat -115 illustrative).
 * opponent/gameId denormalized from the current slate for direct rendering. */
export const props = mysqlTable(
  "props",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sport: mysqlEnum("sport", ["mlb", "nhl"]).notNull(),
    playerId: bigint("playerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    market: varchar("market", { length: 24 }).notNull(),
    line: decimal("line", { precision: 4, scale: 1 }).notNull(),
    priceOver: int("priceOver").notNull().default(-115),
    priceUnder: int("priceUnder").notNull().default(-115),
    l5: decimal("l5", { precision: 4, scale: 3 }).notNull().default("0"),
    l10: decimal("l10", { precision: 4, scale: 3 }).notNull().default("0"),
    l20: decimal("l20", { precision: 4, scale: 3 }).notNull().default("0"),
    opponent: varchar("opponent", { length: 16 }).notNull().default(""),
    gameId: varchar("gameId", { length: 48 }).notNull().default(""),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("props_player_market_uq").on(t.playerId, t.market)],
);

/** Saved user angles (My Angles worksheet). JSON blobs mirror the frontend
 * canonical Angle shape (tags[], AngleSnapshot). */
export const angles = mysqlTable(
  "angles",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sport: mysqlEnum("sport", ["mlb", "nhl"]).notNull().default("mlb"),
    type: varchar("type", { length: 8 }).notNull().default("note"), // table|ai|edge|note
    title: varchar("title", { length: 200 }).notNull(),
    note: text("note").notNull(),
    tagsJson: text("tagsJson").notNull(),
    snapshotJson: text("snapshotJson").notNull(),
    shared: boolean("shared").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => [index("angles_user_idx").on(t.userId)],
);

/** Players a user follows. */
export const follows = mysqlTable(
  "follows",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    playerId: bigint("playerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("follows_user_player_uq").on(t.userId, t.playerId)],
);

/** Audit log for ingestion runs. */
export const ingestionRuns = mysqlTable("ingestion_runs", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  source: varchar("source", { length: 16 }).notNull(), // mlb|nhl|slate|props
  status: varchar("status", { length: 16 }).notNull(), // running|ok|error
  rows: int("rows").notNull().default(0),
  message: text("message"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type SeasonStat = typeof seasonStats.$inferSelect;
export type WindowStat = typeof windowStats.$inferSelect;
export type GameLog = typeof gameLogs.$inferSelect;
export type TeamStat = typeof teamStats.$inferSelect;
export type SlateGameRow = typeof slateGames.$inferSelect;
export type PropRow = typeof props.$inferSelect;
export type AngleRow = typeof angles.$inferSelect;
export type FollowRow = typeof follows.$inferSelect;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
