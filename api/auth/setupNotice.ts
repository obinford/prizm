// First-boot setup notice (FIX 12).
//
// If an account is waiting on first-time password setup, print its one-time
// setup URL to the server console exactly ONCE per process. The plaintext
// token is never emailed, never written to a file, never committed — console
// only, single use, 60-minute expiry. A fresh URL requires a server restart
// or `npm run setup-url`.

import { createSetupToken, findUserAwaitingSetup } from "./tokens";

let printed = false;

export async function printSetupUrlOnce(): Promise<void> {
  if (printed) return;
  printed = true;
  try {
    const user = await findUserAwaitingSetup();
    if (!user) return;
    const token = await createSetupToken(user.id);
    const port = process.env.PORT || "3000";
    console.log("");
    console.log(`[setup] Account ${user.email} needs a password before anyone can log in.`);
    console.log("[setup] One-time setup link (single use, valid 60 minutes):");
    console.log(`[setup]   http://localhost:${port}/set-password?token=${token}`);
    console.log("[setup] Expired or lost? Restart the server, or run: npm run setup-url");
    console.log("");
  } catch (err) {
    console.error("[setup] Failed to prepare the first-time setup link:", (err as Error).message);
  }
}
