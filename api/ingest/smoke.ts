// Smoke test: exercise the appRouter directly (no HTTP server needed).
import "dotenv/config";
import { appRouter } from "../router";

const ctx = { req: new Request("http://localhost/"), resHeaders: new Headers(), user: undefined as any };
const caller = appRouter.createCaller(ctx as any);

const pitchers = await caller.players.pitchers({ maxEra: 3.5 });
console.log("pitchers era<=3.5:", pitchers.length);
const p = pitchers[0];
console.log("sample pitcher:", JSON.stringify(p, null, 1).slice(0, 700));

const batters = await caller.players.batters({ minAvg: 0.28 });
console.log("\nbatters avg>=.280:", batters.length);
console.log("sample batter:", JSON.stringify(batters[0], null, 1).slice(0, 700));

const slate = await caller.slate.today();
console.log("\nslate games:", slate.length, JSON.stringify(slate[0]));

const props = await caller.props.hitRates({ market: "Strikeouts" });
console.log("\nK props:", props.length, JSON.stringify(props[0]));

const runs = await caller.ingest.lastRuns();
console.log("\nlastRuns:", JSON.stringify(runs, null, 1).slice(0, 800));

const player = await caller.players.player({ sport: "mlb", id: p.id });
console.log("\nplayer detail:", player?.name, player?.kind);
