#!/usr/bin/env bash
# ==============================================================================
# x402-trustgate: Automated ClawHub Skill Publisher & Directory Submission Script
# ==============================================================================
set -euo pipefail

echo "===================================================="
echo "🚀 [x402-trustgate] Skill Publishing & Distribution"
echo "===================================================="

SKILLS=(
  "x402-bbb-trust-fixer|x402 BBB Trust Fixer|./distribution-skills/x402-bbb-trust-fixer|development,security|x402,base,mcp,agents,payments"
  "safe-rag-web-reader|Safe RAG Web Reader|./distribution-skills/safe-rag-web-reader|development,security|x402,base,mcp,agents,payments"
  "base-token-pretrade-guard|Base Token Pre-Trade Guard|./distribution-skills/base-token-pretrade-guard|development,security|x402,base,mcp,agents,payments"
)

# 1. Pre-flight Static Validation
echo -e "\n🔍 [1/3] Running pre-flight static compliance checks..."

PROHIBITED_REGEX='(?i)(private\s*key|seed\s*phrase|secret\s*key)'

for ITEM in "${SKILLS[@]}"; do
  IFS="|" read -r SLUG NAME DIR CATEGORIES TOPICS <<< "$ITEM"
  SKILL_MD="$DIR/SKILL.md"

  echo -n "   Checking $SLUG..."

  if [[ ! -f "$SKILL_MD" ]]; then
    echo " ❌ MISSING SKILL.MD ($SKILL_MD)"
    exit 1
  fi

  if grep -Eiq 'private[[:space:]]*key|seed[[:space:]]*phrase|secret[[:space:]]*key' "$SKILL_MD"; then
    echo " ❌ FAILED: Contains prohibited key phrases"
    exit 1
  fi

  FILE_SIZE=$(wc -c < "$SKILL_MD" | tr -d ' ')
  if [[ "$FILE_SIZE" -lt 200 ]]; then
    echo " ❌ FAILED: File too small or empty"
    exit 1
  fi

  echo " ✅ Validated"
done

# 2. ClawHub Publishing
echo -e "\n📦 [2/3] Publishing skills to ClawHub..."

if command -v clawhub >/dev/null 2>&1; then
  CLAWHUB_AVAILABLE=true
else
  CLAWHUB_AVAILABLE=false
  echo "⚠️  ClawHub CLI ('clawhub') was not detected in PATH."
  echo "   Install ClawHub CLI via: npm install -g @openclaw/clawhub-cli"
  echo "   Authenticate via:        clawhub login"
  echo -e "   Executing in preview mode:\n"
fi

for ITEM in "${SKILLS[@]}"; do
  IFS="|" read -r SLUG NAME DIR CATEGORIES TOPICS <<< "$ITEM"

  CMD="clawhub skill publish $DIR --slug $SLUG --name \"$NAME\" --categories \"$CATEGORIES\" --topics \"$TOPICS\""
  echo "▶ $CMD"

  if [ "$CLAWHUB_AVAILABLE" = true ]; then
    clawhub skill publish "$DIR" --slug "$SLUG" --name "$NAME" --categories "$CATEGORIES" --topics "$TOPICS"
    echo -e "   ✅ Successfully published $SLUG to ClawHub!\n"
  else
    echo -e "   [READY TO PUBLISH] Run command above once authenticated.\n"
  fi
done

# 3. Directory Submission Payloads
echo "===================================================="
echo "🌐 [3/3] Ready-to-Paste Directory Submission Payloads"
echo "===================================================="

echo -e "\n1. Submission Payload for https://x402-list.com (POST /api/v1/services):"
cat << 'EOF'
{
  "name": "x402-trustgate",
  "url": "https://x402-trustgate.onrender.com",
  "catalog_url": "https://x402-trustgate.onrender.com/.well-known/x402.json",
  "description": "Autonomous AI agent trust verification gate, x402 trust-line auditor, and secure web envelope bridge on Base mainnet.",
  "network": "eip155:8453",
  "chainId": 8453,
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo": "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1",
  "category": "developer-tools",
  "tags": ["x402", "base", "ai-agents", "security", "auditor", "prompt-injection"],
  "pricing_model": "micro-payment-v2",
  "endpoints": [
    {
      "path": "/v1/diagnose",
      "method": "GET",
      "price_usdc": "0.00",
      "description": "Free live multi-point x402 trust-line compliance diagnostic"
    },
    {
      "path": "/v1/remediate",
      "method": "POST",
      "price_usdc": "0.95",
      "description": "Automated drop-in middleware patch & sanitized SKILL.md package"
    },
    {
      "path": "/v1/harden-skill",
      "method": "POST",
      "price_usdc": "0.85",
      "description": "Sanitizes and de-flags raw SKILL.md for static scanner and ClawHub approval"
    },
    {
      "path": "/v1/safefetch",
      "method": "POST",
      "price_usdc": "0.03",
      "description": "Cryptographically-isolated untrusted web reader and RAG prompt injection shield"
    },
    {
      "path": "/v1/trust/verify",
      "method": "POST",
      "price_usdc": "0.005",
      "description": "Real-time AI agent transaction risk evaluation"
    },
    {
      "path": "/v1/sanitize",
      "method": "POST",
      "price_usdc": "0.003",
      "description": "CanaryGuard upstream bridge: deterministic text sanitization"
    },
    {
      "path": "/v1/base/token",
      "method": "POST",
      "price_usdc": "0.01",
      "description": "CanaryGuard upstream bridge: Base ERC-20 token pre-swap safety audit"
    }
  ]
}
EOF

echo -e "\n2. Submission Payload for Coinbase CDP Bazaar (Agent Bazaar Directory):"
cat << 'EOF'
{
  "protocol": "x402",
  "version": "2.0",
  "service": {
    "name": "x402-trustgate",
    "description": "Production x402 Gateway & AI Agent Trust-Line Gate on Base Mainnet",
    "baseUrl": "https://x402-trustgate.onrender.com",
    "discoveryUrl": "https://x402-trustgate.onrender.com/.well-known/x402.json",
    "payment": {
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1",
      "symbol": "USDC",
      "decimals": 6
    },
    "capabilities": [
      "x402-v2-compliance-auditing",
      "static-skill-md-hardening",
      "prompt-injection-shielding",
      "agent-reputation-verification",
      "base-token-safety-analysis"
    ],
    "distribution_skills": [
      {
        "slug": "x402-bbb-trust-fixer",
        "clawhub": "clawhub/x402-bbb-trust-fixer"
      },
      {
        "slug": "safe-rag-web-reader",
        "clawhub": "clawhub/safe-rag-web-reader"
      },
      {
        "slug": "base-token-pretrade-guard",
        "clawhub": "clawhub/base-token-pretrade-guard"
      }
    ]
  }
}
EOF

echo -e "\n✨ All 3 skills validated and indexed payloads ready for deployment!"
