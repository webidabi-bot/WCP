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

    if (!body || !body.messages || !body.model) {
      json(ctx.res, { error: "'model' and 'messages' are required" }, 400);
      return;
    }

    try {
      const result = await inferenceRouter.complete({
        model: String(body.model),
        messages: body.messages as Parameters<typeof inferenceRouter.complete>[0]["messages"],
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
      });
      json(ctx.res, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(ctx.res, { error: message }, 502);
    }
  });

  // List available models
  router.get("/api/inference/models", async (ctx) => {
    try {
      const models = await inferenceRouter.listModels();
      json(ctx.res, { models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(ctx.res, { error: message }, 502);
    }
  });
}
