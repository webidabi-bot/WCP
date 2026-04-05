/**
 * Voice orchestration pipeline.
 *
 * Coordinates speech-to-text transcription and text-to-speech synthesis.
 * Designed to be backend-agnostic — providers are pluggable.
 *
 * Out-of-the-box providers:
 *  - MockTranscriber  — deterministic test provider
 *  - OpenAITranscriber — Whisper via OpenAI API
 *  - MockSynthesizer  — silent audio stub
 */

import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import { URL } from "url";
import {
  TranscriptionRequest,
  TranscriptionResult,
  SynthesisRequest,
  SynthesisResult,
  VoiceProvider,
  TTSProvider,
  VoiceSession,
  VoiceSessionStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// Provider interfaces
// ---------------------------------------------------------------------------

export interface Transcriber {
  readonly provider: VoiceProvider;
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface Synthesizer {
  readonly provider: TTSProvider;
  synthesize(req: SynthesisRequest): Promise<SynthesisResult>;
}

// ---------------------------------------------------------------------------
// Mock providers (useful in tests and when no external service is available)
// ---------------------------------------------------------------------------

export class MockTranscriber implements Transcriber {
  readonly provider: VoiceProvider = "mock";

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    return {
      text: "[mock transcription]",
      language: req.language ?? "en",
      confidence: 1.0,
      durationMs: 0,
      provider: "mock",
    };
  }
}

export class MockSynthesizer implements Synthesizer {
  readonly provider: TTSProvider = "mock";

  async synthesize(_req: SynthesisRequest): Promise<SynthesisResult> {
    // Return an empty WAV file (44-byte header, no audio data)
    const wavHeader = Buffer.from(
      "52494646" + // "RIFF"
        "24000000" + // file size - 8
        "57415645" + // "WAVE"
        "666d7420" + // "fmt "
        "10000000" + // chunk size = 16
        "0100" +     // PCM format
        "0100" +     // 1 channel
        "44ac0000" + // 44100 Hz sample rate
        "8858010000" + // byte rate
        "0200" +     // block align
        "1000" +     // bits per sample
        "64617461" + // "data"
        "00000000",  // data size = 0
      "hex"
    );

    return {
      audio: wavHeader,
      mimeType: "audio/wav",
      durationMs: 0,
      provider: "mock",
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI Whisper transcriber
// ---------------------------------------------------------------------------

export class OpenAITranscriber implements Transcriber {
  readonly provider: VoiceProvider = "openai-whisper";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey =
      options?.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
    this.baseUrl =
      options?.baseUrl ??
      process.env["OPENAI_BASE_URL"] ??
      "https://api.openai.com";
    this.model = options?.model ?? "whisper-1";
  }

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key required for OpenAI Whisper transcription");
    }

    const audioBuffer =
      Buffer.isBuffer(req.audio)
        ? req.audio
        : Buffer.from(String(req.audio), "base64");

    // Multipart form-data body
    const boundary = `----AIOSFormBoundary${Date.now()}`;
    const mimeType = req.mimeType ?? "audio/webm";

    const bodyParts: Buffer[] = [
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${this.model}\r\n`
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${req.language ?? "en"}\r\n`
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ];
    const body = Buffer.concat(bodyParts);

    const parsed = new URL(`${this.baseUrl}/v1/audio/transcriptions`);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? httpsRequest : httpRequest;

    const responseText = await new Promise<string>((resolve, reject) => {
      const reqHttp = transport(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname,
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length,
          },
          timeout: 30_000,
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve(data));
          res.on("error", reject);
        }
      );
      reqHttp.on("error", reject);
      reqHttp.write(body);
      reqHttp.end();
    });

    const json = JSON.parse(responseText) as { text?: string };
    return {
      text: json.text ?? "",
      language: req.language ?? "en",
      provider: "openai-whisper",
    };
  }
}

// ---------------------------------------------------------------------------
// Voice Orchestrator
// ---------------------------------------------------------------------------

export class VoiceOrchestrator {
  private transcriber: Transcriber;
  private synthesizer: Synthesizer;
  private sessions = new Map<string, VoiceSession>();

  constructor(options?: {
    transcriber?: Transcriber;
    synthesizer?: Synthesizer;
  }) {
    this.transcriber = options?.transcriber ?? new MockTranscriber();
    this.synthesizer = options?.synthesizer ?? new MockSynthesizer();
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  createSession(options?: {
    agentId?: string;
    sessionId?: string;
    language?: string;
  }): VoiceSession {
    const id = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const session: VoiceSession = {
      id,
      agentId: options?.agentId,
      sessionId: options?.sessionId,
      status: "idle",
      language: options?.language ?? "en",
      transcripts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): VoiceSession | undefined {
    return this.sessions.get(id);
  }

  closeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  private updateStatus(id: string, status: VoiceSessionStatus): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();
    }
  }

  // -------------------------------------------------------------------------
  // Transcription
  // -------------------------------------------------------------------------

  async transcribe(
    sessionId: string,
    audio: Buffer | string,
    options?: { mimeType?: string; language?: string }
  ): Promise<TranscriptionResult> {
    this.updateStatus(sessionId, "processing");

    try {
      const session = this.sessions.get(sessionId);
      const result = await this.transcriber.transcribe({
        audio,
        mimeType: options?.mimeType,
        language: options?.language ?? session?.language ?? "en",
      });

      if (session) {
        session.transcripts.push(result);
        session.updatedAt = new Date();
      }

      this.updateStatus(sessionId, "idle");
      return result;
    } catch (err) {
      this.updateStatus(sessionId, "error");
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Synthesis
  // -------------------------------------------------------------------------

  async synthesize(
    sessionId: string,
    text: string,
    options?: Omit<SynthesisRequest, "text">
  ): Promise<SynthesisResult> {
    this.updateStatus(sessionId, "speaking");

    try {
      const result = await this.synthesizer.synthesize({ text, ...options });
      this.updateStatus(sessionId, "idle");
      return result;
    } catch (err) {
      this.updateStatus(sessionId, "error");
      throw err;
    }
  }
}
