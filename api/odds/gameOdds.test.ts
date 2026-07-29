// FIX 19 tests — pure pieces of the game-odds module only. Nothing here
// touches the network, process.env at import time, or the cache: the suite
// must stay green on a clean checkout with no .env present (FIX 11).

import { describe, expect, it } from "vitest";
import {
  joinOddsToSlate,
  ODDS_NAME_TO_ABBR,
  parseEvent,
  _resetGameOddsForTest,
} from "./gameOdds";
import { MLB_TEAMS } from "../../src/data/mlbTeams";

// ── 1. The explicit display-name map covers all 30 clubs ─────────────────
// The canonical abbr set is the local 30-team list normalized toward MLBAM
// style (ARI → AZ, the one alias). A renamed or relocated club must break
// this test loudly, not miss joins silently in production.

describe("ODDS_NAME_TO_ABBR", () => {
  it("covers all 30 MLBAM-style abbreviations (ATH twice — documented legacy alias)", () => {
    const want = new Set(MLB_TEAMS.map((t) => (t.abbr === "ARI" ? "AZ" : t.abbr)));
    expect(want.size).toBe(30);
    const got = Object.values(ODDS_NAME_TO_ABBR);
    for (const abbr of want) {
      // "Athletics" + legacy "Oakland Athletics" both map to ATH by design.
      expect(got.filter((a) => a === abbr).length).toBe(abbr === "ATH" ? 2 : 1);
    }
  });

  it("maps the display names the provider actually sends (spot checks)", () => {
    expect(ODDS_NAME_TO_ABBR["Cleveland Guardians"]).toBe("CLE");
    expect(ODDS_NAME_TO_ABBR["Athletics"]).toBe("ATH");
    expect(ODDS_NAME_TO_ABBR["Oakland Athletics"]).toBe("ATH"); // legacy alias
    expect(ODDS_NAME_TO_ABBR["Chicago White Sox"]).toBe("CWS");
    expect(ODDS_NAME_TO_ABBR["St. Louis Cardinals"]).toBe("STL");
  });
});

// ── 2. parseEvent — cross-book aggregation, no fuzzy matching ────────────

const BOOKS = (
  awayName: string,
  homeName: string,
  over: number,
  under: number,
  ml: [number, number], // [awayPrice, homePrice]
  rl: [number, number], // [awayPrice, homePrice]
  tot: number,
) => [
  {
    markets: [
      {
        key: "h2h",
        outcomes: [
          { name: awayName, price: ml[0] },
          { name: homeName, price: ml[1] },
        ],
      },
      {
        key: "spreads",
        outcomes: [
          { name: awayName, price: rl[0], point: 1.5 },
          { name: homeName, price: rl[1], point: -1.5 },
        ],
      },
      {
        key: "totals",
        outcomes: [
          { name: "Over", price: over, point: tot },
          { name: "Under", price: under, point: tot },
        ],
      },
    ],
  },
];

describe("parseEvent", () => {
  it("aggregates h2h/spreads/totals across bookmakers", () => {
    const raw = {
      home_team: "Boston Red Sox",
      away_team: "New York Yankees",
      commence_time: "2026-07-28T23:05:00Z",
      bookmakers: [
        ...BOOKS("New York Yankees", "Boston Red Sox", -110, -110, [-135, 115], [-160, 140], 8.5),
        ...BOOKS("New York Yankees", "Boston Red Sox", -105, -115, [-130, 110], [-150, 130], 9),
      ],
    };
    const e = parseEvent(raw)!;
    expect(e.awayAbbr).toBe("NYY");
    expect(e.homeAbbr).toBe("BOS");
    expect(e.prices.moneylineAway).toBe(-132); // prob-mean of -135/-130
    expect(e.prices.moneylineHome).toBe(112); // prob-mean of +115/+110
    expect(e.prices.runline).toBe(-1.5); // home point
    expect(e.prices.runlineHomePrice).toBe(135);
    expect(e.prices.runlineAwayPrice).toBe(-155);
    // Books disagreed on the total (8.5 vs 9, 1 book each): the tie breaks
    // to the LOWER line and prices come ONLY from books dealing that line.
    expect(e.prices.total).toBe(8.5);
    expect(e.prices.totalOverPrice).toBe(-110);
    expect(e.prices.totalUnderPrice).toBe(-110);
    expect(e.prices.bookCount).toBe(2);
  });

  it("takes the modal line when books disagree — never averages across lines", () => {
    // The real PHI@MIA shape from the first live pull: 6 books deal 6.5,
    // 3 deal 7.5, 2 deal 7.0. A naive mean of over prices was -40 — a
    // price no book ever offered. Modal line = 6.5; prices from those 6.
    const at = (over: number, under: number, point: number) => ({
      markets: [
        { key: "totals", outcomes: [
          { name: "Over", price: over, point },
          { name: "Under", price: under, point },
        ] },
      ],
    });
    const e = parseEvent({
      home_team: "Miami Marlins",
      away_team: "Philadelphia Phillies",
      commence_time: "2026-07-29T16:10:00Z",
      bookmakers: [
        at(-132, 100, 6.5), at(-130, 100, 6.5), at(-130, 100, 6.5),
        at(-130, 100, 6.5), at(-135, 105, 6.5), at(-130, 100, 6.5),
        at(-111, -125, 7.5), at(105, -125, 7.5), at(107, -123, 7.5),
        at(-106, -132, 7), at(-125, 105, 7),
      ],
    })!;
    expect(e.prices.total).toBe(6.5);
    expect(e.prices.totalOverPrice).toBe(-131); // prob-mean of the six 6.5 overs
    expect(e.prices.totalUnderPrice).toBe(101); // prob-mean of the six 6.5 unders
  });

  it("returns null for a team outside the explicit map — never a fuzzy guess", () => {
    expect(
      parseEvent({
        home_team: "Savannah Bananas",
        away_team: "New York Yankees",
        commence_time: "2026-07-28T23:05:00Z",
        bookmakers: [],
      }),
    ).toBeNull();
  });

  it("nulls a market no book offered rather than inventing a price", () => {
    const e = parseEvent({
      home_team: "Boston Red Sox",
      away_team: "New York Yankees",
      commence_time: "2026-07-28T23:05:00Z",
      bookmakers: [{ markets: [] }],
    })!;
    expect(e.prices.moneylineHome).toBeNull();
    expect(e.prices.total).toBeNull();
  });
});

// ── 3. joinOddsToSlate — pair+date key, doubleheader tiebreak, dash-out ──

describe("joinOddsToSlate", () => {
  const mkEvent = (away: string, home: string, commence: string) => {
    const raw = {
      home_team: home,
      away_team: away,
      commence_time: commence,
      bookmakers: BOOKS(away, home, -110, -110, [-120, 100], [-150, 130], 8.5),
    };
    const e = parseEvent(raw)!;
    return e;
  };

  it("joins on team pair + ET date; a miss is null and NAMED", () => {
    const events = [mkEvent("New York Yankees", "Boston Red Sox", "2026-07-28T23:05:00Z")];
    const { prices, misses } = joinOddsToSlate(
      events,
      [
        { away: "NYY", home: "BOS" },
        { away: "CLE", home: "DET" }, // no event → dash
      ],
      "2026-07-28",
    );
    expect(prices[0]?.moneylineAway).toBe(-120);
    expect(prices[1]).toBeNull();
    expect(misses).toEqual(["CLE@DET — no event for pair+date"]);
  });

  it("normalizes the ARI → AZ alias on the slate side", () => {
    const events = [mkEvent("Los Angeles Dodgers", "Arizona Diamondbacks", "2026-07-29T01:40:00Z")];
    const { prices, misses } = joinOddsToSlate(
      events,
      [{ away: "LAD", home: "ARI" }], // local seed style
      "2026-07-28", // 9:40 PM ET start is still the 28th in ET
    );
    expect(misses).toEqual([]);
    expect(prices[0]?.moneylineHome).toBe(100);
  });

  it("does not join a game to the wrong day of a series (same pair, two dates)", () => {
    const events = [
      mkEvent("New York Yankees", "Boston Red Sox", "2026-07-28T23:05:00Z"),
      mkEvent("New York Yankees", "Boston Red Sox", "2026-07-29T23:05:00Z"),
    ];
    const { prices, misses } = joinOddsToSlate(events, [{ away: "NYY", home: "BOS" }], "2026-07-29");
    expect(misses).toEqual([]);
    expect(prices[0]).not.toBeNull();
    // The 28th's event must remain unclaimed for its own slate.
    const day1 = joinOddsToSlate(events, [{ away: "NYY", home: "BOS" }], "2026-07-28");
    expect(day1.misses).toEqual([]);
  });

  it("breaks a doubleheader by commence_time proximity to the slate start", () => {
    _resetGameOddsForTest();
    const events = [
      mkEvent("New York Mets", "Philadelphia Phillies", "2026-07-28T17:05:00Z"), // game 1, 1:05 PM ET
      mkEvent("New York Mets", "Philadelphia Phillies", "2026-07-28T23:05:00Z"), // game 2, 7:05 PM ET
    ];
    const { prices, doubleheaders } = joinOddsToSlate(
      events,
      [
        { away: "NYM", home: "PHI", startUtc: "2026-07-28T17:10:00Z" }, // afternoon game (slate order)
        { away: "NYM", home: "PHI", startUtc: "2026-07-28T22:55:00Z" }, // evening game
      ],
      "2026-07-28",
    );
    // The first game saw both candidates and was disambiguated by proximity;
    // the second then had exactly one unclaimed event left.
    expect(doubleheaders).toBe(1);
    // Both games joined — and to DIFFERENT events (the used-set guarantees it).
    expect(prices[0]).not.toBeNull();
    expect(prices[1]).not.toBeNull();
    expect(prices[0]).not.toBe(prices[1]);
    // The afternoon slate game must own the AFTERNOON event's prices object.
    expect(prices[0]).toBe(events[0].prices);
    expect(prices[1]).toBe(events[1].prices);
  });
});
