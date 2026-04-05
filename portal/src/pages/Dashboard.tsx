import React from "react";
import { useApi } from "../hooks/useApi";
import { health, agents, tools, records } from "../lib/api";

const card: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: 12,
  padding: "20px 24px",
  flex: 1,
  minWidth: 180,
};

const big: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  color: "#38bdf8",
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 4,
};

export const Dashboard: React.FC = () => {
  const { data: healthData } = useApi(() => health.get());
  const { data: agentsData } = useApi(() => agents.list());
  const { data: toolsData } = useApi(() => tools.list());
  const { data: recordsData } = useApi(() => records.list());

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" }}>
        Dashboard
      </h1>
      <p style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>
        {healthData
          ? `Phoenix ${healthData.version} · ${healthData.timestamp}`
          : "Connecting to Phoenix control-plane…"}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
        <div style={card}>
          <div style={big}>{agentsData?.total ?? "—"}</div>
          <div style={label}>Agents</div>
        </div>
        <div style={card}>
          <div style={big}>{toolsData?.tools.length ?? "—"}</div>
          <div style={label}>Tools</div>
        </div>
        <div style={card}>
          <div style={big}>{recordsData?.total ?? "—"}</div>
          <div style={label}>Records</div>
        </div>
        <div style={{ ...card, background: healthData?.status === "ok" ? "#14532d" : "#7f1d1d" }}>
          <div style={{ ...big, color: healthData?.status === "ok" ? "#4ade80" : "#f87171" }}>
            {healthData?.status ?? "…"}
          </div>
          <div style={label}>Control Plane</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", marginBottom: 16 }}>
        Active Agents
      </h2>
      <div style={{ background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#64748b" }}>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Role</th>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(agentsData?.agents ?? []).slice(0, 5).map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid #334155" }}>
                <td style={{ padding: "10px 16px" }}>{a.name}</td>
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
              </tr>
            ))}
            {!agentsData?.agents.length && (
              <tr>
                <td colSpan={3} style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>
                  No agents registered
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
