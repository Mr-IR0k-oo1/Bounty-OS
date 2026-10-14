$ErrorActionPreference = "Stop"

$PromptDir = $PSScriptRoot
$RepoDir = Split-Path $PromptDir -Parent
$LogDir = Join-Path $RepoDir ".overnight-logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $RepoDir

Write-Host ""
Write-Host "========================================"
Write-Host "        BOUNTY OS OVERNIGHT BUILD"
Write-Host "========================================"
Write-Host "Repository : $RepoDir"
Write-Host "Model      : qwen2.5-coder:7b"
Write-Host "Provider   : Ollama"
Write-Host ""

# Verify Ollama is available
Write-Host "[1/3] Checking Ollama..."

$ollamaVersion = & ollama --version 2>&1

if ($LASTEXITCODE -ne 0) {
    throw "Ollama is not available."
}

Write-Host $ollamaVersion

# Verify model exists
Write-Host ""
Write-Host "[2/3] Checking Qwen model..."

$models = & ollama list 2>&1

if ($LASTEXITCODE -ne 0) {
    throw "Could not query Ollama."
}

if ($models -notmatch "qwen2\.5-coder:7b") {
    throw "qwen2.5-coder:7b is not installed."
}

Write-Host "qwen2.5-coder:7b found."

# Check git state
Write-Host ""
Write-Host "[3/3] Checking Git state..."

$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host ""
    Write-Host "WARNING: repository contains uncommitted changes:"
    Write-Host $gitStatus
    Write-Host ""
    Write-Host "Commit or stash these changes before starting."
    exit 1
}

Write-Host "Working tree clean."

# Find stage prompts
$prompts = Get-ChildItem $PromptDir -Filter "[0-9][0-9]-*.md" |
    Sort-Object Name

if ($prompts.Count -eq 0) {
    throw "No numbered prompt files found."
}

Write-Host ""
Write-Host "Found $($prompts.Count) build stages."

# Run stages sequentially
foreach ($prompt in $prompts) {

    $name = [System.IO.Path]::GetFileNameWithoutExtension($prompt.Name)
    $log = Join-Path $LogDir "$name.log"

    Write-Host ""
    Write-Host "========================================"
    Write-Host " STAGE: $name"
    Write-Host "========================================"
    Write-Host "Prompt: $($prompt.Name)"
    Write-Host "Log:    $log"
    Write-Host ""

    $content = Get-Content $prompt.FullName -Raw

    $instruction = @"
You are the autonomous engineering agent for Bounty OS.

You are executing exactly ONE build stage.

Read the complete stage specification below.

RULES:

1. Work directly inside the current Bounty OS repository.
2. Inspect existing code before modifying anything.
3. Preserve working functionality.
4. Implement the requested stage completely.
5. Keep the implementation simple and maintainable.
6. Do not invent APIs, dependencies, test results, or functionality.
7. Do not fabricate vulnerabilities or security findings.
8. Do not bypass Bounty OS scope or policy controls.
9. Do not execute targets outside explicitly configured scope.
10. Do not modify unrelated projects or files outside this repository.
11. Run the required tests before declaring the stage complete.
12. If tests fail, investigate and fix the problem.
13. Do not move to another stage.
14. The stage is NOT complete until the required Git commit succeeds.
15. If you cannot safely complete the stage, stop and explain the blocker.

IMPORTANT:
You are operating as a coding agent, not as a conversational assistant.
Actually inspect, implement, test, and commit the requested work.

STAGE SPECIFICATION
===================

$content

END STAGE SPECIFICATION
"@

    Write-Host "Launching Claude through Ollama..."
    Write-Host "Model: qwen2.5-coder:7b"
    Write-Host ""

    # Launch Claude Code through Ollama.
    # The stage prompt is supplied through stdin.
    $output = $instruction | & ollama launch claude --model qwen2.5-coder:7b 2>&1

    $exitCode = $LASTEXITCODE

    # Save complete output
    $output | Out-File -FilePath $log -Encoding utf8

    # Display output
    $output | Write-Host

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "========================================"
        Write-Host " STAGE FAILED"
        Write-Host "========================================"
        Write-Host "Stage: $name"
        Write-Host "Exit code: $exitCode"
        Write-Host "Log: $log"
        exit $exitCode
    }

    # Verify repository is clean.
    # A successful stage must have committed its changes.
    $remainingChanges = git status --porcelain

    if ($remainingChanges) {

        Write-Host ""
        Write-Host "========================================"
        Write-Host " STAGE DID NOT COMMIT"
        Write-Host "========================================"
        Write-Host "Stage: $name"
        Write-Host ""
        Write-Host "Remaining changes:"
        Write-Host $remainingChanges
        Write-Host ""
        Write-Host "Stopping instead of continuing."
        Write-Host "Log: $log"

        exit 1
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host " STAGE COMPLETE"
    Write-Host "========================================"
    Write-Host $name

    git log -1 --oneline

    Write-Host ""
    Write-Host "Moving to next stage..."
}

Write-Host ""
Write-Host "========================================"
Write-Host "      OVERNIGHT BUILD COMPLETE"
Write-Host "========================================"
Write-Host ""

git status
git log --oneline -10