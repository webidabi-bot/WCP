/**
 * Atlas inference type definitions.
 *
 * Compatible with the OpenAI Chat Completions API format so any
 * OpenAI-compatible backend (Ollama, llama.cpp, vLLM, etc.) can be used.
 */

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  name?: string;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
}

export interface ToolCallRequest {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolSpec[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: UsageStats;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ProviderType = "ollama" | "openai" | "anthropic" | "custom";

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  timeoutMs?: number;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Model routing
// ---------------------------------------------------------------------------

export interface ModelRoute {
  /** Pattern matching model name (supports * wildcard) */
  pattern: string;
  providerId: string;
  /** Override the model name sent to the provider */
  modelAlias?: string;
}
