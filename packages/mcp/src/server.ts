/**
 * MCP HTTP Server.
 *
 * Implements a JSON-RPC 2.0 endpoint compatible with the Model Context
 * Protocol specification. Supports:
 *  - tools/list
 *  - tools/call
 *  - ping
 *  - initialize
 */

import { IncomingMessage, ServerResponse, createServer, Server } from "http";
import {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCP_ERROR,
  ToolCall,
} from "./types.js";
import { ToolRegistry } from "./registry.js";

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function success<T>(id: string | number, result: T): MCPResponse<T> {
  return { jsonrpc: "2.0", id, result };
}

function error(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, data },
  };
}

// ---------------------------------------------------------------------------
// Request body reader
// ---------------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += String(chunk)));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// MCP Server capabilities
// ---------------------------------------------------------------------------

const SERVER_INFO = {
  name: "aios-mcp",
  version: "0.1.0",
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
};

// ---------------------------------------------------------------------------
// MCPServer
// ---------------------------------------------------------------------------

export interface MCPServerOptions {
  port?: number;
  host?: string;
  registry: ToolRegistry;
}

export class MCPServer {
  private readonly registry: ToolRegistry;
  private readonly port: number;
  private readonly host: string;
  private server: Server | null = null;

  constructor(options: MCPServerOptions) {
    this.registry = options.registry;
    this.port = options.port ?? 3001;
    this.host = options.host ?? "0.0.0.0";
  }

  // -------------------------------------------------------------------------
  // Method dispatch
  // -------------------------------------------------------------------------

  private async handleMethod(
    method: string,
    params: Record<string, unknown>,
    id: string | number
  ): Promise<MCPResponse> {
    switch (method) {
      case "ping":
        return success(id, {});

      case "initialize":
        return success(id, {
          protocolVersion: "2024-11-05",
          capabilities: SERVER_CAPABILITIES,
          serverInfo: SERVER_INFO,
        });

      case "tools/list":
        return success(id, { tools: this.registry.listTools() });

      case "tools/call": {
        const toolName = params["name"];
        const toolInput = params["arguments"] ?? params["input"] ?? {};

        if (typeof toolName !== "string") {
          return error(
            id,
            MCP_ERROR.INVALID_PARAMS,
            "params.name must be a string"
          );
        }

        if (!this.registry.has(toolName)) {
          return error(
            id,
            MCP_ERROR.TOOL_NOT_FOUND,
            `Tool '${toolName}' not found`
          );
        }

        const call: ToolCall = {
          id: String(id),
          name: toolName,
          input: toolInput as Record<string, unknown>,
        };

        const result = await this.registry.execute(call, {
          requestId: String(id),
          metadata: params["_meta"] as Record<string, unknown> | undefined,
        });

        return success(id, {
          content: result.content,
          isError: result.isError ?? false,
        });
      }

      default:
        return error(
          id,
          MCP_ERROR.METHOD_NOT_FOUND,
          `Method '${method}' not found`
        );
    }
  }

  // -------------------------------------------------------------------------
  // HTTP handler
  // -------------------------------------------------------------------------

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", server: SERVER_INFO }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify(error(null, MCP_ERROR.PARSE_ERROR, "Failed to read request body")));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(
        JSON.stringify(error(null, MCP_ERROR.PARSE_ERROR, "Invalid JSON"))
      );
      return;
    }

    // Support batch requests
    if (Array.isArray(parsed)) {
      const responses = await Promise.all(
        parsed.map((item) => this.processSingle(item))
      );
      res.writeHead(200);
      res.end(JSON.stringify(responses));
      return;
    }

    const response = await this.processSingle(parsed);
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  private async processSingle(item: unknown): Promise<MCPResponse> {
    if (
      typeof item !== "object" ||
      item === null ||
      (item as MCPRequest).jsonrpc !== "2.0"
    ) {
      return error(null, MCP_ERROR.INVALID_REQUEST, "Invalid JSON-RPC request");
    }

    const req = item as MCPRequest;
    const { id, method, params = {} } = req;

    if (typeof method !== "string") {
      return error(id, MCP_ERROR.INVALID_REQUEST, "method must be a string");
    }

    return this.handleMethod(method, params, id);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error("[mcp] Unhandled error:", err);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(
              JSON.stringify(
                error(null, MCP_ERROR.INTERNAL_ERROR, "Internal server error")
              )
            );
          }
        });
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[mcp] MCP server listening on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
        this.server = null;
      });
    });
  }
}
