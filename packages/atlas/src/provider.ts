/**
 * Atlas inference provider client.
 *
 * Wraps HTTP calls to OpenAI-compatible inference backends (Ollama, OpenAI,
 * llama.cpp server, vLLM, etc.).
 */

import { request } from "https";
import { request as httpRequest } from "http";
import { URL } from "url";
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Low-level HTTP helper
// ---------------------------------------------------------------------------

async function postJSON<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 60_000
): Promise<T> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? request : httpRequest;
  const bodyStr = JSON.stringify(body);

  return new Promise<T>((resolve, reject) => {
    const req = transport(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Invalid JSON response from ${url}: ${data}`));
          }
        });
        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

async function getJSON<T>(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 60_000
): Promise<T> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? request : httpRequest;

  return new Promise<T>((resolve, reject) => {
    const req = transport(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Invalid JSON response from ${url}: ${data}`));
          }
        });
        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Provider client
// ---------------------------------------------------------------------------

export class InferenceProvider {
  readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Send a chat completion request to the provider.
   */
  async complete(
    req: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    // Determine the correct endpoint path for different provider types
    let endpoint: string;
    switch (this.config.type) {
      case "ollama":
        endpoint = `${this.config.baseUrl}/api/chat`;
        return this.completeOllama(req, headers);
      case "openai":
      case "custom":
      default:
        endpoint = `${this.config.baseUrl}/v1/chat/completions`;
        break;
    }

    return postJSON<ChatCompletionResponse>(
      endpoint,
      req,
      headers,
      this.config.timeoutMs ?? 60_000
    );
  }

  /**
   * Ollama uses a slightly different request/response format.
   * We translate to/from the OpenAI-compatible format.
   */
  private async completeOllama(
    req: ChatCompletionRequest,
    headers: Record<string, string>
  ): Promise<ChatCompletionResponse> {
    const ollamaReq = {
      model: req.model,
      messages: req.messages,
      stream: false,
      options: {
        temperature: req.temperature,
        top_p: req.top_p,
        num_predict: req.max_tokens,
      },
    };

    const ollamaRes = await postJSON<{
      model: string;
      message: { role: string; content: string };
      done: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    }>(
      `${this.config.baseUrl}/api/chat`,
      ollamaReq,
      headers,
      this.config.timeoutMs ?? 60_000
    );

    // Translate Ollama response to OpenAI format
    return {
      id: `ollama-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: ollamaRes.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: ollamaRes.message?.content ?? "",
          },
          finish_reason: ollamaRes.done ? "stop" : null,
        },
      ],
      usage: {
        prompt_tokens: ollamaRes.prompt_eval_count ?? 0,
        completion_tokens: ollamaRes.eval_count ?? 0,
        total_tokens:
          (ollamaRes.prompt_eval_count ?? 0) + (ollamaRes.eval_count ?? 0),
      },
    };
  }

  /**
   * List available models from the provider.
   */
  async listModels(): Promise<string[]> {
    if (this.config.type === "ollama") {
      try {
        const res = await getJSON<{ models: Array<{ name: string }> }>(
          `${this.config.baseUrl}/api/tags`,
          {},
          5_000
        );
        return (res.models ?? []).map((m) => m.name);
      } catch {
        return [];
      }
    }
    return this.config.defaultModel ? [this.config.defaultModel] : [];
  }
}
