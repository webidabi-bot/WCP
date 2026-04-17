/**
 * Phoenix application factory.
 *
 * Wires together all route handlers into a single HTTP server.
 */

import { IncomingMessage, ServerResponse, createServer, Server } from "http";
import { Router } from "./router.js";
import { registerHealthRoutes } from "./api/health.js";
import { registerAgentRoutes } from "./api/agents.js";
import { registerInferenceRoutes } from "./api/inference.js";
import { registerToolRoutes } from "./api/tools.js";
import { registerRecordRoutes } from "./api/records.js";
import { registerVoiceRoutes } from "./api/voice.js";
import { ToolRegistry, createRegistry } from "@aios/mcp";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export interface AppOptions {
  port?: number;
  host?: string;
  registry?: ToolRegistry;
}

export class App {
  private readonly router: Router;
  private server: Server | null = null;
  readonly port: number;
  readonly host: string;

  constructor(options: AppOptions = {}) {
    this.port = options.port ?? Number(process.env["PORT"] ?? 3000);
    this.host = options.host ?? process.env["HOST"] ?? "0.0.0.0";

    this.router = new Router();

    registerHealthRoutes(this.router);
    registerAgentRoutes(this.router);
    registerInferenceRoutes(this.router);
    registerToolRoutes(this.router, options.registry ?? createRegistry());
    registerRecordRoutes(this.router);
    registerVoiceRoutes(this.router);
  }

  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    return this.router.dispatch(req, res).catch((err) => {
      console.error("[phoenix] Unhandled error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => void this.handleRequest(req, res));
      this.server.listen(this.port, this.host, () => {
        console.log(
          `[phoenix] AIOS control-plane listening on http://${this.host}:${this.port}`
        );
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) { resolve(); return; }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
        this.server = null;
      });
    });
  }
}

export function createApp(options?: AppOptions): App {
  return new App(options);
}
