/**
 * @aios/prometheus
 *
 * Persistence, backup, and metrics for AI-Stack / AIOS.
 *
 * Exports:
 *  - Metrics types and registry (Counter, Gauge, Histogram)
 *  - BackupService — scheduled pg_dump-based database backups
 *  - pruneBackups — retention policy helper
 */

export {
  Counter,
  Gauge,
  Histogram,
  MetricsRegistry,
  registry,
} from "./metrics.js";
export type { Labels } from "./metrics.js";

export { BackupService, pruneBackups } from "./backup.js";
export type { BackupConfig } from "./backup.js";
