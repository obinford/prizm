// Authed-procedure smoke: angles + follows with a fabricated user context.
import "dotenv/config";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

// ensure a smoke user exists
const db = getDb();
let [user] = await db.select().from(users).where(eq(users.unionId, "smoke-user")).limit(1);
if (!user) {
  const [{ id }] = await db
    .insert(users)
    .values({ unionId: "smoke-user", name: "Smoke Test", email: "smoke@prizm.local", role: "admin" })
    .$returningId();
  [user] = (await db.select().from(users).where(eq(users.id, id)).limit(1)) as any;
}
const ctx = { req: new Request("http://localhost/"), resHeaders: new Headers(), user };
const caller = appRouter.createCaller(ctx as any);

// angles CRUD + duplicate
const created = await caller.angles.create({
  title: "Smoke angle",
  sport: "mlb",
  type: "note",
  note: "created by smoke test",
  tags: ["smoke"],
  snapshot: { kind: "text", source: "smoke", text: "hello" },
});
console.log("angle created:", created.id, created.title, created.createdAt > 0);
const list1 = await caller.angles.list();
console.log("angles list:", list1.length);
const updated = await caller.angles.update({ id: Number(created.id), patch: { title: "Smoke angle v2", tags: ["smoke", "v2"] } });
console.log("angle updated:", updated.title, updated.tags);
const dup = await caller.angles.duplicate({ id: Number(created.id) });
console.log("angle duplicated:", dup.title);
await caller.angles.delete({ id: Number(dup.id) });
await caller.angles.delete({ id: Number(created.id) });
console.log("angles after delete:", (await caller.angles.list()).length);

// follows add/list/remove
const f = await caller.follows.add({ sport: "mlb", playerId: "tarik-skubal" });
console.log("follow added:", f.playerId, f.name, f.role);
console.log("follows list:", JSON.stringify(await caller.follows.list()));
await caller.follows.remove({ sport: "mlb", playerId: "tarik-skubal" });
console.log("follows after remove:", (await caller.follows.list()).length);

// NHL shapes
const goalies = await caller.players.goalies({ minSvPct: 0.91 });
console.log("\ngoalies sv>=.910:", goalies.length, JSON.stringify(goalies[0]).slice(0, 400));
const skaters = await caller.players.skaters({ pos: "C", minSog: 3 });
console.log("skaters C sog>=3:", skaters.length, JSON.stringify(skaters[0]).slice(0, 400));
const alerts = await caller.props.alerts();
console.log("\nalerts:", alerts.length, JSON.stringify(alerts[0]));
const nhlSlate = await caller.slate.today({ sport: "nhl" });
console.log("nhl slate:", nhlSlate.length, JSON.stringify(nhlSlate[0]));
const bullpens = await caller.slate.bullpens();
console.log("bullpens:", bullpens.length, JSON.stringify(bullpens[0]));
process.exit(0);
