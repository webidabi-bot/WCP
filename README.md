# AI-Stack / AIOS

**A self-hosted modular AI operating system** — practical internal AI operations platform that is stable, observable, maintainable, and extensible.

```
                 ┌─────────────────────────────────────────────┐
                 │           AIOS Operator Portal               │
                 │     React SPA served via nginx / Vite        │
                 └───────────────────┬─────────────────────────┘
                                     │ HTTP (port 5173)
                 ┌───────────────────▼─────────────────────────┐
                 │          Phoenix Control Plane               │
                 │   Node.js HTTP API · REST · MCP server       │
                 │     Agents · Tools · Records · Voice         │
                 │       port 3000 (API) · 3001 (MCP)           │
                 └────┬──────────┬──────────┬───────────────────┘
                      │          │          │
          ┌───────────▼──┐  ┌────▼────┐  ┌─▼──────────────┐
          │    Atlas      │  │ Prome-  │  │  Governance    │
          │  Inference    │  │  theus  │  │  PostgreSQL     │
          │  (Ollama /    │  │ Metrics │  │  Agent DB       │
          │   OpenAI)     │  │ Backup  │  │  Policies       │
          └───────────────┘  └─────────┘  └────────────────┘
```

## Architecture

| Component | Package | Role |
|-----------|---------|------|
| **Phoenix** | `packages/phoenix` | Control-plane API server. Exposes REST endpoints for agents, tools, records, inference, and voice. Serves as the integration hub. |
| **Atlas** | `packages/atlas` | Inference engine. OpenAI-compatible HTTP proxy and router. Supports Ollama (local), OpenAI, and any compatible endpoint. |
| **Prometheus** | `packages/prometheus` | Persistence & observability. Prometheus text-format metrics exposition, scheduled pg_dump backups, retention policy. |
| **MCP** | `packages/mcp` | Model Context Protocol tool execution. JSON-RPC 2.0 server. Tool registry, input validation (AJV), timeout handling. |
| **Voice** | `packages/voice` | Voice orchestration pipeline. Pluggable STT/TTS providers, session lifecycle, OpenAI Whisper integration. |
| **Governance** | `packages/governance` | PostgreSQL-backed agent governance. Schema migrations, agent CRUD, policy engine (ABAC), audit log. |
| **Portal** | `portal/` | React operator surface. Vite-based SPA with pages for Dashboard, Agents, Tools, Records, Inference, Voice. |

## Database Schema

12 migrations in `packages/governance/src/migrations.ts`:

```
agents              Registry of AI agents (id, name, role, status, config)
tools               MCP tool definitions (name, input_schema, handler_url)
agent_tools         M2M: which tools each agent can invoke
sessions            Agent interaction sessions
messages            Chat messages within sessions
tool_executions     Audit log of every tool invocation
records             Structured records (forms, reports, incidents, tickets)
voice_sessions      Voice STT/TTS session state
policies            ABAC governance rules
audit_log           Immutable system-wide audit trail
inference_requests  Atlas inference telemetry (tokens, latency)
```

## Quick Start

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 14+
- (Optional) Ollama for local LLM inference

### Install dependencies
```bash
npm install
```

### Set up the database
```bash
# Set connection string
export DATABASE_URL=postgresql://aios:aios@localhost:5432/aios

# Run migrations
npm run migrate
```

### Start the control plane
```bash
npm run dev
# API: http://localhost:3000
# MCP: http://localhost:3001
```

### Start the portal (separate terminal)
```bash
npm run dev --workspace=portal
# Portal: http://localhost:5173
```

## Docker Compose (Full Stack)

```bash
docker compose up -d

# Pull a model for Ollama (first-time setup)
docker compose exec ollama ollama pull llama3.2
```

Services:
- Portal:   http://localhost:5173
- Phoenix:  http://localhost:3000
- MCP:      http://localhost:3001
- Prometheus: http://localhost:9090

## API Reference

### Health
```
GET  /health          — Service health check
GET  /ready           — Readiness probe
GET  /metrics         — Prometheus metrics endpoint
```

### Agents
```
GET    /api/agents                  — List agents (filter by role, status)
POST   /api/agents                  — Create agent
GET    /api/agents/:id              — Get agent
PATCH  /api/agents/:id              — Update agent
DELETE /api/agents/:id              — Delete agent
GET    /api/agents/:id/tools        — List tools granted to agent
POST   /api/agents/:id/tools        — Grant tool to agent
DELETE /api/agents/:id/tools/:toolId — Revoke tool from agent
```

### MCP Tools
```
GET  /api/tools           — List registered tools
POST /api/tools/invoke    — Invoke a tool by name
```

### Records (Forms / Workflows)
```
GET    /api/records           — List records (filter by type, status)
POST   /api/records           — Create record
GET    /api/records/:id       — Get record
PATCH  /api/records/:id       — Update record
DELETE /api/records/:id       — Delete record
```

### Inference (Atlas)
```
POST /api/inference/chat    — Chat completion (OpenAI-compatible)
GET  /api/inference/models  — List available models
```

### Voice
```
POST   /api/voice/sessions                  — Create voice session
GET    /api/voice/sessions/:id              — Get session
DELETE /api/voice/sessions/:id              — Close session
POST   /api/voice/sessions/:id/transcribe   — Transcribe audio (base64)
POST   /api/voice/sessions/:id/synthesize   — Synthesize speech
```

### MCP JSON-RPC (port 3001)
```
POST /   — JSON-RPC 2.0 endpoint
  initialize   — Handshake
  tools/list   — List available tools
  tools/call   — Execute a tool
  ping         — Heartbeat
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Phoenix API port |
| `MCP_PORT` | `3001` | MCP server port |
| `DATABASE_URL` | `postgresql://aios:aios@localhost:5432/aios` | PostgreSQL connection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_DEFAULT_MODEL` | `llama3.2` | Default Ollama model |
| `OPENAI_API_KEY` | — | OpenAI API key (enables OpenAI routing) |
| `OPENAI_BASE_URL` | `https://api.openai.com` | OpenAI-compatible endpoint |
| `SKIP_MIGRATIONS` | — | Set to `true` to skip auto-migration on start |
| `HOST` | `0.0.0.0` | Bind address |

## Testing

```bash
# Run all tests
npm run test --workspaces --if-present

# Individual packages
npm run test --workspace=packages/mcp
npm run test --workspace=packages/prometheus
npm run test --workspace=packages/atlas
npm run test --workspace=packages/voice
```

Total: **29 tests** across 4 packages (MCP, Prometheus, Atlas, Voice).

## Build

```bash
npm run build
```

Builds all packages in dependency order, then the portal.

## Design Principles

- **Clean architecture** — Each package has a single responsibility and clean public API.
- **Portal-safe surfaces** — API routes are CORS-enabled, validated, and return structured JSON.
- **Deterministic workflows** — MCP tools validate inputs with JSON Schema (AJV). Records have explicit status fields.
- **Reusable templates** — Providers are pluggable (inference backends, STT/TTS). Registry pattern for tools.
- **Operational clarity** — Every service emits structured logs. `/metrics` exposes Prometheus-format data. `/health` and `/ready` for orchestration.
- **Boring reliable infrastructure** — Pure Node.js HTTP server (no external framework). PostgreSQL. pg_dump backups. No magic.
- **Observable** — Prometheus metrics for HTTP requests, inference latency, backup success/failure.
- **Immutable audit trail** — Every tool invocation and governance decision is recorded.

## License

MIT — see [LICENSE](LICENSE).
