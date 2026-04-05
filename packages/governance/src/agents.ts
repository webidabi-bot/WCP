import { PoolClient } from "pg";
import { withClient, withTransaction } from "./db.js";

// ---------------------------------------------------------------------------
// Agent Repository
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  role: "worker" | "supervisor" | "orchestrator" | "tool";
  status: "idle" | "running" | "paused" | "error" | "retired";
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type AgentCreate = Pick<Agent, "name"> &
  Partial<
    Pick<Agent, "description" | "role" | "status" | "config" | "metadata">
  >;

export type AgentUpdate = Partial<
  Pick<Agent, "name" | "description" | "role" | "status" | "config" | "metadata">
>;

export interface AgentRepository {
  findById(id: string): Promise<Agent | null>;
  findAll(filters?: { role?: string; status?: string }): Promise<Agent[]>;
  create(data: AgentCreate): Promise<Agent>;
  update(id: string, data: AgentUpdate): Promise<Agent | null>;
  delete(id: string): Promise<boolean>;
  grantTool(agentId: string, toolId: string): Promise<void>;
  revokeTool(agentId: string, toolId: string): Promise<void>;
  listTools(agentId: string): Promise<string[]>;
}

function rowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string | null) ?? null,
    role: row["role"] as Agent["role"],
    status: row["status"] as Agent["status"],
    config: (row["config"] as Record<string, unknown>) ?? {},
    metadata: (row["metadata"] as Record<string, unknown>) ?? {},
    created_at: new Date(row["created_at"] as string),
    updated_at: new Date(row["updated_at"] as string),
  };
}

export function createAgentRepository(clientGetter: () => Promise<PoolClient>): AgentRepository {
  async function query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const client = await clientGetter();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  return {
    async findById(id) {
      const rows = await query(
        `SELECT * FROM agents WHERE id = $1`,
        [id]
      );
      return rows[0] ? rowToAgent(rows[0]) : null;
    },

    async findAll(filters) {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filters?.role) {
        conditions.push(`role = $${params.length + 1}`);
        params.push(filters.role);
      }
      if (filters?.status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(filters.status);
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = await query(
        `SELECT * FROM agents ${where} ORDER BY created_at DESC`,
        params
      );
      return rows.map(rowToAgent);
    },

    async create(data) {
      const rows = await query(
        `INSERT INTO agents (name, description, role, status, config, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.name,
          data.description ?? null,
          data.role ?? "worker",
          data.status ?? "idle",
          JSON.stringify(data.config ?? {}),
          JSON.stringify(data.metadata ?? {}),
        ]
      );
      if (!rows[0]) throw new Error("Failed to create agent");
      return rowToAgent(rows[0]);
    },

    async update(id, data) {
      const fields: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        fields.push(`name = $${params.length + 1}`);
        params.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${params.length + 1}`);
        params.push(data.description);
      }
      if (data.role !== undefined) {
        fields.push(`role = $${params.length + 1}`);
        params.push(data.role);
      }
      if (data.status !== undefined) {
        fields.push(`status = $${params.length + 1}`);
        params.push(data.status);
      }
      if (data.config !== undefined) {
        fields.push(`config = $${params.length + 1}`);
        params.push(JSON.stringify(data.config));
      }
      if (data.metadata !== undefined) {
        fields.push(`metadata = $${params.length + 1}`);
        params.push(JSON.stringify(data.metadata));
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      fields.push(`updated_at = NOW()`);
      params.push(id);

      const rows = await query(
        `UPDATE agents SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      return rows[0] ? rowToAgent(rows[0]) : null;
    },

    async delete(id) {
      const rows = await query(
        `DELETE FROM agents WHERE id = $1 RETURNING id`,
        [id]
      );
      return rows.length > 0;
    },

    async grantTool(agentId, toolId) {
      await query(
        `INSERT INTO agent_tools (agent_id, tool_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [agentId, toolId]
      );
    },

    async revokeTool(agentId, toolId) {
      await query(
        `DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2`,
        [agentId, toolId]
      );
    },

    async listTools(agentId) {
      const rows = await query<{ tool_id: string }>(
        `SELECT tool_id FROM agent_tools WHERE agent_id = $1`,
        [agentId]
      );
      return rows.map((r) => r["tool_id"]);
    },
  };
}

// ---------------------------------------------------------------------------
// Policy Engine
// ---------------------------------------------------------------------------

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  effect: "allow" | "deny";
  subject: string;
  action: string;
  resource: string;
  conditions: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  policy: Policy | null;
  reason: string;
}

export async function evaluatePolicy(
  subject: string,
  action: string,
  resource: string,
  context?: Record<string, unknown>
): Promise<PolicyDecision> {
  const rows = await withClient(async (client) => {
    const result = await client.query<Policy>(
      `SELECT * FROM policies
       WHERE enabled = true
         AND (subject = $1 OR subject = '*')
         AND (action = $2 OR action = '*')
         AND (resource = $3 OR resource = '*')
       ORDER BY priority DESC, effect DESC`,
      [subject, action, resource]
    );
    return result.rows;
  });

  if (rows.length === 0) {
    // Default deny — no matching policy
    return {
      allowed: false,
      policy: null,
      reason: "No matching policy — default deny",
    };
  }

  // The highest-priority matching policy wins.
  const policy = rows[0]!;
  return {
    allowed: policy.effect === "allow",
    policy,
    reason:
      policy.effect === "allow"
        ? `Allowed by policy '${policy.name}'`
        : `Denied by policy '${policy.name}'`,
  };
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditEntry {
  actor: string;
  action: string;
  resource: string;
  resource_id?: string;
  outcome?: "success" | "denied" | "error";
  detail?: Record<string, unknown>;
  ip_address?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO audit_log (actor, action, resource, resource_id, outcome, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet)`,
      [
        entry.actor,
        entry.action,
        entry.resource,
        entry.resource_id ?? null,
        entry.outcome ?? "success",
        JSON.stringify(entry.detail ?? {}),
        entry.ip_address ?? null,
      ]
    );
  });
}
