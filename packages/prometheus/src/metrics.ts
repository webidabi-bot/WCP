/**
 * Prometheus metrics registry.
 *
 * Implements a lightweight Prometheus text format metrics exposition without
 * requiring external dependencies. Supports:
 *  - Counter
 *  - Gauge
 *  - Histogram
 *
 * Exposes metrics at /metrics in the standard Prometheus text format 0.0.4.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Labels = Record<string, string>;

interface MetricEntry {
  type: "counter" | "gauge" | "histogram";
  help: string;
  name: string;
  unit?: string;
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

export class Counter {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  inc(labels: Labels = {}, amount = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  get(labels: Labels = {}): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values.entries()) {
      const labelStr = key ? `{${key}}` : "";
      lines.push(`${this.name}${labelStr} ${value}`);
    }
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

export class Gauge {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  set(labels: Labels = {}, value: number): void {
    this.values.set(labelsKey(labels), value);
  }

  inc(labels: Labels = {}, amount = 1): void {
    const key = labelsKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  dec(labels: Labels = {}, amount = 1): void {
    this.inc(labels, -amount);
  }

  get(labels: Labels = {}): number {
    return this.values.get(labelsKey(labels)) ?? 0;
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [key, value] of this.values.entries()) {
      const labelStr = key ? `{${key}}` : "";
      lines.push(`${this.name}${labelStr} ${value}`);
    }
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

const DEFAULT_BUCKETS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

export class Histogram {
  private bucketCounts = new Map<string, Map<number, number>>();
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly buckets: number[] = DEFAULT_BUCKETS,
    public readonly labelNames: string[] = []
  ) {}

  observe(labels: Labels = {}, value: number): void {
    const key = labelsKey(labels);

    // Update sum and count
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);

    // Update bucket counts
    let bucketMap = this.bucketCounts.get(key);
    if (!bucketMap) {
      bucketMap = new Map<number, number>();
      this.bucketCounts.set(key, bucketMap);
    }
    for (const b of this.buckets) {
      if (value <= b) {
        bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
      }
    }
  }

  render(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    const allKeys = new Set([
      ...this.sums.keys(),
      ...this.counts.keys(),
      ...this.bucketCounts.keys(),
    ]);

    for (const key of allKeys) {
      const labelBase = key ? `,${key}` : "";
      const bucketMap = this.bucketCounts.get(key) ?? new Map();

      // Bucket counts (observe() already stores cumulative values per bucket)
      for (const b of this.buckets) {
        const count = bucketMap.get(b) ?? 0;
        lines.push(
          `${this.name}_bucket{le="${b}"${labelBase}} ${count}`
        );
      }
      const total = this.counts.get(key) ?? 0;
      lines.push(`${this.name}_bucket{le="+Inf"${labelBase}} ${total}`);
      lines.push(`${this.name}_sum${key ? `{${key}}` : ""} ${this.sums.get(key) ?? 0}`);
      lines.push(`${this.name}_count${key ? `{${key}}` : ""} ${total}`);
    }

    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// MetricsRegistry
// ---------------------------------------------------------------------------

export class MetricsRegistry {
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  private readonly histograms = new Map<string, Histogram>();

  counter(name: string, help: string, labelNames: string[] = []): Counter {
    let c = this.counters.get(name);
    if (!c) {
      c = new Counter(name, help, labelNames);
      this.counters.set(name, c);
    }
    return c;
  }

  gauge(name: string, help: string, labelNames: string[] = []): Gauge {
    let g = this.gauges.get(name);
    if (!g) {
      g = new Gauge(name, help, labelNames);
      this.gauges.set(name, g);
    }
    return g;
  }

  histogram(
    name: string,
    help: string,
    buckets?: number[],
    labelNames: string[] = []
  ): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram(name, help, buckets, labelNames);
      this.histograms.set(name, h);
    }
    return h;
  }

  /**
   * Render all metrics in Prometheus text format 0.0.4.
   */
  render(): string {
    const parts: string[] = [];
    for (const c of this.counters.values()) parts.push(c.render());
    for (const g of this.gauges.values()) parts.push(g.render());
    for (const h of this.histograms.values()) parts.push(h.render());
    return parts.join("\n") + "\n";
  }
}

// ---------------------------------------------------------------------------
// Global default registry
// ---------------------------------------------------------------------------

export const registry = new MetricsRegistry();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelsKey(labels: Labels): string {
  const entries = Object.entries(labels).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return entries.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(",");
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
