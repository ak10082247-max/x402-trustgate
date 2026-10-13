# x402-trustgate

A high-performance, production TypeScript/Node.js x402 revenue gateway and trust verification service on **Base Mainnet** (`eip155:8453`) using USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).

`x402-trustgate` operates as both an autonomous agent trust and policy enforcement gate and a zero-latency keep-alive bridge for upstream partner services (`CanaryGuard 402` at `https://canaryguard-402.onrender.com`), unifying revenue under the existing `PAY_TO_WALLET` family.

---

## ⚡ Architecture Overview

```
                                  +-----------------------------+
                                  |   AI Agent / Indexer Probe  |
                                  |  (agenteconomy, roundhouse) |
                                  +--------------+--------------+
                                                 |
                                                 v
                               +----------------------------------+
                               |     x402-trustgate (Hono/TS)     |
                               |      Base Mainnet (eip155:8453)  |
                               +-----------------+----------------+
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                                                               |
         v                                                                               v
[Local High-Margin Endpoints]                                           [Upstream CanaryGuard Bridge]
• POST/GET /v1/trust/verify (0.005 USDC)                                • ALL /v1/sanitize (HTTP 307 Redirect)
• POST/GET /v1/gate/authorize (0.010 USDC)                              • ALL /v1/base/token (HTTP 307 Redirect)
• GET /v1/trust/score (0.002 USDC)                                      • Background keep-alive (Every 9 mins)
• GET /.well-known/x402.json (Catalog)                                                   |
• GET /health (Live reachability)                                                        v
         |                                                                +-----------------------------+
         v                                                                | https://canaryguard-402     |
+-----------------------------------+                                     |         .onrender.com       |
| x402 Dual V1+V2 Middleware        |                                     +-----------------------------+
| • < 50ms unauthenticated 402      |
| • PAYMENT-REQUIRED Base64 header  |
| • Facilitator /verify settlement  |
+-----------------------------------+
```

---

## 🚀 Key Components

### 1. Upstream Redirect & Keep-Alive Bridge
* **HTTP 307 Temporary Redirect**: `ALL /v1/sanitize` and `ALL /v1/base/token` respond with HTTP `307` pointing to `${UPSTREAM_CANARYGUARD_URL}`. Per RFC 7231 / RFC 9110, HTTP 307 strictly preserves the request method (`POST`, `GET`, etc.), request body payloads, and critical payment authorization headers (`X-PAYMENT`, `PAYMENT-SIGNATURE`, `Authorization`).
* **Active Background Keep-Alive**: An automated background timer fires every 9 minutes sending a probe to `https://canaryguard-402.onrender.com/` to prevent Render free/starter tiers from sleeping, ensuring zero cold-start latency during liveness sweeps from `agenteconomy.report` and `roundhouseai.io`.

### 2. Dual-Compatible x402 V1 + V2 Payment Middleware (`src/middleware/x402.ts`)
* **Sub-50ms 402 Responses**: Unauthenticated requests to paid routes return HTTP `402 Payment Required` in `< 1ms` (zero external network hops).
* **Dual Method Support**: Both `GET` and `POST` methods return valid `402` responses, preventing indexers from penalizing the API with `405 Method Not Allowed`.
* **Standard x402 Headers & Payloads**:
  * Header `PAYMENT-REQUIRED`: Base64-encoded x402 v2 payment requirements.
  * Header `X-Payment-Required`: Base64-encoded requirements (v1 backward compatibility).
  * Standard Base metadata: `X-402-Version: 2`, `X-402-Payment-To`, `X-402-Amount`, `X-402-Amount-Units`, `X-402-Asset`, `X-402-Network: base`, `X-402-Chain-Id: 8453`.
  * Structured JSON body with `x402Version: 2` and `accepts` array (`eip155:8453`, USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
* **Facilitator Signature Verification**: When clients present `X-PAYMENT` or `PAYMENT-SIGNATURE`, the middleware calls the configured x402 facilitator (`process.env.X402_FACILITATOR_URL`), settles the transaction, and returns the `PAYMENT-RESPONSE` settlement header.

### 3. Discovery & Health Routes
* `GET /.well-known/x402.json`: Machine-readable catalog listing local trustgate endpoints alongside upstream CanaryGuard endpoints under the unified `payTo` wallet family.
* `GET /health`: Instant 200 OK health check displaying process uptime and real-time upstream CanaryGuard reachability, status code, and latency.

---

## 🛠️ Configuration (`.env`)

```ini
# Server Port
PORT=3000
NODE_ENV=production

# Base Mainnet Payment Wallet (Recipient for USDC payments)
PAY_TO_WALLET=0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1

# Upstream CanaryGuard Instance (Keep-alive ping & 307 proxy target)
UPSTREAM_CANARYGUARD_URL=https://canaryguard-402.onrender.com

# x402 Facilitator Endpoint
X402_FACILITATOR_URL=https://x402.org/facilitator

# Keep-alive interval in minutes (default: 9)
KEEP_ALIVE_INTERVAL_MINUTES=9
```

---

## 📦 Quickstart

### Prerequisites
* Node.js v18+ (tested on Node v24)
* npm v9+

### Installation & Build
```bash
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Starting the Server
```bash
# Production
npm start

# Development with live reloading
npm run dev
```

---

## 🔍 Verification Commands

### 1. Health & Upstream Status Check
```bash
curl -i http://localhost:3000/health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "x402-trustgate",
  "version": "1.0.0",
  "uptimeSeconds": 12,
  "payToWallet": "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1",
  "network": "eip155:8453",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "upstream": {
    "url": "https://canaryguard-402.onrender.com",
    "reachable": true,
    "statusCode": 200,
    "latencyMs": 361
  }
}
```

### 2. Upstream 307 Bridge Check
```bash
curl -i http://localhost:3000/v1/sanitize
```
**Response:**
```http
HTTP/1.1 307 Temporary Redirect
Location: https://canaryguard-402.onrender.com/v1/sanitize
x-upstream-bridge: canaryguard-402
```

### 3. Machine-Readable Discovery Catalog
```bash
curl -i http://localhost:3000/.well-known/x402.json
```

### 4. x402 Payment Required Probe (< 50ms)
```bash
# Probe with GET (no 405 Method Not Allowed!)
curl -i http://localhost:3000/v1/trust/verify

# Probe with POST
curl -i -X POST http://localhost:3000/v1/trust/verify \
  -H "Content-Type: application/json" \
  -d '{"agentAddress": "0x1111111111111111111111111111111111111111"}'
```
**Response:**
```http
HTTP/1.1 402 Payment Required
payment-required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkI...
x-402-version: 2
x-402-payment-to: 0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1
x-402-amount: 0.005
x-402-amount-units: 5000
x-402-asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
x-402-network: base
x-response-time-ms: 0.62

{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "maxAmountRequired": "5000",
      "resource": "http://localhost:3000/v1/trust/verify",
      "payTo": "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  ]
}
```

---

## 🔒 Upstream Production Protection Note
Per system architecture constraints, the upstream repository (`ak10082247-max/canaryguard-402`) and production instance (`https://canaryguard-402.onrender.com`) are 100% untouched. `x402-trustgate` serves as an independent companion gateway and bridge.
