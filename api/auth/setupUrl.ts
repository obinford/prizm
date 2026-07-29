// CLI: npm run setup-url
// Prints a fresh one-time setup link for the account waiting on first-time
// password setup (FIX 12). Plaintext goes to the console only.

import "dotenv/config";
import { createSetupToken, findUserAwaitingSetup } from "./tokens";

const user = await findUserAwaitingSetup();
if (!user) {
  console.log("[setup-url] No account is waiting on first-time password setup.");
  process.exit(0);
}
const token = await createSetupToken(user.id);
const port = process.env.PORT || "3000";
console.log(`[setup-url] One-time setup link for ${user.email} (single use, valid 60 minutes):`);
console.log(`[setup-url]   http://localhost:${port}/set-password?token=${token}`);
process.exit(0);
