// FIX 8: a flat-priced row (oddsSource "flat" — no real odds feed behind it)
// must NEVER carry an edgeScore or a priceAlert. hasRealOdds() already gates
// the de-vig math client-side, but these two fields are the ones that sort
// the board and render the badge — a price alert on a price that does not
// exist is fabrication in the surface a user acts from.

import { describe, expect, it } from "vitest";
import { toPropLine } from "./propsRouter";
import type { PropRow } from "@db/schema";

const flatRow = {
  id: 796,
  sport: "nhl",
  playerId: 1,
  market: "Points",
  line: "0.5",
  priceOver: -115,
  priceUnder: -115,
  opponent: "vs FLA",
  gameId: "nhl-fla-car",
  l5: "1",
  l10: "0.9",
  l20: "0.7",
  updatedAt: new Date(),
} as unknown as PropRow;

const player = { slug: "andrei-svechnikov", name: "Andrei Svechnikov", team: "CAR" };

describe("FIX 8 — flat-priced rows carry no edge signal", () => {
  it("toPropLine returns null edgeScore and null priceAlert (not a number, not false)", () => {
    const line = toPropLine(flatRow, player);
    expect(line.oddsSource).toBe("flat");
    expect(line.edgeScore).toBeNull();
    expect(line.priceAlert).toBeNull();
  });

  it("hit rates still populate — the row is honest about what it knows", () => {
    const line = toPropLine(flatRow, player);
    expect(line.hitRates).toEqual({ L5: 1, L10: 0.9, L20: 0.7 });
    expect(line.overPrice).toBe(-115);
    expect(line.underPrice).toBe(-115);
  });

  it("sorts and badges treat null as no-signal (null ?? 0 sinks, null is falsy)", () => {
    const line = toPropLine(flatRow, player);
    // The board sorts on (edgeScore ?? 0) — a null score must sit at the
    // bottom, never above a real-odds row. Badges render on truthiness —
    // null must not badge.
    expect(line.edgeScore ?? 0).toBe(0);
    expect(Boolean(line.priceAlert)).toBe(false);
  });
});
