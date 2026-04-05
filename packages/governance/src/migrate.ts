#!/usr/bin/env node
/**
 * Standalone migration CLI for @aios/governance.
 *
 * Usage:
 *   node dist/migrate.js          # apply all pending migrations
 *   node dist/migrate.js rollback # roll back the last migration
 */

import { migrate } from "./migrations.js";
import { closePool } from "./db.js";

const direction = process.argv[2] === "rollback" ? "down" : "up";

console.log(
  `[aios/governance] Running schema migrations (direction: ${direction})...`
);

migrate(direction)
  .then(() => {
    console.log("[aios/governance] Migration complete.");
  })
  .catch((err: unknown) => {
    console.error("[aios/governance] Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
