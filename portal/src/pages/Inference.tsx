import React, { useState, useRef } from "react";
import { inference } from "../lib/api";

const btn: React.CSSProperties = {
  padding: "10px 20px",
  background: "#0284c7",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const Inference: React.FC = () => {
  const [model, setModel] = useState("llama3.2");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await inference.chat(model, [
        ...messages,
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content })));
      const assistantContent = res.choices[0]?.message.content ?? "(no response)";
      setMessages((m) => [...m, { role: "assistant", content: assistantContent }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" }}>Inference</h1>
        <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>
          Chat directly with Atlas inference engine.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <label style={{ fontSize: 13, color: "#94a3b8" }}>Model:</label>
        <input
          style={{
            padding: "6px 10px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#e2e8f0",
            fontSize: 13,
            width: 200,
          }}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <button
          style={{ ...btn, background: "#475569", padding: "6px 12px", fontSize: 12 }}
          onClick={() => setMessages([])}
        >
          Clear
        </button>
      </div>

      <div style={{
        flex: 1,
        background: "#1e293b",
        borderRadius: 8,
        padding: 16,
        overflow: "auto",
        minHeight: 300,
        maxHeight: 500,
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ color: "#475569", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            Send a message to start chatting with the inference engine.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "75%",
          }}>
            <div style={{
              background: m.role === "user" ? "#0284c7" : "#334155",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2, textAlign: m.role === "user" ? "right" : "left" }}>
              {m.role}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#64748b", fontSize: 13 }}>
            Thinking…
          </div>
        )}
        {error && (
          <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#e2e8f0",
            fontSize: 14,
          }}
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          disabled={loading}
        />
        <button style={btn} onClick={() => void send()} disabled={loading}>
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
};
