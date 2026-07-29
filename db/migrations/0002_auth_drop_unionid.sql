ALTER TABLE `users` DROP INDEX `users_unionId_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `unionId`;--> statement-breakpoint
-- FIX 12: seed the single owner account. NULL passwordHash + mustSetPassword
-- means the account exists but CANNOT log in until the owner sets his own
-- password through the one-time setup route (a single-use, 1-hour token
-- printed to the server console at boot — never stored in plaintext).
-- No second account is seeded. More users later = a real user-management
-- feature, not a shared login.
INSERT INTO `users` (`email`, `name`, `role`, `passwordHash`, `mustSetPassword`, `createdAt`, `updatedAt`, `lastSignInAt`)
VALUES ('obinford@gmail.com', 'Oakley Binford', 'admin', NULL, true, now(), now(), now());