/**
 * @aios/mcp
 *
 * MCP (Model Context Protocol) tool execution engine.
 *
 * Provides:
 *  - Type definitions aligned with the MCP specification
 *  - ToolRegistry for registering and executing tools
 *  - MCPServer — a JSON-RPC 2.0 HTTP server
 *  - Built-in tools (echo, now, list_tools)
 *  - createRegistry() factory
 */

export * from "./types.js";
export { ToolRegistry, registerBuiltinTools, createRegistry } from "./registry.js";
export { MCPServer } from "./server.js";
export type { MCPServerOptions } from "./server.js";
