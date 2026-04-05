/**
 * Structured records / forms workflow routes.
 *
 * GET    /api/records              — list records
 * POST   /api/records              — create record
 * GET    /api/records/:id          — get record
 * PATCH  /api/records/:id          — update record
 * DELETE /api/records/:id          — delete record
 */

import { Router, json, notFound } from "../router.js";
import { getPool } from "@aios/governance";

interface AIOSRecord {
  id: string;
  record_type: string;
  title: string;
  status: string;
  body: { [key: string]: unknown };
  agent_id: string | null;
  session_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

type JSONObject = { [key: string]: unknown };

async function dbQuery<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export function registerRecordRoutes(router: Router): void {
  // List records
  router.get("/api/records", async (ctx) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (ctx.query["type"]) {
      conditions.push(`record_type = $${params.length + 1}`);
      params.push(ctx.query["type"]);
    }
    if (ctx.query["status"]) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(ctx.query["status"]);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const records = await dbQuery<AIOSRecord>(
      `SELECT * FROM records ${where} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    json(ctx.res, { records, total: records.length });
  });

  // Create record
  router.post("/api/records", async (ctx) => {
    const body = ctx.body as JSONObject | null;
    if (!body?.["title"] || !body?.["record_type"]) {
      json(ctx.res, { error: "'title' and 'record_type' are required" }, 400);
      return;
    }

    const rows = await dbQuery<AIOSRecord>(
      `INSERT INTO records (record_type, title, status, body, agent_id, session_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        String(body["record_type"]),
        String(body["title"]),
        body["status"] ? String(body["status"]) : "draft",
        JSON.stringify(body["body"] ?? {}),
        body["agent_id"] ? String(body["agent_id"]) : null,
        body["session_id"] ? String(body["session_id"]) : null,
        body["created_by"] ? String(body["created_by"]) : null,
      ]
    );
    if (!rows[0]) {
      json(ctx.res, { error: "Failed to create record" }, 500);
      return;
    }
    json(ctx.res, { record: rows[0] }, 201);
  });

  // Get record
  router.get("/api/records/:id", async (ctx) => {
    const rows = await dbQuery<AIOSRecord>(
      `SELECT * FROM records WHERE id = $1`,
      [ctx.params["id"]]
    );
    if (!rows[0]) return notFound(ctx.res);
    json(ctx.res, { record: rows[0] });
  });

  // Update record
  router.patch("/api/records/:id", async (ctx) => {
    const body = ctx.body as JSONObject | null;
    const fields: string[] = [];
    const params: unknown[] = [];

    if (body?.["title"] !== undefined) {
      fields.push(`title = $${params.length + 1}`);
      params.push(String(body["title"]));
    }
    if (body?.["status"] !== undefined) {
      fields.push(`status = $${params.length + 1}`);
      params.push(String(body["status"]));
    }
    if (body?.["body"] !== undefined) {
      fields.push(`body = $${params.length + 1}`);
      params.push(JSON.stringify(body["body"]));
    }

    if (fields.length === 0) {
      json(ctx.res, { error: "No updatable fields provided" }, 400);
      return;
    }

    fields.push("updated_at = NOW()");
    params.push(ctx.params["id"]);

    const rows = await dbQuery<AIOSRecord>(
      `UPDATE records SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return notFound(ctx.res);
    json(ctx.res, { record: rows[0] });
  });

  // Delete record
  router.delete("/api/records/:id", async (ctx) => {
    const rows = await dbQuery<{ id: string }>(
      `DELETE FROM records WHERE id = $1 RETURNING id`,
      [ctx.params["id"]]
    );
    if (!rows[0]) return notFound(ctx.res);
    json(ctx.res, { deleted: true });
  });
}
