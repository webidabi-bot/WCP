/**
 * Agent management API routes.
 *
 * GET    /api/agents            — list agents
 * POST   /api/agents            — create agent
 * GET    /api/agents/:id        — get agent
 * PATCH  /api/agents/:id        — update agent
 * DELETE /api/agents/:id        — delete agent
 * GET    /api/agents/:id/tools  — list tools granted to agent
 * POST   /api/agents/:id/tools  — grant tool to agent
 * DELETE /api/agents/:id/tools/:toolId — revoke tool from agent
 */

import { Router, json, notFound } from "../router.js";
import { createAgentRepository } from "@aios/governance";
import { getPool } from "@aios/governance";

function repo() {
  return createAgentRepository(() => getPool().connect());
}

export function registerAgentRoutes(router: Router): void {
  // List agents
  router.get("/api/agents", async (ctx) => {
    const agents = await repo().findAll({
      role: ctx.query["role"],
      status: ctx.query["status"],
    });
    json(ctx.res, { agents, total: agents.length });
  });

  // Create agent
  router.post("/api/agents", async (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.name) {
      json(ctx.res, { error: "'name' is required" }, 400);
      return;
    }
    const agent = await repo().create({
      name: String(body.name),
      description: body.description != null ? String(body.description) : undefined,
      role: (body.role as "worker" | "supervisor" | "orchestrator" | "tool") ?? "worker",
      config: (body.config as Record<string, unknown>) ?? {},
      metadata: (body.metadata as Record<string, unknown>) ?? {},
    });
    json(ctx.res, { agent }, 201);
  });

  // Get agent
  router.get("/api/agents/:id", async (ctx) => {
    const agent = await repo().findById(ctx.params["id"]!);
    if (!agent) return notFound(ctx.res);
    json(ctx.res, { agent });
  });

  // Update agent
  router.patch("/api/agents/:id", async (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;
    const agent = await repo().update(ctx.params["id"]!, {
      name: body?.name != null ? String(body.name) : undefined,
      description: body?.description != null ? String(body.description) : undefined,
      role: body?.role as "worker" | "supervisor" | "orchestrator" | "tool" | undefined,
      status: body?.status as "idle" | "running" | "paused" | "error" | "retired" | undefined,
      config: body?.config as Record<string, unknown> | undefined,
      metadata: body?.metadata as Record<string, unknown> | undefined,
    });
    if (!agent) return notFound(ctx.res);
    json(ctx.res, { agent });
  });

  // Delete agent
  router.delete("/api/agents/:id", async (ctx) => {
    const deleted = await repo().delete(ctx.params["id"]!);
    if (!deleted) return notFound(ctx.res);
    json(ctx.res, { deleted: true });
  });

  // List tools granted to agent
  router.get("/api/agents/:id/tools", async (ctx) => {
    const agent = await repo().findById(ctx.params["id"]!);
    if (!agent) return notFound(ctx.res);
    const tools = await repo().listTools(ctx.params["id"]!);
    json(ctx.res, { tools });
  });

  // Grant tool to agent
  router.post("/api/agents/:id/tools", async (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.toolId) {
      json(ctx.res, { error: "'toolId' is required" }, 400);
      return;
    }
    await repo().grantTool(ctx.params["id"]!, String(body.toolId));
    json(ctx.res, { granted: true });
  });

  // Revoke tool from agent
  router.delete("/api/agents/:id/tools/:toolId", async (ctx) => {
    await repo().revokeTool(ctx.params["id"]!, ctx.params["toolId"]!);
    json(ctx.res, { revoked: true });
  });
}
