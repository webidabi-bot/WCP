# AIOS Database Migrations

Migrations are managed programmatically by `@aios/governance` using the
`migrate()` function. The TypeScript source-of-truth lives in:

```
packages/governance/src/migrations.ts
```

## Running migrations

```bash
# Apply all pending migrations
npm run migrate

# Roll back the last migration
npm run migrate -- rollback
```

## Migration versions

| Version | Name |
|---------|------|
| 1 | create_schema_migrations |
| 2 | create_agents |
| 3 | create_tools |
| 4 | create_agent_tools |
| 5 | create_sessions |
| 6 | create_messages |
| 7 | create_tool_executions |
| 8 | create_records |
| 9 | create_voice_sessions |
| 10 | create_policies |
| 11 | create_audit_log |
| 12 | create_inference_requests |

## Schema overview

```
agents            — Agent registry (id, name, role, status, config)
tools             — MCP tool definitions (name, input_schema, handler_url)
agent_tools       — M2M: agent ↔ tool grants
sessions          — Interaction sessions
messages          — Messages within sessions
tool_executions   — Audit log of every tool invocation
records           — Structured records (forms, reports, incidents)
voice_sessions    — Voice STT/TTS sessions
policies          — ABAC governance policies
audit_log         — Immutable system-wide audit trail
inference_requests — Atlas inference telemetry
```
