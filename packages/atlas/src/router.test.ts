/**
 * Tests for @aios/atlas InferenceRouter
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InferenceRouter } from "./router.js";
import { InferenceProvider } from "./provider.js";

describe("InferenceRouter", () => {
  it("should add and route to providers", async () => {
    const router = new InferenceRouter();

    // Track calls
    let called = false;
    const mockComplete = async () => {
      called = true;
      return {
        id: "test",
        object: "chat.completion" as const,
        created: 0,
        model: "mock",
        choices: [{ index: 0, message: { role: "assistant" as const, content: "hi" }, finish_reason: "stop" as const }],
      };
    };

    router.addProvider({ id: "mock", type: "custom", baseUrl: "http://mock", enabled: true });

    // Monkey-patch the provider's complete method
    const provider = (router as unknown as { providers: Map<string, InferenceProvider> }).providers.get("mock")!;
    provider.complete = mockComplete;

    const result = await router.complete({ model: "mock-model", messages: [{ role: "user", content: "hi" }] });
    assert.ok(called);
    assert.equal(result.choices[0]?.message.content, "hi");
  });

  it("should throw when no provider matches", async () => {
    const router = new InferenceRouter();
    await assert.rejects(
      () => router.complete({ model: "nonexistent", messages: [] }),
      /No inference provider available/
    );
  });

  it("should route by pattern", async () => {
    const router = new InferenceRouter();
    let usedProvider = "";

    const makeProvider = (id: string) => {
      router.addProvider({ id, type: "custom", baseUrl: `http://${id}`, enabled: true });
      const provider = (router as unknown as { providers: Map<string, InferenceProvider> }).providers.get(id)!;
      provider.complete = async () => {
        usedProvider = id;
        return {
          id: id, object: "chat.completion" as const, created: 0, model: id,
          choices: [{ index: 0, message: { role: "assistant" as const, content: id }, finish_reason: "stop" as const }],
        };
      };
    };

    makeProvider("ollama");
    makeProvider("openai");

    router.addRoute({ pattern: "gpt-*", providerId: "openai" });

    await router.complete({ model: "gpt-4o", messages: [] });
    assert.equal(usedProvider, "openai");

    await router.complete({ model: "llama3.2", messages: [] });
    assert.equal(usedProvider, "ollama");
  });
});
