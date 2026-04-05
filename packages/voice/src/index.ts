/**
 * @aios/voice
 *
 * Voice orchestration pipeline for AI-Stack / AIOS.
 *
 * Provides:
 *  - Pluggable STT (Transcriber) and TTS (Synthesizer) interfaces
 *  - MockTranscriber / MockSynthesizer for testing
 *  - OpenAITranscriber (Whisper API)
 *  - VoiceOrchestrator — session-based voice pipeline coordination
 */

export * from "./types.js";
export {
  MockTranscriber,
  MockSynthesizer,
  OpenAITranscriber,
  VoiceOrchestrator,
} from "./orchestrator.js";
export type { Transcriber, Synthesizer } from "./orchestrator.js";
