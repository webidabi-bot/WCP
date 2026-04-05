/**
 * Inference proxy routes (Atlas).
 *
 * POST /api/inference/chat    — chat completion
 * GET  /api/inference/models  — list available models
 */

import { Router, json } from "../router.js";
import { createDefaultRouter } from "@aios/atlas";

const inferenceRouter = createDefaultRouter();

export function registerInferenceRoutes(router: Router): void {
  // Chat completion
  router.post("/api/inference/chat", async (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;

    if (!body || !body["messages"] || !body["model"]) {
      json(ctx.res, { error: "'model' and 'messages' are required" }, 400);
      return;
    }

    try {
      const result = await inferenceRouter.complete({
        model: String(body["model"]),
        messages: body["messages"] as Parameters<typeof inferenceRouter.complete>[0]["messages"],
        temperature: typeof body["temperature"] === "number" ? body["temperature"] : undefined,
        max_tokens: typeof body["max_tokens"] === "number" ? body["max_tokens"] : undefined,
      });
      json(ctx.res, result);
    } catch (err) {
      // Log full error server-side; return a generic message to avoid exposing internals
      console.error("[inference] Chat completion failed:", err);
      json(ctx.res, { error: "Inference service unavailable" }, 502);
    }
  });

  // List available models
  router.get("/api/inference/models", async (ctx) => {
    try {
      const models = await inferenceRouter.listModels();
      json(ctx.res, { models });
    } catch (err) {
      console.error("[inference] List models failed:", err);
      json(ctx.res, { error: "Could not retrieve model list" }, 502);
    }
  });
}
