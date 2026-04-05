/**
 * Voice orchestration types for AIOS.
 */

export type VoiceProvider = "whisper" | "openai-whisper" | "deepgram" | "mock";
export type TTSProvider = "openai-tts" | "coqui" | "elevenlabs" | "mock";

// ---------------------------------------------------------------------------
// Transcription (STT)
// ---------------------------------------------------------------------------

export interface TranscriptionRequest {
  /** Raw audio data as a Buffer or base64-encoded string */
  audio: Buffer | string;
  /** MIME type of the audio data */
  mimeType?: string;
  /** BCP-47 language code (default: "en") */
  language?: string;
  provider?: VoiceProvider;
  metadata?: Record<string, unknown>;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence?: number;
  segments?: TranscriptionSegment[];
  durationMs?: number;
  provider: VoiceProvider;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Synthesis (TTS)
// ---------------------------------------------------------------------------

export interface SynthesisRequest {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  provider?: TTSProvider;
  outputFormat?: "mp3" | "wav" | "ogg" | "pcm";
  metadata?: Record<string, unknown>;
}

export interface SynthesisResult {
  audio: Buffer;
  mimeType: string;
  durationMs?: number;
  provider: TTSProvider;
}

// ---------------------------------------------------------------------------
// Voice session
// ---------------------------------------------------------------------------

export type VoiceSessionStatus = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceSession {
  id: string;
  agentId?: string;
  sessionId?: string;
  status: VoiceSessionStatus;
  language: string;
  transcripts: TranscriptionResult[];
  createdAt: Date;
  updatedAt: Date;
}
