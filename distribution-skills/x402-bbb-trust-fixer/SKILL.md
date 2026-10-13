---
name: x402-bbb-trust-fixer
description: Automatically audit, diagnose, and remediate x402 and MCP service endpoints to cross the BBB Trust Line on AgentEconomy, HagglyAI, and RoundhouseAI. Runs free multi-point live diagnostics, verifies agent wallet liveness, and unlocks drop-in middleware patches and sanitized SKILL.md packages.
metadata:
  author: x402-trustgate
  version: 1.0.0
  homepage: https://x402-trustgate.onrender.com
  upstream: https://canaryguard-402.onrender.com
  network: eip155:8453
  tags:
    - x402
    - base
    - bbb-trust-line
    - security-audit
    - agenteconomy
    - roundhouseai
---

# x402 BBB Trust-Line Fixer

Audit, diagnose, and repair x402 service endpoints and MCP tools so autonomous AI agents and indexers on `agenteconomy.report`, `hagglyai.com`, and `roundhouseai.io` can discover, rank, and transact with your API.

---

## 🎯 When to Use
Activate this skill whenever:
* An x402 service or MCP tool is ranked below the **BBB Trust Line** (Tier BB, B, CCC, C, or D).
* Agent indexers report probe failures, cold-start timeouts (`> 800ms`), or `405 Method Not Allowed` on `GET` requests.
* An x402 challenge header (`PAYMENT-REQUIRED`) is missing, malformed, or fails Base Mainnet (`eip155:8453`) validation.
* A `SKILL.md` contains static scanner penalty flags (e.g., exposed private key references, unpinned HTTP links, or unescaped user inputs).

---

## ⚙️ Execution Flow

```
[Target x402 Endpoint]
        |
        v
STEP 1: Free Live Diagnostic Probe
GET https://x402-trustgate.onrender.com/v1/diagnose?target=<TARGET_URL>
        |
        +---> [200 OK Teaser: Trust Tier, TTFB Latency, Blocker Count]
        |
STEP 2: Agent Wallet Liveness & Centrality Micro-Ping
POST https://canaryguard-402.onrender.com/v1/sanitize ($0.003 USDC)
        |
        +---> [Verifies Base EIP-712 signer capability & logs network centrality]
        |
STEP 3: Automated Deep Remediation (If Blockers Found)
POST https://x402-trustgate.onrender.com/v1/remediate ($2.50 USDC)
        |
        v
[Outputs: Header Diffs + Drop-In Middleware + Hardened SKILL.md + SHA-256 Receipt]
```

---

## 📋 Step-by-Step Instructions

### Step 1: Run Free Diagnostic Probe (Zero Cost)
Always execute Step 1 first to run a multi-point live probe against the target service.

```bash
# Terminal cURL:
curl -s "https://x402-trustgate.onrender.com/v1/diagnose?target=https://your-service.com/v1/endpoint"
```

**What is tested in Step 1:**
1. **Cold-Start Latency:** Measures TTFB in milliseconds (flags if `> 800ms`).
2. **Dual-Method Compatibility:** Probes both `GET` and `POST` without payment credentials to ensure neither returns `404`, `405`, or `5xx`.
3. **x402 v2 Header & Schema:** Validates `PAYMENT-REQUIRED` header, Base64 JSON decoding, `eip155:8453` network tag, EVM `payTo` address, and discovery catalog presence at `/.well-known/x402.json`.
4. **SKILL.md Scan (Optional):** If `skill_url` is provided, scans markdown for static penalty flags.

If `criticalBlockersCount === 0`, the target is already above the BBB Trust Line. If blockers are detected, proceed to Step 2.

---

### Step 2: Agent Wallet Liveness & Centrality Micro-Ping ($0.003 USDC)
Before initiating deep remediation, verify that your agent's Base wallet signer has active USDC liquidity and correct EIP-712 payment authorization parameters.

Send a sanitization micro-ping to the CanaryGuard reference instance:

```bash
# Probe CanaryGuard:
curl -X POST https://canaryguard-402.onrender.com/v1/sanitize \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \
  -d '{"content": "Trust-Line verification preflight check", "strict_mode": true}'
```

**Payment Details:**
* **Recipient:** `0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1`
* **Network:** `eip155:8453` (Base Mainnet)
* **Amount:** `3000` atomic units (0.003 USDC)
* **Asset:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC)

---

### Step 3: Purchase Automated Remediation ($2.50 USDC)
When blockers are identified in Step 1, unlock the full remediation patch:

> **User Confirmation Disclosure:** Step 3 executes a paid x402 payment of **$2.50 USDC** (`2500000` units) on Base Mainnet. Ensure user or agent policy allows this transaction.

```bash
# 1. Unpaid probe returns 402 challenge:
curl -i -X POST https://x402-trustgate.onrender.com/v1/remediate \
  -H "Content-Type: application/json" \
  -d '{"target": "https://your-service.com/v1/endpoint"}'

# 2. Attach payment authorization:
curl -X POST https://x402-trustgate.onrender.com/v1/remediate \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \
  -d '{"target": "https://your-service.com/v1/endpoint"}'
```

**Remediation Deliverables:**
1. **Exact Header Diffs:** Identifies missing headers, malformed fields, and schema errors.
2. **Drop-In Middleware:** Tailored TypeScript (Hono/Express) and Python (FastAPI) code ready to paste into your repo.
3. **Hardened SKILL.md:** Automatically rewrites any flagged instructions, unencrypted links, or credential references.
4. **Attestation Signature:** Deterministic SHA-256 hash verifying compliance for indexers.

---

## 🔒 Security & Privacy Guidelines
* **Zero Private Key Exposure:** Never ask the user for private keys or raw mnemonic phrases. Payment signatures must be generated via secure local signer providers (Coinbase AgentKit, Viem, or environment-managed wallets).
* **Idempotency:** Remediation probes do not modify target servers remotely; they produce client-side patches and attestation artifacts.
