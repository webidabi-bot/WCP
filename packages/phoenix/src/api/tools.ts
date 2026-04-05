/**
 * MCP tool execution routes.
 *
 * GET  /api/tools          — list registered tools
 * POST /api/tools/invoke   — invoke a tool by name
 */

import { Router, json } from "../router.js";
import { createRegistry } from "@aios/mcp";

const registry = createRegistry();

export function registerToolRoutes(router: Router): void {
  // List tools
  router.get("/api/tools", (ctx) => {
    json(ctx.res, { tools: registry.listTools() });
  });

  // Invoke tool
  router.post("/api/tools/invoke", async (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;

    if (!body?.name) {
      json(ctx.res, { error: "'name' is required" }, 400);
      return;
    }

    const result = await registry.execute(
      {
        id: `call_${Date.now()}`,
        name: String(body.name),
        input: (body.input as Record<string, unknown>) ?? {},
      },
      {
        agentId: body.agentId != null ? String(body.agentId) : undefined,
        sessionId: body.sessionId != null ? String(body.sessionId) : undefined,
      }
    );

    const status = result.isError ? 422 : 200;
    json(ctx.res, result, status);
  });
}
