//! LLM subsystem — VulnLLM-R-7B triage integration.
//!
//! This module provides:
//!   - `schemas`  — TriageInput / TriageOutput serde types
//!   - `prompts`  — system prompt + evidence formatting
//!   - `client`   — Ollama HTTP client
//!   - `triage`   — orchestrator (fetch → format → infer → store)

pub mod client;
pub mod prompts;
pub mod schemas;
pub mod triage;

pub use client::OllamaClient;
pub use schemas::{TriageInput, TriageOutput};
