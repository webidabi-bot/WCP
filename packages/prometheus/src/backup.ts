/**
 * Persistence service for AIOS (Prometheus role).
 *
 * Manages periodic exports and backups of PostgreSQL data.
 * Uses pg_dump for full backups and custom JSON export for lightweight
 * point-in-time snapshots.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { Gauge, Counter, registry } from "./metrics.js";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const backupSuccessCounter: Counter = registry.counter(
  "aios_backup_success_total",
  "Total number of successful database backups"
);

const backupErrorCounter: Counter = registry.counter(
  "aios_backup_error_total",
  "Total number of failed database backups"
);

const backupDurationHistogram = registry.histogram(
  "aios_backup_duration_ms",
  "Duration of database backup operations in milliseconds",
  [100, 500, 1000, 5000, 30000, 60000]
);

const lastBackupTimestamp: Gauge = registry.gauge(
  "aios_backup_last_success_timestamp",
  "Unix timestamp of the last successful backup"
);

// ---------------------------------------------------------------------------
// Backup configuration
// ---------------------------------------------------------------------------

export interface BackupConfig {
  /** Directory to write backup files to */
  outputDir: string;
  /** PostgreSQL connection string */
  connectionString?: string;
  /** pg_dump binary path (default: pg_dump) */
  pgDumpBin?: string;
  /** Backup format: plain | custom | directory | tar (default: custom) */
  format?: "plain" | "custom" | "directory" | "tar";
  /** Maximum number of backup files to retain (default: 7) */
  retain?: number;
}

// ---------------------------------------------------------------------------
// Backup service
// ---------------------------------------------------------------------------

export class BackupService {
  private readonly config: Required<BackupConfig>;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: BackupConfig) {
    this.config = {
      outputDir: config.outputDir,
      connectionString:
        config.connectionString ??
        process.env["DATABASE_URL"] ??
        "postgresql://aios:aios@localhost:5432/aios",
      pgDumpBin: config.pgDumpBin ?? "pg_dump",
      format: config.format ?? "custom",
      retain: config.retain ?? 7,
    };

    mkdirSync(this.config.outputDir, { recursive: true });
  }

  /**
   * Perform a single backup.
   */
  async backup(): Promise<string> {
    const start = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext =
      this.config.format === "plain"
        ? "sql"
        : this.config.format === "tar"
        ? "tar"
        : "pgdump";
    const filename = `aios-backup-${timestamp}.${ext}`;
    const filepath = join(this.config.outputDir, filename);

    try {
      const args = [
        "--format",
        this.config.format,
        "--file",
        filepath,
        this.config.connectionString,
      ];

      await execFileAsync(this.config.pgDumpBin, args);

      const duration = Date.now() - start;
      backupSuccessCounter.inc();
      backupDurationHistogram.observe({}, duration);
      lastBackupTimestamp.set({}, Math.floor(Date.now() / 1000));

      console.log(
        `[prometheus/backup] Backup completed: ${filepath} (${duration}ms)`
      );
      return filepath;
    } catch (err) {
      backupErrorCounter.inc();
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[prometheus/backup] Backup failed: ${message}`);
      throw new Error(`Backup failed: ${message}`);
    }
  }

  /**
   * Start scheduled backups.
   * @param intervalMs  Interval between backups in milliseconds
   */
  start(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.backup().catch((err) => {
        console.error("[prometheus/backup] Scheduled backup failed:", err);
      });
    }, intervalMs);
    console.log(
      `[prometheus/backup] Scheduled backups every ${intervalMs / 1000}s`
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Retention policy
// ---------------------------------------------------------------------------

export async function pruneBackups(
  dir: string,
  retain: number
): Promise<number> {
  const { readdir, unlink, stat } = await import("fs/promises");
  const files = await readdir(dir);
  const backupFiles = files.filter((f) => f.startsWith("aios-backup-"));

  // Sort by modification time (newest first)
  const withStats = await Promise.all(
    backupFiles.map(async (f) => {
      const s = await stat(join(dir, f));
      return { name: f, mtimeMs: s.mtimeMs };
    })
  );
  withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const toDelete = withStats.slice(retain);
  await Promise.all(toDelete.map(({ name }) => unlink(join(dir, name))));

  if (toDelete.length > 0) {
    console.log(
      `[prometheus/backup] Pruned ${toDelete.length} old backup(s)`
    );
  }

  return toDelete.length;
}
