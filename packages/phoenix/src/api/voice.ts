/**
 * Voice orchestration API routes.
 *
 * POST /api/voice/sessions              — create voice session
 * GET  /api/voice/sessions/:id          — get session
 * DELETE /api/voice/sessions/:id        — close session
 * POST /api/voice/sessions/:id/transcribe — transcribe audio chunk
 * POST /api/voice/sessions/:id/synthesize — synthesize speech
 */

import { Router, json, notFound } from "../router.js";
import { VoiceOrchestrator, MockTranscriber, MockSynthesizer } from "@aios/voice";

const orchestrator = new VoiceOrchestrator({
  transcriber: new MockTranscriber(),
  synthesizer: new MockSynthesizer(),
});

export function registerVoiceRoutes(router: Router): void {
  // Create voice session
  router.post("/api/voice/sessions", (ctx) => {
    const body = ctx.body as Record<string, unknown> | null;
    const session = orchestrator.createSession({
      agentId: body?.["agentId"] != null ? String(body["agentId"]) : undefined,
      sessionId: body?.["sessionId"] != null ? String(body["sessionId"]) : undefined,
      language: body?.["language"] != null ? String(body["language"]) : undefined,
    });
    json(ctx.res, { session }, 201);
  });

  // Get voice session
  router.get("/api/voice/sessions/:id", (ctx) => {
    const session = orchestrator.getSession(ctx.params["id"]!);
    if (!session) return notFound(ctx.res);
    json(ctx.res, { session });
  });

  // Close voice session
  router.delete("/api/voice/sessions/:id", (ctx) => {
    const closed = orchestrator.closeSession(ctx.params["id"]!);
    if (!closed) return notFound(ctx.res);
    json(ctx.res, { closed: true });
  });

  // Transcribe audio
  router.post("/api/voice/sessions/:id/transcribe", async (ctx) => {
    const session = orchestrator.getSession(ctx.params["id"]!);
    if (!session) return notFound(ctx.res);

    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.["audio"]) {
      json(ctx.res, { error: "'audio' (base64) is required" }, 400);
      return;
    }

    try {
      const result = await orchestrator.transcribe(
        ctx.params["id"]!,
        String(body["audio"]),
        { language: body["language"] != null ? String(body["language"]) : undefined }
      );
      json(ctx.res, { result });
    } catch (err) {
      console.error("[voice] Transcription failed:", err);
      json(ctx.res, { error: "Transcription failed" }, 500);
    }
  });

  // Synthesize speech
  router.post("/api/voice/sessions/:id/synthesize", async (ctx) => {
    const session = orchestrator.getSession(ctx.params["id"]!);
    if (!session) return notFound(ctx.res);

    const body = ctx.body as Record<string, unknown> | null;
    if (!body?.["text"]) {
      json(ctx.res, { error: "'text' is required" }, 400);
      return;
    }

    try {
      const result = await orchestrator.synthesize(ctx.params["id"]!, String(body["text"]));
      // Return audio as base64
      json(ctx.res, {
        audio: result.audio.toString("base64"),
        mimeType: result.mimeType,
        provider: result.provider,
      });
    } catch (err) {
      console.error("[voice] Synthesis failed:", err);
      json(ctx.res, { error: "Speech synthesis failed" }, 500);
    }
  });
}
