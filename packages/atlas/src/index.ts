/**
 * @aios/atlas
 *
 * Inference engine for AI-Stack / AIOS.
 *
 * Provides an OpenAI-compatible abstraction over multiple inference backends:
 *  - Ollama (local)
 *  - OpenAI
 *  - Any OpenAI-compatible HTTP endpoint
 *
 * Exports:
 *  - Type definitions
 *  - InferenceProvider (single provider client)
 *  - InferenceRouter (multi-provider router with model routing)
 *  - createDefaultRouter() factory
 */

export * from "./types.js";
export { InferenceProvider } from "./provider.js";
export { InferenceRouter, createDefaultRouter } from "./router.js";
