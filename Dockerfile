# AI-Stack / AIOS multi-stage Dockerfile

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
COPY packages/governance/package.json ./packages/governance/
COPY packages/atlas/package.json       ./packages/atlas/
COPY packages/mcp/package.json         ./packages/mcp/
COPY packages/prometheus/package.json  ./packages/prometheus/
COPY packages/voice/package.json       ./packages/voice/
COPY packages/phoenix/package.json     ./packages/phoenix/
RUN npm install --workspaces --include-workspace-root

# ---------------------------------------------------------------------------
# Build packages
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY packages/ ./packages/
RUN npm run build --workspaces --if-present

# ---------------------------------------------------------------------------
# Phoenix runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS phoenix
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/governance/dist ./packages/governance/dist
COPY --from=builder /app/packages/governance/package.json ./packages/governance/
COPY --from=builder /app/packages/atlas/dist ./packages/atlas/dist
COPY --from=builder /app/packages/atlas/package.json ./packages/atlas/
COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/
COPY --from=builder /app/packages/prometheus/dist ./packages/prometheus/dist
COPY --from=builder /app/packages/prometheus/package.json ./packages/prometheus/
COPY --from=builder /app/packages/voice/dist ./packages/voice/dist
COPY --from=builder /app/packages/voice/package.json ./packages/voice/
COPY --from=builder /app/packages/phoenix/dist ./packages/phoenix/dist
COPY --from=builder /app/packages/phoenix/package.json ./packages/phoenix/
COPY package.json ./
EXPOSE 3000 3001
CMD ["node", "packages/phoenix/dist/main.js"]

# ---------------------------------------------------------------------------
# Portal build
# ---------------------------------------------------------------------------
FROM deps AS portal-builder
COPY portal/ ./portal/
RUN npm run build --workspace=portal

# ---------------------------------------------------------------------------
# Portal runtime (nginx)
# ---------------------------------------------------------------------------
FROM nginx:alpine AS portal
COPY --from=portal-builder /app/portal/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
