/**
 * Tests for @aios/voice VoiceOrchestrator
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VoiceOrchestrator, MockTranscriber, MockSynthesizer } from "./orchestrator.js";

describe("VoiceOrchestrator", () => {
  const makeOrchestrator = () =>
    new VoiceOrchestrator({
      transcriber: new MockTranscriber(),
      synthesizer: new MockSynthesizer(),
    });

  it("should create a session", () => {
    const o = makeOrchestrator();
    const s = o.createSession({ language: "fr" });
    assert.equal(s.language, "fr");
    assert.equal(s.status, "idle");
    assert.ok(s.id.startsWith("vs_"));
  });

  it("should retrieve session by id", () => {
    const o = makeOrchestrator();
    const s = o.createSession();
    assert.deepStrictEqual(o.getSession(s.id), s);
  });

  it("should close a session", () => {
    const o = makeOrchestrator();
    const s = o.createSession();
    assert.ok(o.closeSession(s.id));
    assert.equal(o.getSession(s.id), undefined);
  });

  it("should return false closing nonexistent session", () => {
    const o = makeOrchestrator();
    assert.equal(o.closeSession("nonexistent"), false);
  });

  it("should transcribe audio", async () => {
    const o = makeOrchestrator();
    const s = o.createSession();
    const result = await o.transcribe(s.id, "mock-audio");
    assert.equal(result.text, "[mock transcription]");
    assert.equal(result.provider, "mock");

    // Should be stored in session transcripts
    const updated = o.getSession(s.id);
    assert.equal(updated?.transcripts.length, 1);
  });

  it("should synthesize speech", async () => {
    const o = makeOrchestrator();
    const s = o.createSession();
    const result = await o.synthesize(s.id, "Hello, world!");
    assert.equal(result.provider, "mock");
    assert.ok(result.audio instanceof Buffer);
    assert.equal(result.mimeType, "audio/wav");
  });

  it("MockTranscriber should return mock transcription", async () => {
    const t = new MockTranscriber();
    const result = await t.transcribe({ audio: Buffer.from("test"), language: "en" });
    assert.equal(result.text, "[mock transcription]");
  });

  it("MockSynthesizer should return a WAV buffer", async () => {
    const s = new MockSynthesizer();
    const result = await s.synthesize({ text: "Hello" });
    assert.equal(result.mimeType, "audio/wav");
    assert.ok(result.audio.length > 0);
  });
});
