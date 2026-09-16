use bountyos_analyzer::cwe;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    fs,
    time::{Duration, Instant},
};

const OLLAMA_URL: &str = "http://localhost:11434/api/chat";
const MODEL: &str = "vulnllm-r-secure";

#[derive(Debug, Deserialize)]
struct Finding {
    vulnerability: Option<String>,
    cwe: Option<String>,
    severity: Option<String>,
    confidence: f32,
    evidence: String,
    impact: Option<String>,
    remediation: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Expected {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    tier: Option<String>,
    file: String,
    vulnerable: bool,
    cwe: Option<String>,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
enum FindingStatus {
    Confirmed,
    Candidate,
    Rejected,
}

fn determine_status(llm_vulnerable: bool, rule_vulnerable: bool) -> FindingStatus {
    match (llm_vulnerable, rule_vulnerable) {
        (true, true) => FindingStatus::Confirmed,
        (true, false) => FindingStatus::Candidate,
        (false, true) => FindingStatus::Confirmed,
        (false, false) => FindingStatus::Rejected,
    }
}

#[derive(Debug, Serialize)]
struct BenchmarkResult {
    id: Option<String>,
    tier: Option<String>,
    category: Option<String>,
    file: String,
    expected_vulnerable: bool,
    predicted_vulnerable: bool,
    detection_correct: bool,
    expected_cwe: Option<String>,
    predicted_cwe: Option<String>,
    cwe_correct: Option<bool>,
    confidence: f32,
    latency_ms: u128,
    json_valid: bool,
    error: Option<String>,
    llm_vulnerable: bool,
    rule_vulnerable: bool,
    status: Option<FindingStatus>,
}

fn normalize_cwe(cwe: Option<&String>) -> Option<String> {
    cwe.map(|value| {
        let cleaned = value.trim().to_uppercase();

        if cleaned.starts_with("CWE-") {
            cleaned
        } else if cleaned.chars().all(|c| c.is_ascii_digit()) {
            format!("CWE-{cleaned}")
        } else {
            cleaned
        }
    })
}

fn is_vulnerable(finding: &Finding) -> bool {
    finding
        .vulnerability
        .as_ref()
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
}

async fn analyze_code(client: &Client, code: &str) -> Result<Finding, Box<dyn std::error::Error>> {
    let schema = json!({
        "type": "object",
        "properties": {
            "vulnerability": {
                "type": ["string", "null"]
            },
            "cwe": {
                "type": ["string", "null"]
            },
            "severity": {
                "type": ["string", "null"]
            },
            "confidence": {
                "type": "number"
            },
            "evidence": {
                "type": "string"
            },
            "impact": {
                "type": ["string", "null"]
            },
            "remediation": {
                "type": ["string", "null"]
            },
            "vulnerable": {
                "type": "boolean"
            }
        },
        "required": [
            "vulnerable",
            "vulnerability",
            "cwe",
            "severity",
            "confidence",
            "evidence",
            "impact",
            "remediation"
        ]
    });

    let payload = json!({
        "model": MODEL,
        "stream": false,
        "think": false,
        "format": schema,
        "messages": [
            {
                "role": "user",
                "content": format!(
                    "Analyze this source code for security vulnerabilities.\n\n{}",
                    code
                )
            }
        ]
    });

    let response = client.post(OLLAMA_URL).json(&payload).send().await?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", response.status()).into());
    }

    let ollama: OllamaResponse = response.json().await?;

    let finding: Finding = serde_json::from_str(&ollama.message.content).map_err(|error| {
        eprintln!("\nMODEL JSON PARSE ERROR:\n{}\n", ollama.message.content);

        format!("JSON parse error: {error}")
    })?;

    Ok(finding)
}

fn load_cases() -> Result<Vec<Expected>, Box<dyn std::error::Error>> {
    let cases_dir = std::path::Path::new("tests/cases");
    if cases_dir.exists() && cases_dir.is_dir() {
        let mut entries: Vec<_> = fs::read_dir(cases_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .collect();
        entries.sort_by_key(|e| e.path());
        let mut cases = Vec::new();
        for entry in entries {
            let content = fs::read_to_string(entry.path())?;
            let case: Expected = serde_json::from_str(&content)?;
            cases.push(case);
        }
        if !cases.is_empty() {
            return Ok(cases);
        }
    }

    let expected_text = fs::read_to_string("tests/expected.json")?;
    let cases: Vec<Expected> = serde_json::from_str(&expected_text)?;
    Ok(cases)
}

async fn run_benchmark() -> Result<(), Box<dyn std::error::Error>> {
    let expected = load_cases()?;

    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()?;

    let mut results = Vec::new();

    println!();
    println!("==============================================");
    println!("        VulnLLM-R Local Benchmark");
    println!("==============================================");
    println!("Model: {}", MODEL);
    println!("Cases: {}", expected.len());
    println!();

    for case in &expected {
        let id_str = case.id.as_deref().unwrap_or("-");
        let tier_str = case.tier.as_deref().unwrap_or("-");
        let cat_str = case.category.as_deref().unwrap_or("-");
        println!(
            "[{}] Analyzing: {} (Tier {}, Category: {})",
            id_str, case.file, tier_str, cat_str
        );

        let path = format!("tests/c/{}", case.file);
        let code = fs::read_to_string(&path)?;

        let start = Instant::now();

        let result = analyze_code(&client, &code).await;

        let latency_ms = start.elapsed().as_millis();

        match result {
            Ok(finding) => {
                let rule_cwe = cwe::classify_cwe(&code);

                let llm_vulnerable = is_vulnerable(&finding);

                let rule_vulnerable = cwe::has_deterministic_vulnerability(&code);

                let predicted_vulnerable = llm_vulnerable || rule_vulnerable;

                let status = determine_status(llm_vulnerable, rule_vulnerable);

                let detection_correct = predicted_vulnerable == case.vulnerable;

                let cwe_correct = if case.vulnerable {
                    let expected_cwe = normalize_cwe(case.cwe.as_ref());

                    let predicted_cwe = rule_cwe.map(str::to_string);

                    Some(expected_cwe == predicted_cwe)
                } else {
                    None
                };

                println!(
                    "  Vulnerable: {} -> {}",
                    case.vulnerable, predicted_vulnerable
                );

                println!("  LLM CWE: {:?}", finding.cwe);

                println!("  Rule CWE: {:?}", rule_cwe);

                println!("  Severity: {:?}", finding.severity);

                println!("  Evidence: {}", finding.evidence);

                println!("  Latency: {} ms", latency_ms);

                println!("  Impact: {:?}", finding.impact);

                println!("  Remediation: {:?}", finding.remediation);

                println!("  LLM detection: {}", llm_vulnerable);

                println!("  Rule detection: {}", rule_vulnerable);

                println!("  Final detection: {}", predicted_vulnerable);

                println!("  Status: {:?}", status);

                println!(
                    "  Detection: {}",
                    if detection_correct { "PASS" } else { "FAIL" }
                );

                if let Some(correct) = cwe_correct {
                    println!("  CWE: {}", if correct { "PASS" } else { "FAIL" });
                }

                println!();

                results.push(BenchmarkResult {
                    id: case.id.clone(),
                    tier: case.tier.clone(),
                    category: case.category.clone(),
                    file: case.file.clone(),
                    expected_vulnerable: case.vulnerable,
                    predicted_vulnerable,
                    detection_correct,
                    expected_cwe: case.cwe.clone(),
                    predicted_cwe: rule_cwe.map(str::to_string),
                    cwe_correct,
                    confidence: finding.confidence,
                    latency_ms,
                    json_valid: true,
                    error: None,
                    llm_vulnerable,
                    rule_vulnerable,
                    status: Some(status),
                });
            }

            Err(error) => {
                let rule_cwe = cwe::classify_cwe(&code);
                let rule_vulnerable = cwe::has_deterministic_vulnerability(&code);
                let llm_vulnerable = false;
                let predicted_vulnerable = rule_vulnerable;
                let status = determine_status(llm_vulnerable, rule_vulnerable);
                let detection_correct = predicted_vulnerable == case.vulnerable;

                let cwe_correct = if case.vulnerable {
                    let expected_cwe = normalize_cwe(case.cwe.as_ref());
                    let predicted_cwe = rule_cwe.map(str::to_string);
                    Some(expected_cwe == predicted_cwe)
                } else {
                    None
                };

                println!("  ERROR: {}", error);
                println!("  LLM detection: {}", llm_vulnerable);
                println!("  Rule detection: {}", rule_vulnerable);
                println!("  Final detection: {}", predicted_vulnerable);
                println!("  Status: {:?}", status);
                println!("  Latency: {} ms", latency_ms);
                println!();

                results.push(BenchmarkResult {
                    id: case.id.clone(),
                    tier: case.tier.clone(),
                    category: case.category.clone(),
                    file: case.file.clone(),
                    expected_vulnerable: case.vulnerable,
                    predicted_vulnerable,
                    detection_correct,
                    expected_cwe: case.cwe.clone(),
                    predicted_cwe: rule_cwe.map(str::to_string),
                    cwe_correct,
                    confidence: 0.0,
                    latency_ms,
                    json_valid: false,
                    error: Some(error.to_string()),
                    llm_vulnerable,
                    rule_vulnerable,
                    status: Some(status),
                });
            }
        }
    }

    print_summary(&results);

    fs::create_dir_all("benchmark-results")?;

    let output = serde_json::to_string_pretty(&results)?;

    fs::write("benchmark-results/latest.json", output)?;

    println!("Raw results saved to benchmark-results/latest.json");

    Ok(())
}

fn print_summary(results: &[BenchmarkResult]) {
    let total = results.len();
    if total == 0 {
        println!("No benchmark results to display.");
        return;
    }

    let tp = results
        .iter()
        .filter(|r| r.expected_vulnerable && r.predicted_vulnerable)
        .count();
    let fp = results
        .iter()
        .filter(|r| !r.expected_vulnerable && r.predicted_vulnerable)
        .count();
    let fn_count = results
        .iter()
        .filter(|r| r.expected_vulnerable && !r.predicted_vulnerable)
        .count();
    let tn = results
        .iter()
        .filter(|r| !r.expected_vulnerable && !r.predicted_vulnerable)
        .count();

    let detection_correct = tp + tn;
    let actual_vulnerable = tp + fn_count;
    let actual_safe = fp + tn;

    let cwe_correct = results
        .iter()
        .filter(|r| r.expected_vulnerable && r.cwe_correct == Some(true))
        .count();

    let json_valid = results.iter().filter(|r| r.json_valid).count();

    let detection_accuracy = detection_correct as f64 / total as f64 * 100.0;

    let precision = if (tp + fp) > 0 {
        tp as f64 / (tp + fp) as f64 * 100.0
    } else {
        0.0
    };

    let recall = if (tp + fn_count) > 0 {
        tp as f64 / (tp + fn_count) as f64 * 100.0
    } else {
        0.0
    };

    let f1_score = if (precision + recall) > 0.0 {
        2.0 * (precision * recall) / (precision + recall)
    } else {
        0.0
    };

    let fpr = if actual_safe > 0 {
        fp as f64 / actual_safe as f64 * 100.0
    } else {
        0.0
    };

    let fnr = if actual_vulnerable > 0 {
        fn_count as f64 / actual_vulnerable as f64 * 100.0
    } else {
        0.0
    };

    let cwe_accuracy = if actual_vulnerable > 0 {
        cwe_correct as f64 / actual_vulnerable as f64 * 100.0
    } else {
        0.0
    };

    let json_rate = json_valid as f64 / total as f64 * 100.0;

    let total_latency: u128 = results.iter().map(|r| r.latency_ms).sum();
    let avg_latency = total_latency as f64 / total as f64;

    let mut sorted_latencies: Vec<u128> = results.iter().map(|r| r.latency_ms).collect();
    sorted_latencies.sort_unstable();
    let p50_latency = sorted_latencies[(sorted_latencies.len() as f64 * 0.50).floor() as usize];
    let p95_index =
        ((sorted_latencies.len() as f64 * 0.95).floor() as usize).min(sorted_latencies.len() - 1);
    let p95_latency = sorted_latencies[p95_index];

    println!("==============================================");
    println!("             CONFUSION MATRIX");
    println!("==============================================");
    println!("                    Actual Vuln    Actual Safe");
    println!("  Predicted Vuln        {:>4}           {:>4}", tp, fp);
    println!(
        "  Predicted Safe        {:>4}           {:>4}",
        fn_count, tn
    );
    println!("==============================================");
    println!("                 METRICS");
    println!("==============================================");
    println!("  Detection accuracy : {:.1}%", detection_accuracy);
    println!("  Precision          : {:.1}%", precision);
    println!("  Recall             : {:.1}%", recall);
    println!("  F1 Score           : {:.1}%", f1_score);
    println!("  False positive rate: {:.1}%", fpr);
    println!("  False negative rate: {:.1}%", fnr);
    println!("  CWE accuracy       : {:.1}%", cwe_accuracy);
    println!("  Valid JSON rate    : {:.1}%", json_rate);
    println!("----------------------------------------------");
    println!("  Average latency    : {:.0} ms", avg_latency);
    println!("  P50 latency        : {} ms", p50_latency);
    println!("  P95 latency        : {} ms", p95_latency);
    println!("  Total cases        : {}", total);

    // Finding Status Breakdown
    let confirmed_count = results
        .iter()
        .filter(|r| r.status == Some(FindingStatus::Confirmed))
        .count();
    let candidate_count = results
        .iter()
        .filter(|r| r.status == Some(FindingStatus::Candidate))
        .count();
    let rejected_count = results
        .iter()
        .filter(|r| r.status == Some(FindingStatus::Rejected))
        .count();
    println!("----------------------------------------------");
    println!("  Status Breakdown:");
    println!("    Confirmed : {}", confirmed_count);
    println!("    Candidate : {}", candidate_count);
    println!("    Rejected  : {}", rejected_count);

    // Tier Breakdown with independent numbers
    let mut tiers: Vec<String> = results.iter().filter_map(|r| r.tier.clone()).collect();
    tiers.sort();
    tiers.dedup();
    if !tiers.is_empty() {
        println!("----------------------------------------------");
        println!("  Tier Breakdown (Independent Signals):");
        for t in &tiers {
            let tier_cases: Vec<&BenchmarkResult> = results
                .iter()
                .filter(|r| r.tier.as_deref() == Some(t.as_str()))
                .collect();
            let tier_total = tier_cases.len();
            let llm_count = tier_cases.iter().filter(|r| r.llm_vulnerable).count();
            let rule_count = tier_cases.iter().filter(|r| r.rule_vulnerable).count();
            let final_count = tier_cases.iter().filter(|r| r.predicted_vulnerable).count();
            let correct_count = tier_cases.iter().filter(|r| r.detection_correct).count();

            println!("    Tier {}:", t);
            println!("      LLM detection   : {}/{}", llm_count, tier_total);
            println!("      Rules detection : {}/{}", rule_count, tier_total);
            println!("      Final detection : {}/{}", final_count, tier_total);
            println!(
                "      Accuracy        : {}/{} ({:.1}%)",
                correct_count,
                tier_total,
                correct_count as f64 / tier_total as f64 * 100.0
            );
        }
    }
    println!("==============================================");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if let Err(error) = run_benchmark().await {
        eprintln!("Benchmark failed: {}", error);
        std::process::exit(1);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_cases_integrity() {
        let cases = load_cases().expect("Failed to load cases");
        assert_eq!(cases.len(), 16, "Expected 16 test cases");

        for case in &cases {
            let path = format!("tests/c/{}", case.file);
            assert!(
                std::path::Path::new(&path).exists(),
                "Case file {} does not exist at {}",
                case.file,
                path
            );
        }
    }

    #[test]
    fn test_determine_status() {
        assert_eq!(determine_status(true, true), FindingStatus::Confirmed);
        assert_eq!(determine_status(true, false), FindingStatus::Candidate);
        assert_eq!(determine_status(false, true), FindingStatus::Confirmed);
        assert_eq!(determine_status(false, false), FindingStatus::Rejected);
    }

    #[test]
    fn test_uaf_fix_safe_memory() {
        let safe_code = fs::read_to_string("tests/c/safe_memory.c").unwrap();
        assert_eq!(cwe::classify_cwe(&safe_code), None);

        let uaf_code = fs::read_to_string("tests/c/use_after_free.c").unwrap();
        assert_eq!(cwe::classify_cwe(&uaf_code), Some("CWE-416"));
    }
}
