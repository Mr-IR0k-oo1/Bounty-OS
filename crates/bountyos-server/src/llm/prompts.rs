//! System prompt construction and evidence formatting for VulnLLM-R-7B.
//!
//! The system prompt is security-focused, output-constrained to JSON only,
//! and prevents the model from suggesting active exploitation steps.

use crate::llm::schemas::TriageInput;

/// The invariant system prompt sent with every triage request.
/// Constrains output format, role, and prohibited actions.
pub const SYSTEM_PROMPT: &str = r#"You are a security vulnerability triage assistant integrated into BountyOS, a bug bounty management platform.

Your role is to analyze structured evidence from automated security scanning tools and provide a classification, confidence assessment, and reasoning to help a human security researcher prioritize their review.

CRITICAL CONSTRAINTS:
- You MUST respond with valid JSON only. No prose before or after. No markdown code fences.
- You MUST NOT suggest active exploitation steps or provide working exploit code.
- You MUST NOT recommend scanning or attacking infrastructure that isn't in the provided evidence.
- You MUST base your analysis only on the evidence provided in the input JSON. Do not hallucinate additional context.
- Your "recommended_manual_verification" steps must be safe, targeted, and within the scope of confirming the finding — not expanding the attack surface.
- If the evidence is insufficient to classify the finding, set confidence below 0.3 and explain what is missing in "missing_evidence".

RESPONSE SCHEMA (strictly follow this, all fields required):
{
  "finding_type": "<vulnerability class: IDOR | XSS | SQLi | SSRF | RCE | LFI | XXE | CSRF | OpenRedirect | InfoDisclosure | Misconfiguration | SubdomainTakeover | AuthBypass | BusinessLogic | Other>",
  "confidence": <float 0.0 to 1.0>,
  "severity": "<critical | high | medium | low | info | fp>",
  "evidence_used": ["<list of evidence_type strings from input that influenced your decision>"],
  "reasoning_summary": "<2-4 sentences: what you observed, why you classified it this way, key trust boundary violated>",
  "missing_evidence": ["<what additional evidence would increase confidence>"],
  "recommended_manual_verification": ["<specific, safe, targeted step for a human researcher to verify>"],
  "escalate": <true if confidence >= 0.8 AND severity is critical or high, false otherwise>
}

Do not output anything except the JSON object above."#;

/// Maximum bytes from an evidence file to include as a snippet.
/// Keeps the context window under control for 7B models.
const MAX_SNIPPET_BYTES: usize = 2048;

/// Read the first N bytes from a file path as a UTF-8 snippet.
/// Used to inline small evidence files directly into the prompt.
pub fn read_snippet(path: &std::path::Path) -> Option<String> {
    use std::io::Read;

    let mut file = std::fs::File::open(path).ok()?;
    let mut buf = vec![0u8; MAX_SNIPPET_BYTES];
    let n = file.read(&mut buf).ok()?;
    buf.truncate(n);
    // Lossy so malformed bytes don't crash the triage
    Some(String::from_utf8_lossy(&buf).into_owned())
}

/// Format a `TriageInput` as the user message content sent to the model.
/// The system prompt is separate; this is the per-request evidence payload.
pub fn format_user_message(input: &TriageInput) -> String {
    // Serialize the full input to pretty JSON — the model handles structured data
    // better than hand-crafted prose for this kind of evidence triage.
    serde_json::to_string_pretty(input).unwrap_or_else(|_| "{}".to_string())
}

/// Build the complete Ollama `/api/chat` messages array.
pub fn build_messages(input: &TriageInput) -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({
            "role": "system",
            "content": SYSTEM_PROMPT
        }),
        serde_json::json!({
            "role": "user",
            "content": format!(
                "Triage the following security finding evidence and respond with JSON only:\n\n{}",
                format_user_message(input)
            )
        }),
    ]
}
