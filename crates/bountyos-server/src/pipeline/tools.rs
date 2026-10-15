//! Tool Registry and Executable Discovery
//!
//! Provides server-controlled detection and health verification of reconnaissance binaries
//! (subfinder, httpx, naabu, katana, nuclei, gau, waybackurls). Never invokes a shell.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub path: Option<String>,
    pub version: Option<String>,
    pub healthy: bool,
}

pub struct ToolRegistry;

impl ToolRegistry {
    /// Detect the executable path for a named security tool using server-controlled search paths.
    /// Never evaluates user-controlled or arbitrary paths.
    pub fn find_tool_path(name: &str) -> Option<PathBuf> {
        // 1. Explicit server environment variable override (e.g. SUBFINDER_PATH)
        let env_key = format!("{}_PATH", name.to_uppercase());
        if let Ok(val) = std::env::var(&env_key) {
            let p = PathBuf::from(val);
            if p.is_file() {
                return Some(p);
            }
        }

        // 2. Search host PATH directories
        if let Some(paths) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&paths) {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
                #[cfg(windows)]
                {
                    let candidate_exe = dir.join(format!("{}.exe", name));
                    if candidate_exe.is_file() {
                        return Some(candidate_exe);
                    }
                }
            }
        }

        // 3. Known standard system bin directories
        let common = [
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/opt/homebrew/bin",
            "/usr/local/sbin",
            "/usr/sbin",
        ];
        for dir in common {
            let candidate = PathBuf::from(dir).join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }

        None
    }

    /// Check if a tool is installed and healthy
    pub async fn check_tool(name: &str) -> ToolInfo {
        let path_opt = Self::find_tool_path(name);
        match path_opt {
            Some(path) => {
                let version = Self::detect_version(&path, name).await;
                ToolInfo {
                    name: name.to_string(),
                    path: Some(path.to_string_lossy().to_string()),
                    version,
                    healthy: true,
                }
            }
            None => ToolInfo {
                name: name.to_string(),
                path: None,
                version: None,
                healthy: false,
            },
        }
    }

    /// Check all registered security tools
    pub async fn check_all() -> Vec<ToolInfo> {
        let tools = [
            "subfinder",
            "httpx",
            "naabu",
            "katana",
            "nuclei",
            "gau",
            "waybackurls",
        ];
        let mut list = Vec::new();
        for t in tools {
            list.push(Self::check_tool(t).await);
        }
        list
    }

    /// Determine if subfinder is specifically available
    pub fn is_subfinder_available() -> bool {
        Self::find_tool_path("subfinder").is_some()
    }

    /// Query binary version with server-controlled argument and a tight 5-second timeout.
    /// Never invokes a shell.
    async fn detect_version(path: &PathBuf, _name: &str) -> Option<String> {
        let output = tokio::time::timeout(
            tokio::time::Duration::from_secs(5),
            tokio::process::Command::new(path).arg("-version").output(),
        )
        .await
        .ok()?
        .ok()?;

        let text = String::from_utf8_lossy(&output.stdout);
        let err_text = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}\n{}", text, err_text);

        for line in combined.lines() {
            let line_trim = line.trim();
            if line_trim.contains("version") || line_trim.contains("Version") {
                let parts: Vec<&str> = line_trim.split_whitespace().collect();
                for part in parts {
                    let cleaned = part.trim_matches(|c: char| !c.is_alphanumeric() && c != '.');
                    if cleaned.chars().any(|c| c.is_ascii_digit()) && cleaned.contains('.') {
                        return Some(cleaned.to_string());
                    }
                }
                return Some(line_trim.to_string());
            }
        }

        Some("installed".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_tool_path_nonexistent() {
        assert!(ToolRegistry::find_tool_path("non_existent_binary_xyz_123").is_none());
    }

    #[test]
    fn test_find_tool_path_env_override() {
        let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("cargo"));
        std::env::set_var("TESTTOOL_PATH", &exe);
        let found = ToolRegistry::find_tool_path("testtool");
        assert!(found.is_some());
        assert_eq!(found.unwrap(), exe);
        std::env::remove_var("TESTTOOL_PATH");
    }
}
