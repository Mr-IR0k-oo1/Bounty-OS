use crate::errors::BountyError;
use crate::ids::{JobId, ProgramId};
use crate::scope::ScopePolicy;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolIdentifier {
    Subfinder,
    Dnsx,
    Httpx,
    Naabu,
    Nmap,
    Katana,
    Gau,
    Waybackurls,
    Ffuf,
    Nuclei,
}

impl fmt::Display for ToolIdentifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ToolIdentifier::Subfinder => write!(f, "subfinder"),
            ToolIdentifier::Dnsx => write!(f, "dnsx"),
            ToolIdentifier::Httpx => write!(f, "httpx"),
            ToolIdentifier::Naabu => write!(f, "naabu"),
            ToolIdentifier::Nmap => write!(f, "nmap"),
            ToolIdentifier::Katana => write!(f, "katana"),
            ToolIdentifier::Gau => write!(f, "gau"),
            ToolIdentifier::Waybackurls => write!(f, "waybackurls"),
            ToolIdentifier::Ffuf => write!(f, "ffuf"),
            ToolIdentifier::Nuclei => write!(f, "nuclei"),
        }
    }
}

impl FromStr for ToolIdentifier {
    type Err = BountyError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().trim() {
            "subfinder" => Ok(ToolIdentifier::Subfinder),
            "dnsx" => Ok(ToolIdentifier::Dnsx),
            "httpx" => Ok(ToolIdentifier::Httpx),
            "naabu" => Ok(ToolIdentifier::Naabu),
            "nmap" => Ok(ToolIdentifier::Nmap),
            "katana" => Ok(ToolIdentifier::Katana),
            "gau" => Ok(ToolIdentifier::Gau),
            "waybackurls" => Ok(ToolIdentifier::Waybackurls),
            "ffuf" => Ok(ToolIdentifier::Ffuf),
            "nuclei" => Ok(ToolIdentifier::Nuclei),
            _ => Err(BountyError::InvalidTarget(format!("Unknown tool: {s}"))),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ToolOptions {
    pub threads: Option<u32>,
    pub rate_limit: Option<u32>,
    pub ports: Option<String>,
    pub wordlist: Option<String>,
    pub templates: Option<Vec<String>>,
    pub custom_args: Vec<String>,
}

impl ToolOptions {
    pub fn validate(&self) -> Result<(), BountyError> {
        for arg in &self.custom_args {
            if arg.contains(';')
                || arg.contains('|')
                || arg.contains('&')
                || arg.contains('$')
                || arg.contains('`')
            {
                return Err(BountyError::PolicyRejected(format!(
                    "Illegal shell metacharacter in tool option argument: '{arg}'"
                )));
            }
        }
        if let Some(ref ports) = self.ports {
            if ports
                .chars()
                .any(|c| !c.is_ascii_digit() && c != ',' && c != '-')
            {
                return Err(BountyError::PolicyRejected(format!(
                    "Invalid ports option format: '{ports}'"
                )));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolExecutionRequest {
    pub tool: ToolIdentifier,
    pub target: String,
    pub program_id: ProgramId,
    pub job_id: JobId,
    pub scope_policy: ScopePolicy,
    pub options: ToolOptions,
    pub timeout_seconds: u64,
}

impl ToolExecutionRequest {
    pub fn new(
        tool: ToolIdentifier,
        target: impl Into<String>,
        program_id: ProgramId,
        scope_policy: ScopePolicy,
    ) -> Result<Self, BountyError> {
        let tgt = target.into();
        let trimmed = tgt.trim();
        if trimmed.is_empty() {
            return Err(BountyError::InvalidTarget("Target cannot be empty".into()));
        }
        if trimmed.contains(' ') || trimmed.contains('\n') || trimmed.contains('\r') {
            return Err(BountyError::InvalidTarget(format!(
                "Target contains invalid whitespace: '{tgt}'"
            )));
        }

        Ok(Self {
            tool,
            target: tgt,
            program_id,
            job_id: JobId::new(),
            scope_policy,
            options: ToolOptions::default(),
            timeout_seconds: 60,
        })
    }

    /// Construct typed arguments without shell invocation
    pub fn build_arguments(&self) -> Result<Vec<String>, BountyError> {
        self.options.validate()?;

        let mut args = Vec::new();

        match self.tool {
            ToolIdentifier::Subfinder => {
                args.push("-d".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                args.push("-all".to_string());
            }
            ToolIdentifier::Dnsx => {
                args.push("-d".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                args.push("-a".to_string());
                args.push("-resp".to_string());
            }
            ToolIdentifier::Httpx => {
                args.push("-u".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                args.push("-status-code".to_string());
                args.push("-title".to_string());
                args.push("-tech-detect".to_string());
            }
            ToolIdentifier::Naabu => {
                args.push("-host".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                if let Some(ref p) = self.options.ports {
                    args.push("-p".to_string());
                    args.push(p.clone());
                } else {
                    args.push("-top-ports".to_string());
                    args.push("1000".to_string());
                }
            }
            ToolIdentifier::Nmap => {
                args.push("-sT".to_string());
                args.push("-T4".to_string());
                if let Some(ref p) = self.options.ports {
                    args.push("-p".to_string());
                    args.push(p.clone());
                }
                args.push(self.target.clone());
            }
            ToolIdentifier::Katana => {
                args.push("-u".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                args.push("-jc".to_string());
            }
            ToolIdentifier::Gau => {
                args.push(self.target.clone());
                args.push("--subs".to_string());
            }
            ToolIdentifier::Waybackurls => {
                args.push(self.target.clone());
            }
            ToolIdentifier::Ffuf => {
                let url_target = if self.target.contains("FUZZ") {
                    self.target.clone()
                } else if self.target.ends_with('/') {
                    format!("{}FUZZ", self.target)
                } else {
                    format!("{}/FUZZ", self.target)
                };
                args.push("-u".to_string());
                args.push(url_target);
                args.push("-w".to_string());
                args.push(
                    self.options
                        .wordlist
                        .clone()
                        .unwrap_or_else(|| "common.txt".to_string()),
                );
                args.push("-silent".to_string());
            }
            ToolIdentifier::Nuclei => {
                args.push("-u".to_string());
                args.push(self.target.clone());
                args.push("-silent".to_string());
                args.push("-severity".to_string());
                args.push("low,medium,high,critical".to_string());
            }
        }

        // Apply rate limits or thread options
        if let Some(threads) = self.options.threads {
            match self.tool {
                ToolIdentifier::Subfinder
                | ToolIdentifier::Httpx
                | ToolIdentifier::Naabu
                | ToolIdentifier::Nuclei => {
                    args.push("-t".to_string());
                    args.push(threads.to_string());
                }
                _ => {}
            }
        }

        if let Some(rl) = self.options.rate_limit {
            match self.tool {
                ToolIdentifier::Httpx | ToolIdentifier::Naabu | ToolIdentifier::Nuclei => {
                    args.push("-rl".to_string());
                    args.push(rl.to_string());
                }
                _ => {}
            }
        }

        for extra in &self.options.custom_args {
            args.push(extra.clone());
        }

        Ok(args)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolExecutionResult {
    pub tool: ToolIdentifier,
    pub target: String,
    pub job_id: JobId,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub success: bool,
}

pub struct ToolRunner;

impl ToolRunner {
    /// Full pre-execution validation pipeline:
    /// 1. Validate request
    /// 2. Validate scope
    /// 3. Validate policy
    /// 4. Construct arguments
    pub fn prepare_execution(request: &ToolExecutionRequest) -> Result<Vec<String>, BountyError> {
        // Step 1: Validate request
        if request.target.trim().is_empty() {
            return Err(BountyError::InvalidTarget("Target cannot be empty".into()));
        }

        // Step 2 & 3: Validate scope and policy
        request.scope_policy.enforce(&request.target)?;

        // Step 4: Construct arguments
        request.build_arguments()
    }

    /// Execute a tool using a resolved binary path.
    /// Never fakes execution. Returns error if binary is missing.
    pub async fn execute_tool(
        request: &ToolExecutionRequest,
        binary_path: Option<&Path>,
    ) -> Result<ToolExecutionResult, BountyError> {
        let args = Self::prepare_execution(request)?;

        let bin = binary_path.ok_or_else(|| {
            BountyError::NotFound(format!(
                "Executable binary for tool '{}' not found on system",
                request.tool
            ))
        })?;

        if !bin.exists() {
            return Err(BountyError::NotFound(format!(
                "Executable '{}' does not exist",
                bin.display()
            )));
        }

        let started_at = Utc::now();
        let start_instant = std::time::Instant::now();

        let mut cmd = tokio::process::Command::new(bin);
        cmd.args(&args);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let timeout_dur = Duration::from_secs(request.timeout_seconds);
        let output = tokio::time::timeout(timeout_dur, cmd.output())
            .await
            .map_err(|_| {
                BountyError::ToolExecutionFailed(format!(
                    "Tool '{}' timed out after {}s",
                    request.tool, request.timeout_seconds
                ))
            })?
            .map_err(|e| {
                BountyError::ToolExecutionFailed(format!(
                    "Failed to execute tool '{}': {e}",
                    request.tool
                ))
            })?;

        let duration_ms = start_instant.elapsed().as_millis() as u64;
        let completed_at = Utc::now();
        let success = output.status.success();

        Ok(ToolExecutionResult {
            tool: request.tool,
            target: request.target.clone(),
            job_id: request.job_id,
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration_ms,
            started_at,
            completed_at,
            success,
        })
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ScopeType;
    use std::path::PathBuf;

    fn test_policy() -> ScopePolicy {
        let mut policy = ScopePolicy::new(ProgramId::new());
        policy.add_inclusion("example.com", ScopeType::Domain);
        policy.add_inclusion("*.example.com", ScopeType::Wildcard);
        policy.add_exclusion("forbidden.example.com", ScopeType::Domain);
        policy
    }

    #[test]
    fn test_command_construction_for_all_tools() {
        let policy = test_policy();
        let tools = [
            ToolIdentifier::Subfinder,
            ToolIdentifier::Dnsx,
            ToolIdentifier::Httpx,
            ToolIdentifier::Naabu,
            ToolIdentifier::Nmap,
            ToolIdentifier::Katana,
            ToolIdentifier::Gau,
            ToolIdentifier::Waybackurls,
            ToolIdentifier::Ffuf,
            ToolIdentifier::Nuclei,
        ];

        for tool in tools {
            let req = ToolExecutionRequest::new(
                tool,
                "api.example.com",
                policy.program_id,
                policy.clone(),
            )
            .unwrap();
            let args = req.build_arguments().unwrap();
            assert!(!args.is_empty(), "Args for {tool} should not be empty");
            // Must contain the target
            assert!(
                args.iter().any(|a| a.contains("api.example.com")),
                "Args for {tool} must reference target"
            );
        }
    }

    #[test]
    fn test_rejection_of_out_of_scope_targets() {
        let policy = test_policy();
        // evil.com is out of scope
        let req = ToolExecutionRequest::new(
            ToolIdentifier::Subfinder,
            "evil.com",
            policy.program_id,
            policy.clone(),
        )
        .unwrap();

        let prep_res = ToolRunner::prepare_execution(&req);
        assert!(prep_res.is_err());
        assert!(matches!(
            prep_res.unwrap_err(),
            BountyError::ScopeViolation(_)
        ));

        // forbidden.example.com is explicitly excluded
        let req2 = ToolExecutionRequest::new(
            ToolIdentifier::Httpx,
            "forbidden.example.com",
            policy.program_id,
            policy.clone(),
        )
        .unwrap();

        let prep_res2 = ToolRunner::prepare_execution(&req2);
        assert!(prep_res2.is_err());
        assert!(matches!(
            prep_res2.unwrap_err(),
            BountyError::ScopeViolation(_)
        ));
    }

    #[test]
    fn test_rejection_of_malformed_targets() {
        let policy = test_policy();
        let res = ToolExecutionRequest::new(
            ToolIdentifier::Subfinder,
            "   ",
            policy.program_id,
            policy.clone(),
        );
        assert!(res.is_err());

        let res2 = ToolExecutionRequest::new(
            ToolIdentifier::Subfinder,
            "example .com",
            policy.program_id,
            policy.clone(),
        );
        assert!(res2.is_err());
    }

    #[test]
    fn test_rejection_of_shell_injection_arguments() {
        let policy = test_policy();
        let mut req = ToolExecutionRequest::new(
            ToolIdentifier::Subfinder,
            "api.example.com",
            policy.program_id,
            policy.clone(),
        )
        .unwrap();

        req.options.custom_args = vec!["; cat /etc/passwd".to_string()];
        let prep_res = ToolRunner::prepare_execution(&req);
        assert!(prep_res.is_err());
        assert!(matches!(
            prep_res.unwrap_err(),
            BountyError::PolicyRejected(_)
        ));
    }

    #[tokio::test]
    async fn test_missing_binary_fails_without_faking_success() {
        let policy = test_policy();
        let req = ToolExecutionRequest::new(
            ToolIdentifier::Nuclei,
            "api.example.com",
            policy.program_id,
            policy.clone(),
        )
        .unwrap();

        let non_existent = PathBuf::from("C:\\fake_path_xyz\\nuclei.exe");
        let res = ToolRunner::execute_tool(&req, Some(&non_existent)).await;

        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), BountyError::NotFound(_)));
    }
}
