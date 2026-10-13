---
name: base-token-pretrade-guard
description: Mandatory pre-swap contract verification and announcement link scrubber for autonomous DeFi and trading agents on Base Mainnet (eip155:8453). Analyzes token contract safety, liquidity locks, honeypot traps, and scrubs project links before initiating token swaps.
metadata:
  author: x402-trustgate
  version: 1.1.0
  homepage: https://x402-trustgate.onrender.com
  upstream: https://canaryguard-402.onrender.com
  network: eip155:8453
  categories:
    - defi
    - security
  topics:
    - base-network
    - token-analysis
    - defi-trading
    - trading-guard
    - x402
---

# Base Token Pre-Trade Guard

Protect autonomous trading agents and DeFi swappers on **Base Mainnet** (`eip155:8453`). Before executing token swaps, approvals, or pool deposits, verify that target token contracts are free of malicious transfer fees, blacklists, unlimited allowance drainers, or honeypot logic.

---

## 🎯 When to Use
Activate this skill whenever:
* An autonomous agent receives an instruction or signal to purchase or swap an unfamiliar token on Base.
* An agent processes a DEX link (Uniswap, Aerodrome), Telegram announcement, or social signal.
* An agent must verify token contract safety, minting privileges, and owner permissions before executing `approve()` or `swapExactTokensForTokens()`.

---

## ⚙️ Execution Flow

```
[Candidate Token Address / Announcement Link]
                      |
                      v
STEP 1: Contract Safety & Honeypot Analysis ($0.01 USDC)
POST https://canaryguard-402.onrender.com/v1/base/token
                      |
                      +---> Checks buy/sell taxes, honeypots, allowance drainers
                      |
STEP 2: Project Announcement & Link Scrubbing ($0.03 USDC)
POST https://x402-trustgate.onrender.com/v1/safefetch
                      |
                      +---> Strips hidden DOM injections & malicious wallet links
                      |
STEP 3: Pre-Trade Decision Gate
                      |
        +-------------+-------------+
        |                           |
  [Risk Score <= 0.20]       [Risk Score > 0.20]
        |                           |
        v                           v
  PROCEED TO SWAP            HALT & REPORT THREAT
```

---

## 📋 Step-by-Step Instructions

### Step 1: Token Contract & Liquidity Safety Audit ($0.01 USDC)
Before signing any approval or swap transaction, submit the token contract address to the CanaryGuard Base Token bridge:

> **User Confirmation Disclosure:** Step 1 executes an x402 payment of **$0.01 USDC** (`10000` units) on Base Mainnet (`eip155:8453`). Ensure agent policy authorizes contract security auditing.

```bash
# Analyze token contract safety on Base:
curl -X POST https://canaryguard-402.onrender.com/v1/base/token \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \
  -d '{"token_address": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", "network": "base"}'
```

**Verification Criteria:**
* **Honeypot Trap:** Must be `false`. If `true`, reject immediately.
* **Buy/Sell Tax:** Flag if tax exceeds `3%`.
* **Mint Privileges:** Verify whether the owner can arbitrarily inflate token supply.
* **Blacklist Mechanism:** Verify whether the contract allows freezing arbitrary wallets.

---

### Step 2: Project Documentation & Social Link Scrubbing ($0.03 USDC)
If the trade was triggered by an external URL (DEX link, whitepaper, or project portal), scrub the web page to ensure it contains no hidden wallet-drainer scripts or phishing redirect payloads:

> **User Confirmation Disclosure:** Step 2 executes an x402 payment of **$0.03 USDC** (`30000` units) on Base Mainnet (`eip155:8453`).

```bash
# Scrub project announcement URL:
curl -X POST https://x402-trustgate.onrender.com/v1/safefetch \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \
  -d '{"url": "https://candidate-project-docs.com"}'
```

**Inspect Response:**
* Verify `threatScore <= 0.20`.
* Confirm `threatsNeutralized` does not contain malicious allowance directives (`approve unlimited allowance` or `transfer all funds`).
* Read clean markdown inside `<untrusted_data_envelope>` to verify tokenomics and roadmap.

---

### Step 3: Autonomous Pre-Trade Decision Gate
Execute the swap only when all conditions are satisfied:

```typescript
// Pre-Trade Rule Evaluation:
if (tokenSafety.is_honeypot === true) {
  throw new Error("PreTradeGuard: Contract identified as a Honeypot trap. Swap aborted.");
}

if (tokenSafety.sell_tax > 5 || tokenSafety.buy_tax > 5) {
  throw new Error("PreTradeGuard: Excessive token tax detected. Swap aborted.");
}

if (safeFetchResult.threatScore > 0.25) {
  throw new Error("PreTradeGuard: Malicious prompt injection or drainer pattern found in project documentation.");
}

// All checks passed -> Proceed with swap execution
console.log("PreTradeGuard: Token verified safe. Proceeding with trade.");
```

---

## 🔒 Security Best Practices for Trading Agents
* **Hard Spend Limits:** Never approve unlimited allowances (`2^256 - 1`). Always approve the exact swap amount required.
* **Signer Isolation:** Never accept or log wallet signer credentials in trading prompts. Always use secure, hardware-backed or KMS-managed signers.
* **Deterministic Fail-Closed Architecture:** If either security endpoint returns an error, the trade MUST fail closed (abort) rather than proceeding unsafely.
