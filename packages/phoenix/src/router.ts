/**
 * Phoenix HTTP router.
 *
 * Pure Node.js HTTP server — no external framework dependencies.
 * Routes are registered with method + path pattern matching.
 */

import {
  IncomingMessage,
  ServerResponse,
  createServer,
  Server,
} from "http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface RouteContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  req: IncomingMessage;
  res: ServerResponse;
}

export type RouteHandler = (ctx: RouteContext) => Promise<void> | void;

export interface Route {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function json(
  res: ServerResponse,
  data: unknown,
  status = 200
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

export function notFound(res: ServerResponse): void {
  json(res, { error: "Not Found" }, 404);
}

export function methodNotAllowed(res: ServerResponse): void {
  json(res, { error: "Method Not Allowed" }, 405);
}

export function internalError(res: ServerResponse, message = "Internal Server Error"): void {
  json(res, { error: message }, 500);
}

// ---------------------------------------------------------------------------
// Body parser
// ---------------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Path pattern compiler
// ---------------------------------------------------------------------------

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const escaped = path
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    });
  return { pattern: new RegExp(`^${escaped}$`), paramNames };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class Router {
  private readonly routes: Route[] = [];
  private readonly middleware: Array<(ctx: RouteContext, next: () => Promise<void>) => Promise<void>> = [];

  use(
    mw: (ctx: RouteContext, next: () => Promise<void>) => Promise<void>
  ): void {
    this.middleware.push(mw);
  }

  private add(method: HttpMethod, path: string, handler: RouteHandler): void {
    const { pattern, paramNames } = compilePath(path);
    this.routes.push({ method, pattern, paramNames, handler });
  }

  get(path: string, handler: RouteHandler): void { this.add("GET", path, handler); }
  post(path: string, handler: RouteHandler): void { this.add("POST", path, handler); }
  put(path: string, handler: RouteHandler): void { this.add("PUT", path, handler); }
  patch(path: string, handler: RouteHandler): void { this.add("PATCH", path, handler); }
  delete(path: string, handler: RouteHandler): void { this.add("DELETE", path, handler); }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    const method = (req.method?.toUpperCase() ?? "GET") as HttpMethod;

    // CORS pre-flight
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    // Common headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Find matching route
    const route = this.routes.find(
      (r) =>
        (r.method === method || r.method === "GET" && method === "HEAD") &&
        r.pattern.test(pathname)
    );

    if (!route) {
      notFound(res);
      return;
    }

    // Extract path params
    const match = pathname.match(route.pattern)!;
    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1] ?? "");
    });

    // Extract query params
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Parse body
    const body = await readBody(req);

    const ctx: RouteContext = { params, query, body, req, res };

    // Run middleware chain
    const mw = [...this.middleware];
    let idx = 0;
    const next = async (): Promise<void> => {
      const fn = mw[idx++];
      if (fn) {
        await fn(ctx, next);
      } else {
        await route.handler(ctx);
      }
    };

    await next();
  }
}
