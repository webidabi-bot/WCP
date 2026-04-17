/**
 * MCP Tool Registry and Execution Engine.
 *
 * Manages tool registration, input validation, and execution with timeout
 * and error handling.
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import {
  ToolDefinition,
  ToolHandler,
  ToolCall,
  ToolResult,
  ToolResultContent,
  ToolExecutionContext,
  JSONSchema,
  MCP_ERROR,
} from "./types.js";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

interface RegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  validate: ReturnType<typeof ajv.compile>;
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private readonly tools = new Map<string, RegistryEntry>();

  /**
   * Register a tool with a definition and handler.
   */
  register(
    definition: ToolDefinition,
    handler: ToolHandler
  ): void {
    const validate = ajv.compile(definition.inputSchema as object);
    this.tools.set(definition.name, { definition, handler, validate });
  }

  /**
   * Unregister a tool by name.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Return all registered tool definitions.
   */
  listTools(): ToolDefinition[] {
    return [...this.tools.values()].map((e) => e.definition);
  }

  /**
   * Check whether a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool call and return the result.
   */
  async execute(
    call: ToolCall,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const entry = this.tools.get(call.name);

    if (!entry) {
      return {
        callId: call.id,
        isError: true,
        content: [
          {
            type: "text",
            text: `Tool '${call.name}' not found`,
          },
        ],
      };
    }

    // Validate input
    const valid = entry.validate(call.input);
    if (!valid) {
      const errors = (entry.validate.errors ?? [])
        .map((e) => `${e.instancePath} ${e.message}`)
        .join("; ");
      return {
        callId: call.id,
        isError: true,
        content: [
          {
            type: "text",
            text: `Input validation failed: ${errors}`,
          },
        ],
      };
    }

    // Execute with timeout
    const timeoutMs = context?.timeout ?? 30_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Tool '${call.name}' timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    try {
      const content = await Promise.race([
        entry.handler(call.input, context),
        timeoutPromise,
      ]);
      return { callId: call.id, content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        callId: call.id,
        isError: true,
        content: [{ type: "text", text: message }],
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

// ---------------------------------------------------------------------------
// Built-in tools
// ---------------------------------------------------------------------------

export function registerBuiltinTools(registry: ToolRegistry): void {
  // echo — useful for testing and prompt chaining
  registry.register(
    {
      name: "echo",
      description: "Returns the input message unchanged. Useful for testing.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Message to echo back" },
        },
        required: ["message"],
      },
    },
    async (input) => [
      { type: "text", text: String(input["message"] ?? "") },
    ]
  );

  // now — returns the current UTC timestamp
  registry.register(
    {
      name: "now",
      description: "Returns the current UTC date and time as an ISO 8601 string.",
      inputSchema: { type: "object", properties: {} },
    },
    async () => [{ type: "text", text: new Date().toISOString() }]
  );

  // list_tools — introspection tool
  registry.register(
    {
      name: "list_tools",
      description: "Lists all tools available in this MCP server.",
      inputSchema: { type: "object", properties: {} },
    },
    async (_input, _ctx) => {
      // The registry is captured in the closure below
      throw new Error("list_tools handler must be overridden after registration");
    }
  );
}

/**
 * Create a standard AIOS tool registry pre-loaded with built-in tools.
 */
export function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);

  // Override list_tools now that registry is available
  registry.unregister("list_tools");
  registry.register(
    {
      name: "list_tools",
      description: "Lists all tools available in this MCP server.",
      inputSchema: { type: "object", properties: {} },
    },
    async () => {
      const tools = registry.listTools();
      return [
        {
          type: "text",
          text: JSON.stringify(tools, null, 2),
        },
      ];
    }
  );

  return registry;
}
