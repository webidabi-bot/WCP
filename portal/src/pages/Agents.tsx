import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { agents as agentsApi, Agent } from "../lib/api";

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

const input: React.CSSProperties = {
  padding: "8px 12px",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 13,
  width: "100%",
};

const select: React.CSSProperties = { ...input };

export const Agents: React.FC = () => {
  const { data, loading, error, refetch } = useApi(() => agentsApi.list());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", role: "worker" });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await agentsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        role: form.role as Agent["role"],
      });
      setShowCreate(false);
      setForm({ name: "", description: "", role: "worker" });
      refetch();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await agentsApi.delete(id);
    refetch();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>Agents</h1>
        <button style={btn} onClick={() => setShowCreate(true)}>+ New Agent</button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{ background: "#1e293b", borderRadius: 10, padding: 24, marginBottom: 24 }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 16px", color: "#f1f5f9" }}>Create Agent</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              style={input}
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              style={input}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <select
              style={select}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="worker">worker</option>
              <option value="supervisor">supervisor</option>
              <option value="orchestrator">orchestrator</option>
              <option value="tool">tool</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={btn} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                style={{ ...btn, background: "#475569" }}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && <p style={{ color: "#64748b" }}>Loading…</p>}
      {error && <p style={{ color: "#f87171" }}>Error: {error}</p>}

      <div style={{ background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#64748b" }}>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Role</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Created</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}></th>
            </tr>
          </thead>
          <tbody>
            {(data?.agents ?? []).map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid #334155" }}>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ fontWeight: 500 }}>{a.name}</div>
                  {a.description && (
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{a.description}</div>
                  )}
                </td>
                <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{a.role}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    background: a.status === "running" ? "#166534" : a.status === "error" ? "#7f1d1d" : "#1e3a5f",
                    color: a.status === "running" ? "#4ade80" : a.status === "error" ? "#f87171" : "#7dd3fc",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                  }}>
                    {a.status}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 11 }}>
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    style={{ ...btn, background: "#7f1d1d", fontSize: 11, padding: "4px 10px" }}
                    onClick={() => handleDelete(a.id, a.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !data?.agents.length && (
              <tr>
                <td colSpan={5} style={{ padding: "24px", color: "#64748b", textAlign: "center" }}>
                  No agents registered. Create your first agent to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
