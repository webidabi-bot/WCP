import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Plus, Trash2, Wand2, Code2, FileJson, Eye, Laptop, Smartphone } from "lucide-react";

const PARAM_TYPES = ["string", "number", "boolean", "array", "object"];

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const defaultParam = () => ({
  id: makeId(),
  name: "",
  type: "string",
  description: "",
  required: true,
});

const defaultTool = () => ({
  id: makeId(),
  name: "",
  description: "",
  parameters: [defaultParam()],
  returnDescription: "",
  notes: "",
});

function sanitizeName(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^[^a-z_]+/, "");
}

function validateTools(tools) {
  const issues = [];
  const seenTools = new Set();

  for (const tool of tools) {
    const rawName = tool.name.trim();
    const sanitized = sanitizeName(rawName);
    if (!rawName) {
      issues.push({ toolId: tool.id, field: "name", message: "Tool name is required." });
    } else if (!sanitized) {
      issues.push({ toolId: tool.id, field: "name", message: "Tool name must start with a letter or underscore." });
    } else {
      if (sanitized !== rawName) {
        issues.push({ toolId: tool.id, field: "name", message: `Name will be auto-normalized to "${sanitized}" in the output.` });
      }
      if (seenTools.has(sanitized)) {
        issues.push({ toolId: tool.id, field: "name", message: "Tool name must be unique." });
      }
      seenTools.add(sanitized);
    }

    const seenParams = new Set();
    for (const param of tool.parameters) {
      const rawParam = param.name.trim();
      const sanitizedParam = sanitizeName(rawParam);
      if (!rawParam) {
        issues.push({ toolId: tool.id, paramId: param.id, field: "name", message: "Parameter name is required." });
      } else if (!sanitizedParam) {
        issues.push({ toolId: tool.id, paramId: param.id, field: "name", message: "Parameter name must start with a letter or underscore." });
      } else {
        if (sanitizedParam !== rawParam) {
          issues.push({ toolId: tool.id, paramId: param.id, field: "name", message: `Name will be auto-normalized to "${sanitizedParam}" in the output.` });
        }
        if (seenParams.has(sanitizedParam)) {
          issues.push({ toolId: tool.id, paramId: param.id, field: "name", message: "Parameter name must be unique within the tool." });
        }
        seenParams.add(sanitizedParam);
      }
    }
  }

  return issues;
}

function renderTsType(type, required, description) {
  const typeMap = {
    string: "z.string()",
    number: "z.number()",
    boolean: "z.boolean()",
    array: "z.array(z.unknown())",
    object: "z.object({})",
  };
  const base = typeMap[type] || "z.unknown()";
  const desc = description ? `.describe(${JSON.stringify(description)})` : "";
  const opt = required ? "" : ".optional()";
  return `${base}${desc}${opt}`;
}

function generateTS(tools) {
  if (!tools.length) return "// Add tools above to generate code";

  const blocks = tools.map((tool) => {
    const params = tool.parameters
      .map((param) => `    ${sanitizeName(param.name) || "param"}: ${renderTsType(param.type, param.required, param.description)},`)
      .join("\n");
    const toolName = sanitizeName(tool.name) || "my_tool";

    return `server.tool(\n  ${JSON.stringify(toolName)},\n  ${JSON.stringify(tool.description || "")},\n  {\n${params}\n  },\n  async (params) => {\n    // Returns: ${tool.returnDescription || "tool result"}\n    // TODO: implement ${toolName}\n    return {\n      content: [{ type: "text", text: "Result from ${toolName}" }],\n    };\n  }\n);`;
  });

  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\nimport { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";\nimport { z } from "zod";\n\nconst server = new McpServer({\n  name: "my-mcp-server",\n  version: "1.0.0",\n});\n\n${blocks.join("\n\n")}\n\nconst transport = new StdioServerTransport();\nawait server.connect(transport);`;
}

function renderPyType(type) {
  const map = {
    string: "str",
    number: "float",
    boolean: "bool",
    array: "list",
    object: "dict",
  };
  return map[type] || "Any";
}

function generatePython(tools) {
  if (!tools.length) return "# Add tools above to generate code";

  const blocks = tools.map((tool) => {
    const params = tool.parameters.length
      ? tool.parameters
          .map((param) => `    ${sanitizeName(param.name) || "param"}: ${renderPyType(param.type)}${param.required ? "" : " = None"}`)
          .join(",\n")
      : "";

    const funcName = sanitizeName(tool.name) || "my_tool";
    const safeDesc = (tool.description || "").replace(/"""/g, "'''");
    const safeReturn = (tool.returnDescription || "tool result").replace(/"""/g, "'''");
    return `@mcp.tool()\ndef ${funcName}(\n${params}\n) -> dict:\n    \"\"\"${safeDesc}\n\n    Returns: ${safeReturn}\n    \"\"\"\n    return {\n        \"ok\": True,\n        \"summary\": \"Result from ${funcName}\",\n        \"data\": {}\n    }`;
  });

  return `from mcp.server.fastmcp import FastMCP\nfrom typing import Any\n\nmcp = FastMCP("my-mcp-server")\n\n${blocks.join("\n\n")}\n\nif __name__ == "__main__":\n    mcp.run()`;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    purple: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  };

  return <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Field({ label, error, children }) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
        {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      </div>
      {children}
    </label>
  );
}

function inputClass(hasError = false) {
  return `w-full rounded-xl border bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition ${
    hasError
      ? "border-rose-500/60 focus:border-rose-400"
      : "border-slate-700 focus:border-blue-500"
  }`;
}

function ParamEditor({ param, issues, onChange, onDelete }) {
  const nameError = issues.find((i) => i.field === "name")?.message;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1.3fr_180px]">
        <Field label="Parameter Name" error={nameError}>
          <input
            className={inputClass(Boolean(nameError))}
            value={param.name}
            onChange={(e) => onChange({ ...param, name: e.target.value })}
            placeholder="query"
          />
        </Field>
        <Field label="Type">
          <select
            className={inputClass()}
            value={param.type}
            onChange={(e) => onChange({ ...param, type: e.target.value })}
          >
            {PARAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <Field label="Description">
          <input
            className={inputClass()}
            value={param.description}
            onChange={(e) => onChange({ ...param, description: e.target.value })}
            placeholder="Search text to look for"
          />
        </Field>

        <label className="flex h-[46px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={param.required}
            onChange={(e) => onChange({ ...param, required: e.target.checked })}
            className="h-4 w-4"
          />
          Required
        </label>

        <button
          onClick={onDelete}
          className="flex h-[46px] items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15"
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </button>
      </div>
    </div>
  );
}

function ToolCard({ tool, active, onClick, onChange, onDelete, issues }) {
  const toolNameError = issues.find((i) => !i.paramId && i.field === "name")?.message;

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`rounded-3xl border p-4 shadow-sm transition ${
        active
          ? "border-blue-500/50 bg-slate-900"
          : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={active ? "blue" : "slate"}>{tool.parameters.length} params</Badge>
            {issues.length ? <Badge tone="rose">{issues.length} issue{issues.length > 1 ? "s" : ""}</Badge> : <Badge tone="green">valid</Badge>}
          </div>
          <input
            className={`w-full bg-transparent text-base font-semibold text-white outline-none ${toolNameError ? "placeholder:text-rose-300/70" : "placeholder:text-slate-500"}`}
            value={tool.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ ...tool, name: e.target.value })}
            placeholder="tool_name"
          />
          <textarea
            className="mt-2 w-full resize-none bg-transparent text-sm text-slate-400 outline-none placeholder:text-slate-600"
            rows={2}
            value={tool.description}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ ...tool, description: e.target.value })}
            placeholder="Describe what this tool does"
          />
          {toolNameError ? <p className="mt-1 text-xs text-rose-300">{toolNameError}</p> : null}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-rose-500/40 hover:text-rose-300"
        >
          Delete
        </button>
      </div>

      {active ? (
        <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Return Description">
              <input
                className={inputClass()}
                value={tool.returnDescription}
                onChange={(e) => onChange({ ...tool, returnDescription: e.target.value })}
                placeholder="Structured result summary"
              />
            </Field>
            <Field label="Notes">
              <input
                className={inputClass()}
                value={tool.notes}
                onChange={(e) => onChange({ ...tool, notes: e.target.value })}
                placeholder="Internal notes or implementation hints"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Parameters</h3>
              <button
                onClick={() => onChange({ ...tool, parameters: [...tool.parameters, defaultParam()] })}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-blue-500/50 hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Add Parameter
              </button>
            </div>

            {tool.parameters.map((param) => (
              <ParamEditor
                key={param.id}
                param={param}
                issues={issues.filter((i) => i.paramId === param.id)}
                onChange={(updated) =>
                  onChange({
                    ...tool,
                    parameters: tool.parameters.map((p) => (p.id === param.id ? updated : p)),
                  })
                }
                onDelete={() =>
                  onChange({
                    ...tool,
                    parameters:
                      tool.parameters.length > 1
                        ? tool.parameters.filter((p) => p.id !== param.id)
                        : [defaultParam()],
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {tool.parameters.map((param) => (
            <Badge key={param.id} tone={param.required ? "purple" : "slate"}>
              {(param.name || "param") + ": " + param.type}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function App() {
  const [tools, setTools] = useState([
    {
      ...defaultTool(),
      name: "search_ai_log",
      description: "Search AI log events by text and optional filters.",
      returnDescription: "Concise summary and matching log event previews.",
      parameters: [
        { ...defaultParam(), name: "query", description: "Text to search for in AI log events", required: true },
        { ...defaultParam(), name: "limit", type: "number", description: "Maximum number of results to return", required: false },
        { ...defaultParam(), name: "agent", description: "Optional agent filter such as adam or hermes", required: false },
        { ...defaultParam(), name: "since", description: "Optional ISO date or datetime filter", required: false },
      ],
    },
  ]);
  const [activeId, setActiveId] = useState(tools[0].id);
  const [lang, setLang] = useState("py");
  const [mobileTab, setMobileTab] = useState("builder");
  const [copied, setCopied] = useState(false);

  const issues = useMemo(() => validateTools(tools), [tools]);
  const issuesByTool = useMemo(() => {
    const map = new Map();
    for (const issue of issues) {
      if (!map.has(issue.toolId)) map.set(issue.toolId, []);
      map.get(issue.toolId).push(issue);
    }
    return map;
  }, [issues]);

  const activeTool = tools.find((tool) => tool.id === activeId) || tools[0];
  const code = useMemo(() => (lang === "ts" ? generateTS(tools) : generatePython(tools)), [lang, tools]);

  function updateTool(toolId, updated) {
    setTools((current) => current.map((tool) => (tool.id === toolId ? updated : tool)));
  }

  function addTool() {
    const next = defaultTool();
    setTools((current) => [...current, next]);
    setActiveId(next.id);
  }

  function deleteTool(toolId) {
    setTools((current) => {
      const next = current.filter((tool) => tool.id !== toolId);
      if (!next.length) {
        const fallback = defaultTool();
        setActiveId(fallback.id);
        return [fallback];
      }
      if (toolId === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setTimeout(() => setCopied(false), 1400);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function exportJSON() {
    const data = tools.map(({ id: _tid, ...tool }) => ({
      ...tool,
      parameters: tool.parameters.map(({ id: _pid, ...p }) => p),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcp-tools.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadAiLogPreset() {
    const preset = {
      ...defaultTool(),
      name: "search_ai_log",
      description: "Search AI log events by text and optional filters.",
      returnDescription: "Summary metadata and newest matching events first.",
      parameters: [
        { ...defaultParam(), name: "query", description: "Text to search within AI log events", required: true },
        { ...defaultParam(), name: "limit", type: "number", description: "Maximum number of results", required: false },
        { ...defaultParam(), name: "agent", description: "Optional agent filter", required: false },
        { ...defaultParam(), name: "since", description: "Optional ISO date/datetime filter", required: false },
      ],
      notes: "Good first real AIOS MCP tool. Read-only and easy to verify.",
    };
    setTools([preset]);
    setActiveId(preset.id);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 md:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/90 shadow-2xl shadow-black/30">
          <header className="border-b border-slate-800 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-300">
                  <Wand2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">MCP Tool Builder</h1>
                    <Badge tone="purple">graphical interface</Badge>
                    <Badge tone="amber">AIOS-ready</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Build MCP tools visually, validate them, and export clean Python or TypeScript starter code.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={loadAiLogPreset}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Load AI Log Preset
                </button>
                <button
                  onClick={addTool}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200 transition hover:bg-blue-500/20"
                >
                  <Plus className="h-4 w-4" />
                  New Tool
                </button>
              </div>
            </div>
          </header>

          <div className="border-b border-slate-800 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={issues.length ? "rose" : "green"}>
                {issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "Ready to export"}
              </Badge>
              <Badge tone="slate">{tools.length} tool{tools.length > 1 ? "s" : ""}</Badge>
              <Badge tone="blue">{lang === "py" ? "Python" : "TypeScript"}</Badge>
            </div>
          </div>

          <div className="border-b border-slate-800 px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMobileTab("builder")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  mobileTab === "builder" ? "bg-blue-500/15 text-blue-200" : "bg-slate-900 text-slate-400"
                }`}
              >
                <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4" /> Builder</span>
              </button>
              <button
                onClick={() => setMobileTab("code")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  mobileTab === "code" ? "bg-blue-500/15 text-blue-200" : "bg-slate-900 text-slate-400"
                }`}
              >
                <span className="inline-flex items-center gap-2"><Code2 className="h-4 w-4" /> Code</span>
              </button>
            </div>
          </div>

          <div className="grid min-h-[72vh] lg:grid-cols-[1.08fr_0.92fr]">
            <section className={`${mobileTab === "builder" ? "block" : "hidden"} border-r border-slate-800 lg:block`}>
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">Tool Designer</span>
                </div>
              </div>

              <div className="space-y-4 p-4 md:p-6">
                {tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    active={tool.id === activeId}
                    onClick={() => setActiveId(tool.id)}
                    onChange={(updated) => updateTool(tool.id, updated)}
                    onDelete={() => deleteTool(tool.id)}
                    issues={issuesByTool.get(tool.id) || []}
                  />
                ))}
              </div>
            </section>

            <section className={`${mobileTab === "code" ? "block" : "hidden"} lg:block`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 md:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setLang("py")}
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      lang === "py" ? "bg-blue-500/15 text-blue-200" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setLang("ts")}
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      lang === "ts" ? "bg-blue-500/15 text-blue-200" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    TypeScript
                  </button>
                  <Badge tone={activeTool ? "purple" : "slate"}>{activeTool?.name || "no active tool"}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCode}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                      copied
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-700 bg-slate-900 text-slate-200 hover:border-blue-500/50 hover:text-white"
                    }`}
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy Code"}
                  </button>
                  <button onClick={exportJSON} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:text-white">
                    <FileJson className="h-4 w-4" />
                    Export JSON
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-6">
                <div className="rounded-[24px] border border-slate-800 bg-black/30 p-4 md:p-5">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[12.5px] leading-6 text-slate-300">
                    {code}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
