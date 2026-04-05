/**
 * Tests for @aios/mcp ToolRegistry
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry, createRegistry } from "./registry.js";

describe("ToolRegistry", () => {
  it("should register and list tools", () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "greet",
        description: "Greets someone",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      async (input) => [{ type: "text", text: `Hello, ${input["name"]}!` }]
    );

    const tools = registry.listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0]?.name, "greet");
  });

  it("should execute a tool", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "add",
        description: "Adds two numbers",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
        },
      },
      async (input) => [
        {
          type: "text",
          text: String(Number(input["a"]) + Number(input["b"])),
        },
      ]
    );

    const result = await registry.execute({
      id: "1",
      name: "add",
      input: { a: 3, b: 4 },
    });

    assert.equal(result.isError, undefined);
    assert.equal(result.content[0]?.type, "text");
    assert.equal((result.content[0] as { type: "text"; text: string }).text, "7");
  });

  it("should return error for unknown tool", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute({ id: "1", name: "nope", input: {} });
    assert.equal(result.isError, true);
  });

  it("should validate input schema", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "strict",
        description: "Requires a name string",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      async (input) => [{ type: "text", text: String(input["name"]) }]
    );

    const result = await registry.execute({
      id: "1",
      name: "strict",
      input: {},  // missing required 'name'
    });
    assert.equal(result.isError, true);
  });

  it("createRegistry should include built-in tools", () => {
    const registry = createRegistry();
    const names = registry.listTools().map((t) => t.name);
    assert.ok(names.includes("echo"), "echo tool should be registered");
    assert.ok(names.includes("now"), "now tool should be registered");
    assert.ok(names.includes("list_tools"), "list_tools tool should be registered");
  });

  it("echo tool should return the message", async () => {
    const registry = createRegistry();
    const result = await registry.execute({
      id: "1",
      name: "echo",
      input: { message: "hello world" },
    });
    assert.equal(result.isError, undefined);
    assert.equal((result.content[0] as { type: "text"; text: string }).text, "hello world");
  });

  it("now tool should return an ISO timestamp", async () => {
    const registry = createRegistry();
    const result = await registry.execute({ id: "1", name: "now", input: {} });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    assert.ok(!Number.isNaN(Date.parse(text)), "Should be a valid date");
  });

  it("should unregister a tool", () => {
    const registry = new ToolRegistry();
    registry.register(
      { name: "tmp", description: "tmp", inputSchema: {} },
      async () => []
    );
    assert.ok(registry.has("tmp"));
    assert.ok(registry.unregister("tmp"));
    assert.ok(!registry.has("tmp"));
  });

  it("should handle tool timeout", async () => {
    const registry = new ToolRegistry();
    registry.register(
      { name: "slow", description: "slow", inputSchema: {} },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [{ type: "text" as const, text: "done" }];
      }
    );

    const result = await registry.execute(
      { id: "1", name: "slow", input: {} },
      { timeout: 100 }  // 100ms timeout
    );
    assert.equal(result.isError, true);
    assert.ok(
      (result.content[0] as { type: "text"; text: string }).text.includes("timed out"),
      "Should indicate timeout"
    );
  });
});
