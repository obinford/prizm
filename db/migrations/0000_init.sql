CREATE TABLE `angles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`sport` enum('mlb','nhl') NOT NULL DEFAULT 'mlb',
	`type` varchar(8) NOT NULL DEFAULT 'note',
	`title` varchar(200) NOT NULL,
	`note` text NOT NULL,
	`tagsJson` text NOT NULL,
	`snapshotJson` text NOT NULL,
	`shared` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `angles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`playerId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `follows_user_player_uq` UNIQUE(`userId`,`playerId`)
);
--> statement-breakpoint
CREATE TABLE `game_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`playerId` bigint unsigned NOT NULL,
	`gameDate` varchar(10) NOT NULL,
	`extGameId` varchar(32) NOT NULL DEFAULT '',
	`statsJson` text NOT NULL,
	CONSTRAINT `game_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_logs_player_game_uq` UNIQUE(`playerId`,`gameDate`,`extGameId`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source` varchar(16) NOT NULL,
	`status` varchar(16) NOT NULL,
	`rows` int NOT NULL DEFAULT 0,
	`message` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `ingestion_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sport` enum('mlb','nhl') NOT NULL,
	`extId` int NOT NULL,
	`slug` varchar(140) NOT NULL,
	`name` varchar(120) NOT NULL,
	`team` varchar(8) NOT NULL,
	`pos` varchar(16) NOT NULL DEFAULT '',
	`hand` varchar(4) NOT NULL DEFAULT '',
	`role` varchar(16) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `players_id` PRIMARY KEY(`id`),
	CONSTRAINT `players_sport_extId_uq` UNIQUE(`sport`,`extId`),
	CONSTRAINT `players_sport_slug_uq` UNIQUE(`sport`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `props` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sport` enum('mlb','nhl') NOT NULL,
	`playerId` bigint unsigned NOT NULL,
	`market` varchar(24) NOT NULL,
	`line` decimal(4,1) NOT NULL,
	`priceOver` int NOT NULL DEFAULT -115,
	`priceUnder` int NOT NULL DEFAULT -115,
	`l5` decimal(4,3) NOT NULL DEFAULT '0',
	`l10` decimal(4,3) NOT NULL DEFAULT '0',
	`l20` decimal(4,3) NOT NULL DEFAULT '0',
	`opponent` varchar(16) NOT NULL DEFAULT '',
	`gameId` varchar(48) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `props_id` PRIMARY KEY(`id`),
	CONSTRAINT `props_player_market_uq` UNIQUE(`playerId`,`market`)
);
--> statement-breakpoint
CREATE TABLE `season_stats` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`playerId` bigint unsigned NOT NULL,
	`statsJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `season_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `season_stats_player_uq` UNIQUE(`playerId`)
);
--> statement-breakpoint
CREATE TABLE `slate_games` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sport` enum('mlb','nhl') NOT NULL,
	`extGameId` varchar(32) NOT NULL,
	`gameDate` varchar(10) NOT NULL,
	`startTime` varchar(16) NOT NULL DEFAULT '',
	`away` varchar(8) NOT NULL,
	`home` varchar(8) NOT NULL,
	`venue` varchar(120) NOT NULL DEFAULT '',
	`probablesJson` text,
	`weatherJson` text,
	CONSTRAINT `slate_games_id` PRIMARY KEY(`id`),
	CONSTRAINT `slate_games_ext_uq` UNIQUE(`extGameId`)
);
--> statement-breakpoint
CREATE TABLE `team_stats` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sport` enum('mlb','nhl') NOT NULL,
	`team` varchar(8) NOT NULL,
	`statsJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_stats_sport_team_uq` UNIQUE(`sport`,`team`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
CREATE TABLE `window_stats` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`playerId` bigint unsigned NOT NULL,
	`window` varchar(8) NOT NULL,
	`statsJson` text NOT NULL,
	`sample` int NOT NULL DEFAULT 0,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `window_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `window_stats_player_window_uq` UNIQUE(`playerId`,`window`)
);
--> statement-breakpoint
ALTER TABLE `angles` ADD CONSTRAINT `angles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_logs` ADD CONSTRAINT `game_logs_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `props` ADD CONSTRAINT `props_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `season_stats` ADD CONSTRAINT `season_stats_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `window_stats` ADD CONSTRAINT `window_stats_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `angles_user_idx` ON `angles` (`userId`);--> statement-breakpoint
CREATE INDEX `players_role_idx` ON `players` (`sport`,`role`);--> statement-breakpoint
CREATE INDEX `slate_games_date_idx` ON `slate_games` (`gameDate`);