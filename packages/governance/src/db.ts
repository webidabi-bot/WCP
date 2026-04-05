import { Pool, PoolClient } from "pg";

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

let pool: Pool | null = null;

export function createPool(config?: DatabaseConfig): Pool {
  const cfg: DatabaseConfig = config ?? {
    connectionString:
      process.env["DATABASE_URL"] ??
      `postgresql://${process.env["PGUSER"] ?? "aios"}:${process.env["PGPASSWORD"] ?? "aios"}@${process.env["PGHOST"] ?? "localhost"}:${process.env["PGPORT"] ?? "5432"}/${process.env["PGDATABASE"] ?? "aios"}`,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };

  return new Pool(cfg);
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
