import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { tools as toolsApi } from "../lib/api";

const btn: React.CSSProperties = {
  padding: "8px 16px",
  background: "#0284c7",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

export const Tools: React.FC = () => {
  const { data, loading, error } = useApi(() => toolsApi.list());
  const [selected, setSelected] = useState<string | null>(null);
  const [inputStr, setInputStr] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [invokeError, setInvokeError] = useState<string | null>(null);

  const handleInvoke = async (name: string) => {
    setInvoking(true);
    setResult(null);
    setInvokeError(null);
    try {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(inputStr) as Record<string, unknown>; } catch { /* empty */ }
      const res = await toolsApi.invoke(name, input);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setInvokeError(err instanceof Error ? err.message : String(err));
    } finally {
      setInvoking(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" }}>MCP Tools</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        Registered tools available for agent invocation.
      </p>

      {loading && <p style={{ color: "#64748b" }}>Loading…</p>}
      {error && <p style={{ color: "#f87171" }}>Error: {error}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {(data?.tools ?? []).map((tool) => (
          <div
            key={tool.name}
            style={{
              background: "#1e293b",
              borderRadius: 8,
              padding: 20,
              border: selected === tool.name ? "1px solid #0284c7" : "1px solid transparent",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ fontWeight: 600, color: "#38bdf8", fontFamily: "monospace" }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                  {tool.description}
                </div>
              </div>
              <button
                style={{ ...btn, fontSize: 12, padding: "6px 12px" }}
                onClick={() => setSelected(selected === tool.name ? null : tool.name)}
              >
                {selected === tool.name ? "Close" : "Invoke"}
              </button>
            </div>

            {selected === tool.name && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  Input (JSON)
                </div>
                <textarea
                  style={{
                    width: "100%",
                    minHeight: 80,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    color: "#e2e8f0",
                    padding: 8,
                    fontFamily: "monospace",
                    fontSize: 12,
                    resize: "vertical",
                  }}
                  value={inputStr}
                  onChange={(e) => setInputStr(e.target.value)}
                />
                <button
                  style={{ ...btn, marginTop: 8 }}
                  onClick={() => handleInvoke(tool.name)}
                  disabled={invoking}
                >
                  {invoking ? "Running…" : "Run"}
                </button>

                {invokeError && (
                  <pre style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>
                    {invokeError}
                  </pre>
                )}
                {result && (
                  <pre style={{
                    background: "#0f172a",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#e2e8f0",
                    overflow: "auto",
                    marginTop: 8,
                  }}>
                    {result}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
