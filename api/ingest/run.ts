// Ingestion CLI:  npx tsx api/ingest/run.ts [mlb|nhl|slate|props|all]
// Order matters: props derive from players+gameLogs+slate, so run mlb/nhl/slate first.

import "dotenv/config";
import { ingestMlb } from "./mlb";
import { ingestNhl } from "./nhl";
import { ingestSlate } from "./slate";
import { ingestProps } from "./props";

export async function runIngestion(source: string, fromIdx = 0, toIdx = 99): Promise<void> {
  switch (source) {
    case "mlb":
      await ingestMlb(fromIdx, toIdx);
      break;
    case "nhl":
      await ingestNhl(fromIdx, toIdx);
      break;
    case "slate":
      await ingestSlate();
      break;
    case "props":
      await ingestProps();
      break;
    case "all":
      await ingestMlb();
      await ingestNhl();
      await ingestSlate();
      await ingestProps();
      break;
    default:
      throw new Error(`unknown source "${source}" — expected mlb|nhl|slate|props|all`);
  }
}

// Run directly from CLI
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!);
if (isMain) {
  const source = process.argv[2] ?? "all";
  const fromIdx = Number(process.argv[3] ?? 0);
  const toIdx = Number(process.argv[4] ?? 99);
  runIngestion(source, fromIdx, toIdx)
    .then(() => {
      console.log(`[ingest] ${source} complete`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[ingest] ${source} FAILED:`, err);
      process.exit(1);
    });
}
