#!/usr/bin/env node
/**
 * AIOS Phoenix control-plane entry point.
 *
 * Starts the HTTP API server and MCP tool server.
 * Performs database schema migration on startup.
 */

import { createApp } from "./app.js";
import { MCPServer, createRegistry as createMCPRegistry } from "@aios/mcp";
import { migrate } from "@aios/governance";
import { closePool } from "@aios/governance";

async function main() {
  console.log("[aios] Starting AI-Stack / AIOS...");

  // Run database migrations
  if (process.env["SKIP_MIGRATIONS"] !== "true") {
    try {
      await migrate("up");
      console.log("[aios] Database migrations complete");
    } catch (err) {
      console.warn(
        "[aios] Could not run migrations (no database?):",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Start the Phoenix control-plane API
  const app = createApp();
  await app.start();

  // Start the MCP tool server on a separate port
  const mcpPort = Number(process.env["MCP_PORT"] ?? 3001);
  const mcpRegistry = createMCPRegistry();
  const mcpServer = new MCPServer({ port: mcpPort, registry: mcpRegistry });
  await mcpServer.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[aios] Received ${signal}, shutting down...`);
    await app.stop();
    await mcpServer.stop();
    await closePool();
    console.log("[aios] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log("[aios] Ready.");
}

main().catch((err) => {
  console.error("[aios] Fatal startup error:", err);
  process.exit(1);
});
