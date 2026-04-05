/**
 * Portal API client.
 *
 * Wraps fetch calls to the Phoenix control-plane API.
 */

const BASE = "";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export const health = {
  get: () => apiFetch<HealthStatus>("/health"),
};

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  role: string;
  status: string;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const agents = {
  list: (params?: { role?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][]
    ).toString();
    return apiFetch<{ agents: Agent[]; total: number }>(
      `/api/agents${qs ? `?${qs}` : ""}`
    );
  },
  get: (id: string) => apiFetch<{ agent: Agent }>(`/api/agents/${id}`),
  create: (data: Partial<Agent> & { name: string }) =>
    apiFetch<{ agent: Agent }>("/api/agents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Agent>) =>
    apiFetch<{ agent: Agent }>(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const tools = {
  list: () => apiFetch<{ tools: ToolDef[] }>("/api/tools"),
  invoke: (name: string, input: Record<string, unknown>, opts?: { agentId?: string; sessionId?: string }) =>
    apiFetch<{ callId: string; content: Array<{ type: string; text?: string }>; isError?: boolean }>(
      "/api/tools/invoke",
      { method: "POST", body: JSON.stringify({ name, input, ...opts }) }
    ),
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface AIOSRecord {
  id: string;
  record_type: string;
  title: string;
  status: string;
  body: Record<string, unknown>;
  agent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const records = {
  list: (params?: { type?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][]
    ).toString();
    return apiFetch<{ records: AIOSRecord[]; total: number }>(
      `/api/records${qs ? `?${qs}` : ""}`
    );
  },
  get: (id: string) => apiFetch<{ record: AIOSRecord }>(`/api/records/${id}`),
  create: (data: { record_type: string; title: string; status?: string; body?: Record<string, unknown> }) =>
    apiFetch<{ record: AIOSRecord }>("/api/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<AIOSRecord>) =>
    apiFetch<{ record: AIOSRecord }>(`/api/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/records/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

export const inference = {
  models: () => apiFetch<{ models: Array<{ provider: string; model: string }> }>("/api/inference/models"),
  chat: (model: string, messages: Array<{ role: string; content: string }>) =>
    apiFetch<{ choices: Array<{ message: { content: string } }>; usage?: { total_tokens: number } }>(
      "/api/inference/chat",
      { method: "POST", body: JSON.stringify({ model, messages }) }
    ),
};
