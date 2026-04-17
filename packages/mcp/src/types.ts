/**
 * MCP (Model Context Protocol) type definitions.
 *
 * Follows the MCP specification for tools, resources, and prompts.
 * https://modelcontextprotocol.io/specification
 */

// ---------------------------------------------------------------------------
// JSON Schema subset used in tool definitions
// ---------------------------------------------------------------------------

export type JSONSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// ---------------------------------------------------------------------------
// Tool call / result
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; uri: string; mimeType?: string; text?: string };

export interface ToolResult {
  callId: string;
  content: ToolResultContent[];
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export type ToolHandler = (
  input: Record<string, unknown>,
  context?: ToolExecutionContext
) => Promise<ToolResultContent[]>;

export interface ToolExecutionContext {
  agentId?: string;
  sessionId?: string;
  requestId?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MCP Server request/response envelopes
// ---------------------------------------------------------------------------

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP error codes
export const MCP_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_ERROR: -32002,
  VALIDATION_ERROR: -32003,
} as const;
