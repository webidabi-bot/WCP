/**
 * Health and readiness check endpoints.
 */

import { Router } from "../router.js";
import { registry } from "@aios/prometheus";

export function registerHealthRoutes(router: Router): void {
  router.get("/health", (ctx) => {
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        status: "ok",
        service: "phoenix",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
      })
    );
  });

  router.get("/ready", (ctx) => {
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ ready: true }));
  });

  router.get("/metrics", (ctx) => {
    const body = registry.render();
    ctx.res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4",
      "Content-Length": Buffer.byteLength(body),
    });
    ctx.res.end(body);
  });
}
