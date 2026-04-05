/**
 * Tests for @aios/prometheus metrics
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Counter, Gauge, Histogram, MetricsRegistry } from "./metrics.js";

describe("Counter", () => {
  it("should start at 0", () => {
    const c = new Counter("test_counter", "A test counter");
    assert.equal(c.get(), 0);
  });

  it("should increment", () => {
    const c = new Counter("test_inc", "A test counter");
    c.inc();
    c.inc();
    assert.equal(c.get(), 2);
  });

  it("should support labels", () => {
    const c = new Counter("labeled", "Labeled counter", ["method"]);
    c.inc({ method: "GET" }, 3);
    c.inc({ method: "POST" }, 2);
    assert.equal(c.get({ method: "GET" }), 3);
    assert.equal(c.get({ method: "POST" }), 2);
  });

  it("should render Prometheus text format", () => {
    const c = new Counter("my_counter", "My counter help");
    c.inc({}, 5);
    const rendered = c.render();
    assert.ok(rendered.includes("# HELP my_counter"));
    assert.ok(rendered.includes("# TYPE my_counter counter"));
    assert.ok(rendered.includes("my_counter 5"));
  });
});

describe("Gauge", () => {
  it("should set value", () => {
    const g = new Gauge("test_gauge", "A gauge");
    g.set({}, 42);
    assert.equal(g.get(), 42);
  });

  it("should inc and dec", () => {
    const g = new Gauge("test_gauge2", "A gauge");
    g.inc({}, 10);
    g.dec({}, 3);
    assert.equal(g.get(), 7);
  });
});

describe("Histogram", () => {
  it("should observe values", () => {
    const h = new Histogram("req_duration", "Request duration", [10, 50, 100]);
    h.observe({}, 5);
    h.observe({}, 15);
    h.observe({}, 75);

    const rendered = h.render();
    assert.ok(rendered.includes("req_duration_count 3"));
    assert.ok(rendered.includes("req_duration_sum 95"));
    assert.ok(rendered.includes(`req_duration_bucket{le="10"} 1`));
    assert.ok(rendered.includes(`req_duration_bucket{le="50"} 2`));
    assert.ok(rendered.includes(`req_duration_bucket{le="100"} 3`));
    assert.ok(rendered.includes(`req_duration_bucket{le="+Inf"} 3`));
  });
});

describe("MetricsRegistry", () => {
  it("should register metrics without duplicates", () => {
    const reg = new MetricsRegistry();
    const c1 = reg.counter("test", "help");
    const c2 = reg.counter("test", "help");
    assert.strictEqual(c1, c2);
  });

  it("render should include all registered metrics", () => {
    const reg = new MetricsRegistry();
    const c = reg.counter("reqs", "Total requests");
    const g = reg.gauge("workers", "Active workers");

    c.inc({}, 10);
    g.set({}, 4);

    const output = reg.render();
    assert.ok(output.includes("reqs 10"));
    assert.ok(output.includes("workers 4"));
  });
});
