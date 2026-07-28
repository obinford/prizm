// Daily brief data — Step 11: Quick Alerts (schedule-derived) and the
// Hot/Cold batter matchup ranks. Server-side because both join feeds the
// client never sees raw: the statsapi schedule range, venue coordinates,
// Ballpark Pal park factors, and the sv_* warehouse.
//
// Quick Alerts recon (2026-07-28, verified live):
// - statsapi schedule RANGES ARE NOT CAPPED. A 15-day request returned 14
//   date entries because 2026-07-15 was a league-wide off day (All-Star
//   break) — zero games even when queried alone. A 25-day range returned
//   23 entries / 302 games with totalItems matching the per-date sum.
//   Completeness check below: returned game count === totalItems. The
//   brief author's "7 of 14" was off days plus fetch truncation, not an
//   API cap; no paging is needed at our window sizes.
// - /api/v1/venues?venueIds=…&hydrate=location DOES return coordinates
//   (location.defaultCoordinates.latitude/longitude, plus city/state) —
//   the travel alert is buildable without guessing. Verified on venue 2681.
// - The weather HR verdict reads Ballpark Pal game-level homeRunsPercent
//   through the same 5-minute cache as the Weather tab.
//
// Hot/Cold: everything comes from sv_stat_cache + sv_slate. Batter split is
// the SEASON vs-hand row (vsL/vsR) — sv does not cross l30 with hand, and
// the card says exactly which split it shows. There is no OPS: OBP is not
// in the warehouse, so the card carries AVG / xwOBA / K% and names them.
// PA/TBF counts are always shown — a rate over 12 PA is a small sample and
// the card must not hide it (same discipline as the Wilson interval).

import { createRouter, publicQuery } from "./middleware";
import { getParkFactors } from "./ballparkpal";
import { getSavantSlate, getStatIndex, statFor, TEAM_ID_TO_ABBR } from "./supabase/savant";

const STATSAPI = "https://statsapi.mlb.com/api/v1";
const SCHEDULE_CACHE_TTL_MS = 5 * 60_000;

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── schedule range ──────────────────────────────────────────────────────────

interface SchedTeam {
  team: { id: number; name: string };
}
interface SchedGame {
  gamePk: number;
  officialDate: string;
  venue: { id: number; name: string };
  teams: { away: SchedTeam; home: SchedTeam };
}
interface SchedDate {
  date: string;
  games?: SchedGame[];
}

let schedCache: { at: number; start: string; end: string; dates: SchedDate[]; totalItems: number } | null =
  null;

async function getScheduleRange(start: string, end: string) {
  if (
    schedCache &&
    schedCache.start === start &&
    schedCache.end === end &&
    Date.now() - schedCache.at < SCHEDULE_CACHE_TTL_MS
  ) {
    return schedCache;
  }
  const url = `${STATSAPI}/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=venue`;
  const res = await fetch(url, { headers: { "user-agent": "prizm/1.0", accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from statsapi schedule range`);
  const body = (await res.json()) as { dates?: SchedDate[]; totalItems?: number };
  schedCache = {
    at: Date.now(),
    start,
    end,
    dates: body.dates ?? [],
    totalItems: body.totalItems ?? 0,
  };
  return schedCache;
}

// ── venue coordinates (static — cached for the process lifetime) ────────────

interface VenueGeo {
  id: number;
  name: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
}

const venueGeoCache = new Map<number, VenueGeo | null>();

async function getVenueGeo(ids: number[]): Promise<Map<number, VenueGeo | null>> {
  const missing = ids.filter((id) => !venueGeoCache.has(id));
  if (missing.length > 0) {
    const url = `${STATSAPI}/venues?venueIds=${missing.join(",")}&hydrate=location`;
    const res = await fetch(url, {
      headers: { "user-agent": "prizm/1.0", accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from statsapi venues`);
    const body = (await res.json()) as {
      venues?: {
        id: number;
        name: string;
        location?: { city?: string; defaultCoordinates?: { latitude?: number; longitude?: number } };
      }[];
    };
    const seen = new Set<number>();
    for (const v of body.venues ?? []) {
      seen.add(v.id);
      venueGeoCache.set(v.id, {
        id: v.id,
        name: v.name,
        city: v.location?.city ?? null,
        lat: v.location?.defaultCoordinates?.latitude ?? null,
        lon: v.location?.defaultCoordinates?.longitude ?? null,
      });
    }
    // A venue id the feed did not return is cached as null — listed, never guessed.
    for (const id of missing) if (!seen.has(id)) venueGeoCache.set(id, null);
  }
  return venueGeoCache;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Compass-ish direction label. Longitude dominates at baseball distances.
 * dLon < 0 means the destination is further WEST (more negative longitude). */
function directionLabel(dLat: number, dLon: number): string {
  const ew = dLon < -2 ? "East → West" : dLon > 2 ? "West → East" : null;
  const ns = dLat > 2 ? "South → North" : dLat < -2 ? "North → South" : null;
  if (ew && ns) return `${ns}, ${ew}`;
  return ew ?? ns ?? "Short hop";
}

// ── quick alerts ────────────────────────────────────────────────────────────

export interface NoOffDayAlert {
  team: string; // Prizm abbr
  days: number;
  since: string; // first date of the streak
}

export interface TravelAlert {
  team: string;
  fromVenue: string;
  toVenue: string;
  direction: string;
  miles: number;
}

export interface WeatherHrAlert {
  gamePk: number;
  matchup: string; // "AWAY @ HOME"
  homeRunsPercent: number;
  verdict: "good" | "poor";
}

const NO_OFF_DAY_MIN = 7;
const TRAVEL_MIN_MILES = 250;
// Prizm display cutoffs for the HR verdict, not provider labels (same
// thresholds as the Weather tab card).
const HR_GOOD_PCT = 10;
const HR_POOR_PCT = -10;

async function quickAlerts() {
  const today = todayEt();
  // 18 days back so a streak of up to 18 straight game days is measured, not
  // truncated at the window edge; 1 day forward so tonight is included.
  const start = shiftDate(today, -18);
  const end = shiftDate(today, 1);
  const { dates, totalItems } = await getScheduleRange(start, end);

  const games: SchedGame[] = dates.flatMap((d) => d.games ?? []);
  const gamesReturned = games.length;

  // team abbr → set of officialDates with at least one game, plus per-date
  // venues (last game of the day wins — doubleheaders share a venue).
  const daysByTeam = new Map<string, Set<string>>();
  const venueByTeamDate = new Map<string, { venueId: number; venueName: string }>();
  const abbrOf = (id: number) => TEAM_ID_TO_ABBR[id];
  for (const g of games) {
    const away = abbrOf(g.teams.away.team.id);
    const home = abbrOf(g.teams.home.team.id);
    for (const abbr of [away, home]) {
      if (!abbr) continue;
      (daysByTeam.get(abbr) ?? daysByTeam.set(abbr, new Set()).get(abbr)!).add(g.officialDate);
      venueByTeamDate.set(`${abbr}:${g.officialDate}`, { venueId: g.venue.id, venueName: g.venue.name });
    }
  }

  // 1) No off day in 7+ days — consecutive game days ending today.
  const noOffDay: NoOffDayAlert[] = [];
  for (const [team, days] of daysByTeam) {
    if (!days.has(today)) continue; // streak must be live tonight
    let streak = 0;
    let cursor = today;
    while (days.has(cursor)) {
      streak++;
      cursor = shiftDate(cursor, -1);
    }
    if (streak >= NO_OFF_DAY_MIN) {
      noOffDay.push({ team, days: streak, since: shiftDate(cursor, 1) });
    }
  }
  noOffDay.sort((a, b) => b.days - a.days);

  // 2) Travel — venue change between the previous game day and today, with
  // real coordinates. Venues without coordinates are skipped and counted,
  // never guessed.
  const travel: TravelAlert[] = [];
  let skippedNoCoords = 0;
  const geoIds = new Set<number>();
  const candidates: { team: string; from: string; to: string }[] = [];
  for (const [team, days] of daysByTeam) {
    if (!days.has(today)) continue;
    // most recent prior game day
    let cursor = shiftDate(today, -1);
    let prev: string | null = null;
    for (let i = 0; i < 20; i++) {
      if (days.has(cursor)) {
        prev = cursor;
        break;
      }
      cursor = shiftDate(cursor, -1);
    }
    if (!prev) continue;
    const from = venueByTeamDate.get(`${team}:${prev}`);
    const to = venueByTeamDate.get(`${team}:${today}`);
    if (!from || !to || from.venueId === to.venueId) continue;
    geoIds.add(from.venueId);
    geoIds.add(to.venueId);
    candidates.push({ team, from: `${team}:${prev}`, to: `${team}:${today}` });
  }
  const geos = await getVenueGeo([...geoIds]);
  for (const c of candidates) {
    const from = venueByTeamDate.get(c.from)!;
    const to = venueByTeamDate.get(c.to)!;
    const g1 = geos.get(from.venueId);
    const g2 = geos.get(to.venueId);
    if (!g1 || !g2 || g1.lat == null || g1.lon == null || g2.lat == null || g2.lon == null) {
      skippedNoCoords++;
      continue;
    }
    const miles = haversineMiles(g1.lat, g1.lon, g2.lat, g2.lon);
    if (miles < TRAVEL_MIN_MILES) continue;
    travel.push({
      team: c.team,
      fromVenue: `${g1.name}${g1.city ? ` (${g1.city})` : ""}`,
      toVenue: `${g2.name}${g2.city ? ` (${g2.city})` : ""}`,
      direction: directionLabel(g2.lat - g1.lat, g2.lon - g1.lon),
      miles: Math.round(miles),
    });
  }
  travel.sort((a, b) => b.miles - a.miles);

  // 3) Weather HR verdict — Ballpark Pal game-level HR factor. Unavailable
  // (no key, provider error, or factors not yet published) is reported as
  // such, never substituted with the runs factor.
  let weatherHr: WeatherHrAlert[] = [];
  let weatherHrNote: string | null = null;
  try {
    const { games: factorGames } = await getParkFactors(today);
    weatherHr = factorGames
      .filter((g) => g.homeRunsPercent >= HR_GOOD_PCT || g.homeRunsPercent <= HR_POOR_PCT)
      .map((g) => ({
        gamePk: g.gamePk,
        matchup: `${g.away} @ ${g.home}`,
        homeRunsPercent: g.homeRunsPercent,
        verdict: g.homeRunsPercent >= HR_GOOD_PCT ? ("good" as const) : ("poor" as const),
      }))
      .sort((a, b) => b.homeRunsPercent - a.homeRunsPercent);
    if (weatherHr.length === 0 && factorGames.length === 0) {
      weatherHrNote = "No park factors published for today yet — check back closer to first pitch.";
    }
  } catch (e) {
    weatherHrNote = `Weather HR verdict unavailable — ${e instanceof Error ? e.message : "provider error"}.`;
  }

  return {
    date: today,
    range: {
      start,
      end,
      dateEntries: dates.length,
      gamesReturned,
      totalItems,
      complete: gamesReturned === totalItems,
    },
    noOffDay,
    travel,
    travelSkippedNoCoords: skippedNoCoords,
    weatherHr,
    weatherHrNote,
  };
}

// ── hot / cold batters ──────────────────────────────────────────────────────

export interface HotColdCard {
  rank: number;
  batterMlbam: number;
  batter: string;
  team: string; // Prizm abbr
  matchup: string; // "AWAY @ HOME"
  splitLabel: string; // "vs LHP" | "vs RHP"
  pa: number;
  avg: number | null;
  xwoba: number | null;
  kPct: number | null; // 0-100 sv scale
  oppSp: string;
  oppSpHand: "L" | "R";
  /** Reciprocal split line, e.g. ".340 xwOBA vs LHB · 210 TBF" — null when the
   * starter has no split row for that side (the card says so). */
  oppSpSplit: string | null;
}

const HOTCOLD_MIN_PA = 10;
const HOTCOLD_MAX_CARDS = 10;

async function hotCold(): Promise<{ date: string; hot: HotColdCard[]; cold: HotColdCard[]; considered: number }> {
  const [{ date, games }, idx] = await Promise.all([getSavantSlate(), getStatIndex()]);

  const abbrToTeamId = new Map<string, number>(
    Object.entries(TEAM_ID_TO_ABBR).map(([id, abbr]) => [abbr, Number(id)]),
  );

  interface Candidate extends Omit<HotColdCard, "rank"> {}
  const candidates: Candidate[] = [];

  for (const g of games) {
    const sides = [
      { spId: g.away_sp_id, spName: g.away_sp_name, spHand: g.away_sp_hand, battingTeam: g.home_abbr },
      { spId: g.home_sp_id, spName: g.home_sp_name, spHand: g.home_sp_hand, battingTeam: g.away_abbr },
    ];
    for (const s of sides) {
      if (s.spId == null || !s.spName || (s.spHand !== "L" && s.spHand !== "R")) continue;
      const teamId = abbrToTeamId.get(s.battingTeam);
      if (teamId == null) continue;
      // The split the opposing lineup faces: LHP → batters' vsL rows.
      const splitKey = s.spHand === "L" ? "vsL" : "vsR";
      const splitLabel = s.spHand === "L" ? "vs LHP" : "vs RHP";
      const matchup = `${g.away_abbr} @ ${g.home_abbr}`;

      for (const [key, row] of idx) {
        if (!key.endsWith(`:${splitKey}`)) continue;
        if (row.side !== "batter" || row.team_id !== teamId) continue;
        const pa = row.pa ?? 0;
        if (pa < HOTCOLD_MIN_PA || row.xwoba == null) continue;

        // Reciprocal: the starter's split against this batter's side.
        // Switch hitters take the platoon side (vs RHP they bat left).
        const batsHand = row.hand;
        const pitcherSplit =
          batsHand === "R" ? "vsR" : batsHand === "L" ? "vsL" : splitKey; // 'S'/null → platoon side
        const spRow = statFor(idx, s.spId, pitcherSplit);
        const oppSpSplit =
          spRow && spRow.xwoba != null
            ? `${spRow.xwoba.toFixed(3).replace(/^0/, "")} xwOBA vs ${
                pitcherSplit === "vsL" ? "LHB" : "RHB"
              } · ${spRow.tbf ?? "?"} TBF`
            : null;

        candidates.push({
          batterMlbam: row.mlbam_id,
          batter: row.full_name,
          team: s.battingTeam,
          matchup,
          splitLabel,
          pa,
          avg: row.avg,
          xwoba: row.xwoba,
          kPct: row.k_pct,
          oppSp: s.spName,
          oppSpHand: s.spHand,
          oppSpSplit,
        });
      }
    }
  }

  const considered = candidates.length;
  const hot = [...candidates]
    .sort((a, b) => (b.xwoba ?? 0) - (a.xwoba ?? 0))
    .slice(0, HOTCOLD_MAX_CARDS)
    .map((c, i) => ({ ...c, rank: i + 1 }));
  const cold = [...candidates]
    .sort((a, b) => (a.xwoba ?? 1) - (b.xwoba ?? 1))
    .slice(0, HOTCOLD_MAX_CARDS)
    .map((c, i) => ({ ...c, rank: i + 1 }));
  return { date, hot, cold, considered };
}

export const briefRouter = createRouter({
  quickAlerts: publicQuery.query(quickAlerts),
  hotCold: publicQuery.query(hotCold),
});
