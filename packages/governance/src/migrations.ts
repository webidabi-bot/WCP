/**
 * Migration runner for the governance schema.
 *
 * Migrations are applied in ascending order by version number.
 * A `schema_migrations` table tracks applied migrations.
 */

import { PoolClient } from "pg";
import { withClient, withTransaction } from "./db.js";

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

// ---------------------------------------------------------------------------
// Core schema migrations
// ---------------------------------------------------------------------------

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "create_schema_migrations",
    up: `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     BIGINT PRIMARY KEY,
        name        TEXT    NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
    down: `DROP TABLE IF EXISTS schema_migrations;`,
  },
  {
    version: 2,
    name: "create_agents",
    up: `
      CREATE TABLE IF NOT EXISTS agents (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT        NOT NULL,
        description  TEXT,
        role         TEXT        NOT NULL DEFAULT 'worker',
        status       TEXT        NOT NULL DEFAULT 'idle',
        config       JSONB       NOT NULL DEFAULT '{}',
        metadata     JSONB       NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_role   ON agents(role);

      COMMENT ON TABLE  agents            IS 'Registry of all managed AI agents';
      COMMENT ON COLUMN agents.role       IS 'Agent role: worker | supervisor | orchestrator | tool';
      COMMENT ON COLUMN agents.status     IS 'Lifecycle status: idle | running | paused | error | retired';
      COMMENT ON COLUMN agents.config     IS 'Agent-specific configuration (model, temperature, tools, etc.)';
      COMMENT ON COLUMN agents.metadata   IS 'Arbitrary key/value metadata for extensions';
    `,
    down: `DROP TABLE IF EXISTS agents;`,
  },
  {
    version: 3,
    name: "create_tools",
    up: `
      CREATE TABLE IF NOT EXISTS tools (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT        NOT NULL UNIQUE,
        description  TEXT,
        input_schema JSONB       NOT NULL DEFAULT '{}',
        handler_url  TEXT,
        handler_type TEXT        NOT NULL DEFAULT 'mcp',
        enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
        metadata     JSONB       NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(enabled);

      COMMENT ON TABLE  tools               IS 'MCP tool registry';
      COMMENT ON COLUMN tools.input_schema  IS 'JSON Schema describing the tool input';
      COMMENT ON COLUMN tools.handler_type  IS 'Execution backend: mcp | http | builtin';
    `,
    down: `DROP TABLE IF EXISTS tools;`,
  },
  {
    version: 4,
    name: "create_agent_tools",
    up: `
      CREATE TABLE IF NOT EXISTS agent_tools (
        agent_id  UUID REFERENCES agents(id) ON DELETE CASCADE,
        tool_id   UUID REFERENCES tools(id)  ON DELETE CASCADE,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (agent_id, tool_id)
      );

      COMMENT ON TABLE agent_tools IS 'Many-to-many grant table: which tools each agent may invoke';
    `,
    down: `DROP TABLE IF EXISTS agent_tools;`,
  },
  {
    version: 5,
    name: "create_sessions",
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id     UUID        REFERENCES agents(id) ON DELETE SET NULL,
        user_ref     TEXT,
        status       TEXT        NOT NULL DEFAULT 'open',
        context      JSONB       NOT NULL DEFAULT '{}',
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at     TIMESTAMPTZ,
        metadata     JSONB       NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status   ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_started  ON sessions(started_at DESC);

      COMMENT ON TABLE sessions IS 'Agent interaction sessions (conversations, tasks, workflows)';
    `,
    down: `DROP TABLE IF EXISTS sessions;`,
  },
  {
    version: 6,
    name: "create_messages",
    up: `
      CREATE TABLE IF NOT EXISTS messages (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role        TEXT        NOT NULL,
        content     TEXT        NOT NULL,
        tool_calls  JSONB,
        metadata    JSONB       NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_role       ON messages(role);
      CREATE INDEX IF NOT EXISTS idx_messages_created    ON messages(created_at DESC);

      COMMENT ON TABLE  messages      IS 'Individual messages within a session';
      COMMENT ON COLUMN messages.role IS 'OpenAI-compatible roles: system | user | assistant | tool';
    `,
    down: `DROP TABLE IF EXISTS messages;`,
  },
  {
    version: 7,
    name: "create_tool_executions",
    up: `
      CREATE TABLE IF NOT EXISTS tool_executions (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id   UUID        REFERENCES messages(id) ON DELETE SET NULL,
        tool_id      UUID        REFERENCES tools(id) ON DELETE SET NULL,
        agent_id     UUID        REFERENCES agents(id) ON DELETE SET NULL,
        tool_name    TEXT        NOT NULL,
        input        JSONB       NOT NULL DEFAULT '{}',
        output       JSONB,
        error        TEXT,
        status       TEXT        NOT NULL DEFAULT 'pending',
        duration_ms  INTEGER,
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_tool_exec_tool_id  ON tool_executions(tool_id);
      CREATE INDEX IF NOT EXISTS idx_tool_exec_agent_id ON tool_executions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tool_exec_status   ON tool_executions(status);
      CREATE INDEX IF NOT EXISTS idx_tool_exec_started  ON tool_executions(started_at DESC);

      COMMENT ON TABLE  tool_executions        IS 'Audit log of every MCP tool invocation';
      COMMENT ON COLUMN tool_executions.status IS 'Execution status: pending | running | success | error | timeout';
    `,
    down: `DROP TABLE IF EXISTS tool_executions;`,
  },
  {
    version: 8,
    name: "create_records",
    up: `
      CREATE TABLE IF NOT EXISTS records (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        record_type  TEXT        NOT NULL,
        title        TEXT        NOT NULL,
        status       TEXT        NOT NULL DEFAULT 'draft',
        body         JSONB       NOT NULL DEFAULT '{}',
        agent_id     UUID        REFERENCES agents(id) ON DELETE SET NULL,
        session_id   UUID        REFERENCES sessions(id) ON DELETE SET NULL,
        created_by   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_records_type       ON records(record_type);
      CREATE INDEX IF NOT EXISTS idx_records_status     ON records(status);
      CREATE INDEX IF NOT EXISTS idx_records_agent_id   ON records(agent_id);
      CREATE INDEX IF NOT EXISTS idx_records_created    ON records(created_at DESC);

      COMMENT ON TABLE  records             IS 'Structured records produced by workflows (forms, reports, tickets, etc.)';
      COMMENT ON COLUMN records.record_type IS 'Application-defined type: incident | report | form | ticket | artifact';
      COMMENT ON COLUMN records.body        IS 'Schema-less JSON payload – content varies by record_type';
    `,
    down: `DROP TABLE IF EXISTS records;`,
  },
  {
    version: 9,
    name: "create_voice_sessions",
    up: `
      CREATE TABLE IF NOT EXISTS voice_sessions (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id   UUID        REFERENCES sessions(id) ON DELETE CASCADE,
        provider     TEXT        NOT NULL DEFAULT 'whisper',
        language     TEXT        NOT NULL DEFAULT 'en',
        status       TEXT        NOT NULL DEFAULT 'idle',
        transcript   TEXT,
        audio_url    TEXT,
        metadata     JSONB       NOT NULL DEFAULT '{}',
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at     TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id ON voice_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_voice_sessions_status     ON voice_sessions(status);

      COMMENT ON TABLE voice_sessions IS 'Voice-to-text sessions tied to agent interactions';
    `,
    down: `DROP TABLE IF EXISTS voice_sessions;`,
  },
  {
    version: 10,
    name: "create_policies",
    up: `
      CREATE TABLE IF NOT EXISTS policies (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT        NOT NULL UNIQUE,
        description  TEXT,
        effect       TEXT        NOT NULL DEFAULT 'allow',
        subject      TEXT        NOT NULL,
        action       TEXT        NOT NULL,
        resource     TEXT        NOT NULL DEFAULT '*',
        conditions   JSONB       NOT NULL DEFAULT '{}',
        priority     INTEGER     NOT NULL DEFAULT 0,
        enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_policies_subject  ON policies(subject);
      CREATE INDEX IF NOT EXISTS idx_policies_action   ON policies(action);
      CREATE INDEX IF NOT EXISTS idx_policies_enabled  ON policies(enabled);

      COMMENT ON TABLE  policies          IS 'Agent governance policies (ABAC-style rules)';
      COMMENT ON COLUMN policies.effect   IS 'Policy effect: allow | deny';
      COMMENT ON COLUMN policies.subject  IS 'Who the policy applies to: agent:<id> | role:<name> | *';
      COMMENT ON COLUMN policies.action   IS 'What action: tool:invoke | session:create | record:write | *';
    `,
    down: `DROP TABLE IF EXISTS policies;`,
  },
  {
    version: 11,
    name: "create_audit_log",
    up: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        actor       TEXT        NOT NULL,
        action      TEXT        NOT NULL,
        resource    TEXT        NOT NULL,
        resource_id TEXT,
        outcome     TEXT        NOT NULL DEFAULT 'success',
        detail      JSONB       NOT NULL DEFAULT '{}',
        ip_address  INET,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_actor      ON audit_log(actor);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created    ON audit_log(created_at DESC);

      COMMENT ON TABLE  audit_log         IS 'Immutable audit log for governance and compliance';
      COMMENT ON COLUMN audit_log.actor   IS 'Who performed the action: user:<id> | agent:<id> | system';
      COMMENT ON COLUMN audit_log.outcome IS 'Result: success | denied | error';
    `,
    down: `DROP TABLE IF EXISTS audit_log;`,
  },
  {
    version: 12,
    name: "create_inference_requests",
    up: `
      CREATE TABLE IF NOT EXISTS inference_requests (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id    UUID        REFERENCES sessions(id) ON DELETE SET NULL,
        agent_id      UUID        REFERENCES agents(id) ON DELETE SET NULL,
        provider      TEXT        NOT NULL DEFAULT 'ollama',
        model         TEXT        NOT NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens  INTEGER,
        latency_ms    INTEGER,
        status        TEXT        NOT NULL DEFAULT 'pending',
        error         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_infer_session_id ON inference_requests(session_id);
      CREATE INDEX IF NOT EXISTS idx_infer_agent_id   ON inference_requests(agent_id);
      CREATE INDEX IF NOT EXISTS idx_infer_model      ON inference_requests(model);
      CREATE INDEX IF NOT EXISTS idx_infer_created    ON inference_requests(created_at DESC);

      COMMENT ON TABLE inference_requests IS 'Atlas inference telemetry — token usage and latency per request';
    `,
    down: `DROP TABLE IF EXISTS inference_requests;`,
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function appliedVersions(client: PoolClient): Promise<Set<number>> {
  // The schema_migrations table itself is created in migration 1.
  // Check if it exists first to avoid an error on a clean database.
  const { rows } = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    ) AS exists
  `);
  if (!rows[0]?.exists) return new Set();

  const result = await client.query<{ version: string }>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  return new Set(result.rows.map((r) => Number(r.version)));
}

export async function migrate(direction: "up" | "down" = "up"): Promise<void> {
  await withClient(async (client) => {
    const applied = await appliedVersions(client);

    if (direction === "up") {
      for (const m of MIGRATIONS) {
        if (applied.has(m.version)) continue;
        console.log(`[migrate] Applying migration ${m.version}: ${m.name}`);
        await withTransaction(async (tx) => {
          await tx.query(m.up);
          await tx.query(
            `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
            [m.version, m.name]
          );
        });
        console.log(`[migrate] ✓ Migration ${m.version} applied`);
      }
    } else {
      // Roll back the latest applied migration
      const sorted = [...applied].sort((a, b) => b - a);
      const latest = sorted[0];
      if (latest === undefined) {
        console.log("[migrate] Nothing to roll back");
        return;
      }
      const migration = MIGRATIONS.find((m) => m.version === latest);
      if (!migration) {
        throw new Error(`No migration definition found for version ${latest}`);
      }
      console.log(
        `[migrate] Rolling back migration ${migration.version}: ${migration.name}`
      );
      await withTransaction(async (tx) => {
        await tx.query(migration.down);
        await tx.query(
          `DELETE FROM schema_migrations WHERE version = $1`,
          [migration.version]
        );
      });
      console.log(`[migrate] ✓ Migration ${migration.version} rolled back`);
    }
  });
}
