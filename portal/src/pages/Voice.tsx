import React, { useState } from "react";

const btn: React.CSSProperties = {
  padding: "10px 20px",
  background: "#0284c7",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

interface VoiceSession {
  id: string;
  status: string;
  language: string;
}

export const Voice: React.FC = () => {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [synthText, setSynthText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "en" }),
      });
      const data = await res.json() as { session: VoiceSession };
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const closeSession = async () => {
    if (!session) return;
    await fetch(`/api/voice/sessions/${session.id}`, { method: "DELETE" });
    setSession(null);
    setTranscript(null);
  };

  const testTranscribe = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const fakeAudio = btoa("mock-audio-data");
      const res = await fetch(`/api/voice/sessions/${session.id}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: fakeAudio }),
      });
      const data = await res.json() as { result: { text: string } };
      setTranscript(data.result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" }}>Voice</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        Voice orchestration — speech-to-text and text-to-speech pipeline.
      </p>

      {error && <p style={{ color: "#f87171", marginBottom: 16 }}>Error: {error}</p>}

      <div style={{ background: "#1e293b", borderRadius: 10, padding: 24, maxWidth: 600 }}>
        {!session ? (
          <div>
            <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: 13 }}>
              Create a voice session to start transcribing audio.
            </p>
            <button style={btn} onClick={createSession} disabled={loading}>
              {loading ? "Creating…" : "Create Voice Session"}
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Session ID</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#38bdf8" }}>{session.id}</div>
              </div>
              <span style={{
                background: session.status === "idle" ? "#14532d" : "#1e3a5f",
                color: session.status === "idle" ? "#4ade80" : "#7dd3fc",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
              }}>
                {session.status}
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
                Test transcription (mock audio):
              </p>
              <button
                style={{ ...btn, marginBottom: 12 }}
                onClick={testTranscribe}
                disabled={loading}
              >
                {loading ? "Processing…" : "Test Transcribe"}
              </button>
              {transcript && (
                <div style={{
                  background: "#0f172a",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#e2e8f0",
                }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Transcript:</div>
                  {transcript}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
                Text-to-speech synthesis:
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    color: "#e2e8f0",
                    fontSize: 13,
                  }}
                  placeholder="Enter text to synthesize…"
                  value={synthText}
                  onChange={(e) => setSynthText(e.target.value)}
                />
                <button
                  style={btn}
                  onClick={async () => {
                    if (!synthText.trim() || !session) return;
                    setLoading(true);
                    try {
                      await fetch(`/api/voice/sessions/${session.id}/synthesize`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: synthText }),
                      });
                      setSynthText("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !synthText.trim()}
                >
                  Synthesize
                </button>
              </div>
            </div>

            <button
              style={{ ...btn, background: "#7f1d1d" }}
              onClick={closeSession}
            >
              Close Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
