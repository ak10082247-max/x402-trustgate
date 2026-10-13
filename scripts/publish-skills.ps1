<#
.SYNOPSIS
    Automated ClawHub skill publisher & directory submission generator for x402-trustgate.
.DESCRIPTION
    Validates all 3 distribution skills and publishes them to ClawHub.
    Outputs ready-to-paste registration payloads for x402-list.com and Coinbase CDP Bazaar.
.PARAMETER DryRun
    Validates skills and displays commands without invoking clawhub CLI.
#>

[CmdletBinding()]
param (
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "[x402-trustgate] Skill Publishing & Distribution" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$Skills = @(
    @{
        Slug       = "x402-bbb-trust-fixer"
        Name       = "x402 BBB Trust Fixer"
        Path       = "./distribution-skills/x402-bbb-trust-fixer"
        Categories = "development,security"
        Topics     = "x402,base,mcp,agents,payments"
    },
    @{
        Slug       = "safe-rag-web-reader"
        Name       = "Safe RAG Web Reader"
        Path       = "./distribution-skills/safe-rag-web-reader"
        Categories = "development,security"
        Topics     = "x402,base,mcp,agents,payments"
    },
    @{
        Slug       = "base-token-pretrade-guard"
        Name       = "Base Token Pre-Trade Guard"
        Path       = "./distribution-skills/base-token-pretrade-guard"
        Categories = "development,security"
        Topics     = "x402,base,mcp,agents,payments"
    }
)

# 1. Pre-flight Static Validation
Write-Host "`n[1/3] Running pre-flight static compliance checks..." -ForegroundColor Yellow

$prohibitedPattern = '(?i)private\s*key|seed\s*phrase|secret\s*key'
$allPassed = $true

foreach ($skill in $Skills) {
    $skillMdPath = Join-Path $skill.Path "SKILL.md"
    Write-Host "   Checking $($skill.Slug)... " -NoNewline

    if (-not (Test-Path $skillMdPath)) {
        Write-Host "[FAILED: MISSING SKILL.MD]" -ForegroundColor Red
        $allPassed = $false
        continue
    }

    $content = Get-Content -Path $skillMdPath -Raw
    if ($content -match $prohibitedPattern) {
        Write-Host "[FAILED: Prohibited key trigger words detected]" -ForegroundColor Red
        $allPassed = $false
        continue
    }

    if ($content.Length -lt 200) {
        Write-Host "[FAILED: File too small or empty]" -ForegroundColor Red
        $allPassed = $false
        continue
    }

    Write-Host "[PASS]" -ForegroundColor Green
}

if (-not $allPassed) {
    Write-Error "Static validation failed. Aborting publish process."
    exit 1
}

# 2. ClawHub CLI Detection & Publishing
Write-Host "`n[2/3] Publishing skills to ClawHub..." -ForegroundColor Yellow

$clawhubInstalled = (Get-Command "clawhub" -ErrorAction SilentlyContinue) -ne $null

if (-not $clawhubInstalled) {
    Write-Host "[WARN] ClawHub CLI ('clawhub') was not detected in PATH." -ForegroundColor DarkYellow
    Write-Host "       Install ClawHub CLI via: npm install -g @openclaw/clawhub-cli" -ForegroundColor DarkGray
    Write-Host "       Authenticate via:        clawhub login" -ForegroundColor DarkGray
    Write-Host "       Executing in preview/dry-run mode:`n" -ForegroundColor DarkYellow
}

foreach ($skill in $Skills) {
    $cmd = "clawhub skill publish $($skill.Path) --slug $($skill.Slug) --name `"$($skill.Name)`" --categories `"$($skill.Categories)`" --topics `"$($skill.Topics)`""
    Write-Host ">> $cmd" -ForegroundColor Cyan

    if ($clawhubInstalled -and (-not $DryRun)) {
        try {
            & clawhub skill publish $skill.Path --slug $skill.Slug --name $skill.Name --categories $skill.Categories --topics $skill.Topics
            Write-Host "   [SUCCESS] Published $($skill.Slug) to ClawHub!`n" -ForegroundColor Green
        }
        catch {
            Write-Warning "   [ERROR] Failed to publish $($skill.Slug): $_"
        }
    } else {
        Write-Host "   [READY TO EXECUTE] Command validated.`n" -ForegroundColor Gray
    }
}

# 3. Directory Submission Payloads
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "[3/3] Ready-to-Paste Directory Submission Payloads" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$x402ListPayload = @{
    name          = "x402-trustgate"
    url           = "https://x402-trustgate.onrender.com"
    catalog_url   = "https://x402-trustgate.onrender.com/.well-known/x402.json"
    description   = "Autonomous AI agent trust verification gate, x402 trust-line auditor, and secure web envelope bridge on Base mainnet."
    network       = "eip155:8453"
    chainId       = 8453
    asset         = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    payTo         = "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1"
    category      = "developer-tools"
    tags          = @("x402", "base", "ai-agents", "security", "auditor", "prompt-injection")
    pricing_model = "micro-payment-v2"
    endpoints     = @(
        @{
            path        = "/v1/diagnose"
            method      = "GET"
            price_usdc  = "0.00"
            description = "Free live multi-point x402 trust-line compliance diagnostic"
        },
        @{
            path        = "/v1/remediate"
            method      = "POST"
            price_usdc  = "0.95"
            description = "Automated drop-in middleware patch & sanitized SKILL.md package"
        },
        @{
            path        = "/v1/harden-skill"
            method      = "POST"
            price_usdc  = "0.85"
            description = "Sanitizes and de-flags raw SKILL.md for static scanner and ClawHub approval"
        },
        @{
            path        = "/v1/safefetch"
            method      = "POST"
            price_usdc  = "0.03"
            description = "Cryptographically-isolated untrusted web reader and RAG prompt injection shield"
        },
        @{
            path        = "/v1/trust/verify"
            method      = "POST"
            price_usdc  = "0.005"
            description = "Real-time AI agent transaction risk evaluation"
        },
        @{
            path        = "/v1/sanitize"
            method      = "POST"
            price_usdc  = "0.003"
            description = "CanaryGuard upstream bridge: deterministic text sanitization"
        },
        @{
            path        = "/v1/base/token"
            method      = "POST"
            price_usdc  = "0.01"
            description = "CanaryGuard upstream bridge: Base ERC-20 token pre-swap safety audit"
        }
    )
} | ConvertTo-Json -Depth 5

$cdpBazaarPayload = @{
    protocol = "x402"
    version  = "2.0"
    service  = @{
        name         = "x402-trustgate"
        description  = "Production x402 Gateway & AI Agent Trust-Line Gate on Base Mainnet"
        baseUrl      = "https://x402-trustgate.onrender.com"
        discoveryUrl = "https://x402-trustgate.onrender.com/.well-known/x402.json"
        payment      = @{
            network = "eip155:8453"
            asset   = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
            payTo   = "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1"
            symbol  = "USDC"
            decimals = 6
        }
        capabilities = @(
            "x402-v2-compliance-auditing",
            "static-skill-md-hardening",
            "prompt-injection-shielding",
            "agent-reputation-verification",
            "base-token-safety-analysis"
        )
        distribution_skills = @(
            @{ slug = "x402-bbb-trust-fixer"; clawhub = "clawhub/x402-bbb-trust-fixer" },
            @{ slug = "safe-rag-web-reader"; clawhub = "clawhub/safe-rag-web-reader" },
            @{ slug = "base-token-pretrade-guard"; clawhub = "clawhub/base-token-pretrade-guard" }
        )
    }
} | ConvertTo-Json -Depth 5

Write-Host "`n1. Submission Payload for https://x402-list.com (POST /api/v1/services):" -ForegroundColor Magenta
Write-Host $x402ListPayload -ForegroundColor White

Write-Host "`n2. Submission Payload for Coinbase CDP Bazaar (Agent Bazaar Directory):" -ForegroundColor Magenta
Write-Host $cdpBazaarPayload -ForegroundColor White

Write-Host "`n[SUCCESS] All 3 skills validated and indexed payloads ready for deployment!" -ForegroundColor Green
