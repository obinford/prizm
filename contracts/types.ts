export type * from "../db/schema";
export * from "./errors";
export * from "./prizm";

/**
 * One row of the Team Stats tab: qualified batter lines aggregated to a team
 * by api/teamsRouter.ts. Every stat field is number | null — the weighted
 * mean returns null when no row carried both a value and a weight, and that
 * null must survive to the UI as an em-dash.
 */
export interface MlbTeamStats {
  abbr: string;
  /** Qualified batters behind this line — the sample-size affordance. */
  batters: number;
  teamPa: number;
  teamBbe: number;
  woba: number | null;
  xwoba: number | null;
  babip: number | null;
  iso: number | null;
  slg: number | null;
  avg: number | null;
  xba: number | null;
  xslg: number | null;
  kPct: number | null;
  bbPct: number | null;
  swStrPct: number | null;
  cswPct: number | null;
  whiffPct: number | null;
  zonePct: number | null;
  hrPct: number | null;
  hardHitPct: number | null;
  barrelPct: number | null;
  avgEv: number | null;
  gbPct: number | null;
  fbPct: number | null;
  ldPct: number | null;
  gbFb: number | null;
}
