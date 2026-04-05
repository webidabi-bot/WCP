/**
 * @aios/governance
 *
 * PostgreSQL-backed agent governance layer for AI-Stack / AIOS.
 *
 * Exports:
 *  - Database client utilities
 *  - Schema migration runner
 *  - Agent repository (CRUD + tool grants)
 *  - Policy engine (ABAC-style evaluation)
 *  - Audit log writer
 */

export {
  createPool,
  getPool,
  withClient,
  withTransaction,
  closePool,
} from "./db.js";

export type { DatabaseConfig } from "./db.js";

export { migrate } from "./migrations.js";
export type { Migration } from "./migrations.js";

export {
  createAgentRepository,
  evaluatePolicy,
  writeAuditLog,
} from "./agents.js";

export type {
  Agent,
  AgentCreate,
  AgentUpdate,
  AgentRepository,
  Policy,
  PolicyDecision,
  AuditEntry,
} from "./agents.js";
