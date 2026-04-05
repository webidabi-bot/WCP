import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { records as recordsApi } from "../lib/api";

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

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#1e3a5f", color: "#7dd3fc" },
  active: { bg: "#14532d", color: "#4ade80" },
  closed: { bg: "#374151", color: "#9ca3af" },
  error: { bg: "#7f1d1d", color: "#f87171" },
};

export const Records: React.FC = () => {
  const { data, loading, error, refetch } = useApi(() => recordsApi.list());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", record_type: "report", status: "draft" });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await recordsApi.create({
        title: form.title.trim(),
        record_type: form.record_type,
        status: form.status,
      });
      setShowCreate(false);
      setForm({ title: "", record_type: "report", status: "draft" });
      refetch();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete record "${title}"?`)) return;
    await recordsApi.delete(id);
    refetch();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>Records</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            Structured records and workflow forms.
          </p>
        </div>
        <button style={btn} onClick={() => setShowCreate(true)}>+ New Record</button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{ background: "#1e293b", borderRadius: 10, padding: 24, marginBottom: 24 }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 16px", color: "#f1f5f9" }}>Create Record</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              style={input}
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <select
              style={input}
              value={form.record_type}
              onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value }))}
            >
              {["report", "incident", "form", "ticket", "artifact"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              style={input}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {["draft", "active", "closed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
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

      <div style={{ display: "grid", gap: 10 }}>
        {(data?.records ?? []).map((r) => {
          const statusStyle = STATUS_COLORS[r.status] ?? STATUS_COLORS["draft"]!;
          return (
            <div
              key={r.id}
              style={{
                background: "#1e293b",
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontWeight: 500, color: "#f1f5f9" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {r.record_type} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                }}>
                  {r.status}
                </span>
                <button
                  style={{ ...btn, background: "#7f1d1d", fontSize: 11, padding: "4px 10px" }}
                  onClick={() => handleDelete(r.id, r.title)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {!loading && !data?.records.length && (
          <div style={{ padding: 24, color: "#64748b", textAlign: "center", background: "#1e293b", borderRadius: 8 }}>
            No records found. Create your first record.
          </div>
        )}
      </div>
    </div>
  );
};
