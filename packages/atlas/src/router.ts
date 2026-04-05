/**
 * Atlas inference router.
 *
 * Routes chat completion requests to the appropriate inference provider
 * based on the requested model name. Supports multiple providers and
 * wildcard model routing rules.
 */

import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
  ModelRoute,
} from "./types.js";
import { InferenceProvider } from "./provider.js";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class InferenceRouter {
  private readonly providers = new Map<string, InferenceProvider>();
  private routes: ModelRoute[] = [];

  // -------------------------------------------------------------------------
  // Provider management
  // -------------------------------------------------------------------------

  addProvider(config: ProviderConfig): void {
    this.providers.set(config.id, new InferenceProvider(config));
  }

  removeProvider(id: string): void {
    this.providers.delete(id);
  }

  addRoute(route: ModelRoute): void {
    this.routes.push(route);
  }

  clearRoutes(): void {
    this.routes = [];
  }

  // -------------------------------------------------------------------------
  // Routing logic
  // -------------------------------------------------------------------------

  private findProvider(model: string): InferenceProvider | null {
    // Check explicit routes first
    for (const route of this.routes) {
      if (matchPattern(route.pattern, model)) {
        const provider = this.providers.get(route.providerId);
        return provider ?? null;
      }
    }

    // Fall back to any enabled provider with a matching default model
    for (const provider of this.providers.values()) {
      if (
        provider.config.enabled !== false &&
        provider.config.defaultModel === model
      ) {
        return provider;
      }
    }

    // Fall back to the first enabled provider
    for (const provider of this.providers.values()) {
      if (provider.config.enabled !== false) {
        return provider;
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async complete(
    req: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const provider = this.findProvider(req.model);
    if (!provider) {
      throw new Error(
        `No inference provider available for model '${req.model}'`
      );
    }
    return provider.complete(req);
  }

  async listModels(): Promise<Array<{ provider: string; model: string }>> {
    const results: Array<{ provider: string; model: string }> = [];
    for (const [id, provider] of this.providers.entries()) {
      if (provider.config.enabled === false) continue;
      const models = await provider.listModels();
      for (const model of models) {
        results.push({ provider: id, model });
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Pattern matching helper
// ---------------------------------------------------------------------------

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === value;

  // Simple glob: convert * to regex .*
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${regexStr}$`).test(value);
}

// ---------------------------------------------------------------------------
// Default router factory
// ---------------------------------------------------------------------------

export function createDefaultRouter(): InferenceRouter {
  const router = new InferenceRouter();

  // Add Ollama as the default local provider
  router.addProvider({
    id: "ollama",
    type: "ollama",
    baseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    defaultModel: process.env["OLLAMA_DEFAULT_MODEL"] ?? "llama3.2",
    enabled: true,
  });

  // Optionally add an OpenAI-compatible provider
  if (process.env["OPENAI_API_KEY"]) {
    router.addProvider({
      id: "openai",
      type: "openai",
      baseUrl: process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com",
      apiKey: process.env["OPENAI_API_KEY"],
      defaultModel: "gpt-4o",
      enabled: true,
    });

    // Route gpt-* models to OpenAI
    router.addRoute({ pattern: "gpt-*", providerId: "openai" });
  }

  return router;
}
