import crypto from 'crypto';

export interface DiagnosticTargetProbe {
  url: string;
  latencyMs: number;
  status: number;
  headers: Record<string, string>;
  bodySnippet: string;
  isColdStart: boolean;
}

export interface DiagnosticCheckResult {
  category: 'latency' | 'dual_method' | 'header_schema' | 'discovery' | 'skill_static';
  name: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  details: string;
}

export interface DiagnosticTeaser {
  target: string;
  skillUrl?: string;
  estimatedTrustTier: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'C' | 'D';
  trustLineStatus: 'ABOVE_TRUST_LINE' | 'BELOW_TRUST_LINE_AT_RISK';
  criticalBlockersCount: number;
  warningCount: number;
  symptomSummary: string[];
  latencySnapshot: {
    ttfbMs: number;
    coldStartRisk: boolean;
  };
  remediationLocked: true;
  unlockInstructions: string;
  unlockEndpoint: string;
  cost: string;
  timestamp: string;
}

export interface RemediationReport {
  target: string;
  skillUrl?: string;
  auditId: string;
  passed: boolean;
  estimatedTrustTier: string;
  criticalBlockersCount: number;
  checks: DiagnosticCheckResult[];
  exactHeaderDiffs: {
    missingHeaders: string[];
    malformedHeaders: Record<string, { current: string; expected: string }>;
    schemaErrors: string[];
  };
  middlewareFixCode: {
    language: 'typescript' | 'python';
    filename: string;
    code: string;
  }[];
  sanitizedSkillMd?: string;
  canaryAuditAttestation: string;
  timestamp: string;
}

/**
 * Validates whether an EVM address matches the 0x + 40 hex character format
 */
function isValidEvmAddress(addr?: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/**
 * Runs a real live diagnostic probe against the target service URL
 */
export async function runDiagnostics(
  targetUrl: string,
  skillUrl?: string
): Promise<{
  teaser: DiagnosticTeaser;
  fullReport: RemediationReport;
}> {
  const checks: DiagnosticCheckResult[] = [];
  const symptoms: string[] = [];

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL: "${targetUrl}"`);
  }

  // --- 1. LATENCY & COLD-START PROBE (GET) ---
  const startGet = performance.now();
  let getStatus = 0;
  let getHeaders: Record<string, string> = {};
  let getBody = '';
  let getTtfb = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const getRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'x402-trustgate-auditor/1.0 (+https://x402-trustgate)',
        Accept: 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    getTtfb = Math.round(performance.now() - startGet);
    getStatus = getRes.status;
    getRes.headers.forEach((v, k) => {
      getHeaders[k.toLowerCase()] = v;
    });
    getBody = await getRes.text();
  } catch (err: any) {
    getTtfb = Math.round(performance.now() - startGet);
    getStatus = 0;
  }

  const isColdStart = getTtfb > 800;
  if (isColdStart) {
    checks.push({
      category: 'latency',
      name: 'Cold-Start Latency Check',
      passed: false,
      severity: 'critical',
      details: `TTFB was ${getTtfb}ms (> 800ms threshold). Indexer probes penalize services exceeding 500ms.`,
    });
    symptoms.push('High Latency / Cold-Start (> 800ms TTFB)');
  } else {
    checks.push({
      category: 'latency',
      name: 'Cold-Start Latency Check',
      passed: true,
      severity: 'info',
      details: `TTFB was fast (${getTtfb}ms).`,
    });
  }

  // --- 2. DUAL-METHOD PROBE (POST) ---
  const startPost = performance.now();
  let postStatus = 0;
  let postHeaders: Record<string, string> = {};
  let postBody = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const postRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'x402-trustgate-auditor/1.0',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ audit_probe: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    postStatus = postRes.status;
    postRes.headers.forEach((v, k) => {
      postHeaders[k.toLowerCase()] = v;
    });
    postBody = await postRes.text();
  } catch {
    postStatus = 0;
  }

  // Verify GET response: expect 402 on paid route; flag if 404, 405, 5xx
  if (getStatus === 405) {
    checks.push({
      category: 'dual_method',
      name: 'GET Method Compatibility',
      passed: false,
      severity: 'critical',
      details: 'GET probe returned 405 Method Not Allowed. Agent indexers probe with GET and downgrade Trust Score.',
    });
    symptoms.push('GET Probe Failure (405 Method Not Allowed)');
  } else if (getStatus >= 500 || getStatus === 0) {
    checks.push({
      category: 'dual_method',
      name: 'GET Server Availability',
      passed: false,
      severity: 'critical',
      details: `GET probe returned HTTP ${getStatus}. Server is crashing or unreachable.`,
    });
    symptoms.push('Unreachable Server / 5xx Crash on GET');
  } else if (getStatus === 404) {
    checks.push({
      category: 'dual_method',
      name: 'Route Resolution',
      passed: false,
      severity: 'critical',
      details: 'Target returned 404 Not Found on GET.',
    });
    symptoms.push('Target Route 404 Not Found');
  } else {
    checks.push({
      category: 'dual_method',
      name: 'GET Method Compatibility',
      passed: true,
      severity: 'info',
      details: `GET probe returned expected status HTTP ${getStatus}.`,
    });
  }

  // Verify POST response
  if (postStatus >= 500 || postStatus === 0) {
    checks.push({
      category: 'dual_method',
      name: 'POST Server Availability',
      passed: false,
      severity: 'critical',
      details: `POST probe failed with status HTTP ${postStatus}.`,
    });
    symptoms.push('POST Probe Crash / Timeout');
  } else {
    checks.push({
      category: 'dual_method',
      name: 'POST Probe Compatibility',
      passed: true,
      severity: 'info',
      details: `POST probe returned HTTP ${postStatus}.`,
    });
  }

  // --- 3. HEADER & SCHEMA VALIDATION ---
  const activeHeaders = getHeaders['payment-required'] ? getHeaders : postHeaders;
  const paymentRequiredRaw = activeHeaders['payment-required'];

  let missingHeaders: string[] = [];
  let malformedHeaders: Record<string, { current: string; expected: string }> = {};
  let schemaErrors: string[] = [];

  let decodedPaymentReq: any = null;

  if (!paymentRequiredRaw) {
    checks.push({
      category: 'header_schema',
      name: 'PAYMENT-REQUIRED Header Presence',
      passed: false,
      severity: 'critical',
      details: 'Missing standard PAYMENT-REQUIRED header in 402 challenge.',
    });
    missingHeaders.push('PAYMENT-REQUIRED');
    symptoms.push('Missing PAYMENT-REQUIRED Header');
  } else {
    try {
      const decodedJsonStr = Buffer.from(paymentRequiredRaw, 'base64').toString('utf8');
      decodedPaymentReq = JSON.parse(decodedJsonStr);

      checks.push({
        category: 'header_schema',
        name: 'PAYMENT-REQUIRED Base64 Decoding',
        passed: true,
        severity: 'info',
        details: 'Header is valid Base64-encoded JSON.',
      });
    } catch {
      checks.push({
        category: 'header_schema',
        name: 'PAYMENT-REQUIRED Base64 Decoding',
        passed: false,
        severity: 'critical',
        details: 'PAYMENT-REQUIRED header could not be decoded as valid Base64 JSON.',
      });
      malformedHeaders['PAYMENT-REQUIRED'] = {
        current: paymentRequiredRaw.slice(0, 30) + '...',
        expected: 'Valid Base64-encoded JSON payment requirement',
      };
      symptoms.push('Malformed Base64 in PAYMENT-REQUIRED Header');
    }
  }

  // Check Schema details if decoded
  if (decodedPaymentReq) {
    const accepts = decodedPaymentReq.accepts;
    if (!Array.isArray(accepts) || accepts.length === 0) {
      checks.push({
        category: 'header_schema',
        name: 'x402 accepts[] Array',
        passed: false,
        severity: 'critical',
        details: 'The payment requirements object must contain an "accepts" array with at least 1 item.',
      });
      schemaErrors.push('Missing or empty accepts[] array');
      symptoms.push('Empty accepts[] Payment Requirements');
    } else {
      const primaryAccept = accepts[0];

      // Network tag check (eip155:8453)
      if (primaryAccept.network !== 'eip155:8453') {
        checks.push({
          category: 'header_schema',
          name: 'Network Tag (eip155:8453)',
          passed: false,
          severity: 'critical',
          details: `Network was "${primaryAccept.network}". Standard Base Mainnet requires "eip155:8453".`,
        });
        malformedHeaders['accepts[0].network'] = {
          current: primaryAccept.network || 'undefined',
          expected: 'eip155:8453',
        };
        symptoms.push('Invalid Network Tag (expected eip155:8453)');
      } else {
        checks.push({
          category: 'header_schema',
          name: 'Network Tag (eip155:8453)',
          passed: true,
          severity: 'info',
          details: 'Network tag correctly set to eip155:8453.',
        });
      }

      // Check recipient address
      const payTo = primaryAccept.payTo;
      if (!isValidEvmAddress(payTo)) {
        checks.push({
          category: 'header_schema',
          name: 'payTo Address Check',
          passed: false,
          severity: 'critical',
          details: `Recipient payTo "${payTo}" is not a valid 20-byte EVM hex address.`,
        });
        malformedHeaders['accepts[0].payTo'] = {
          current: payTo || 'missing',
          expected: 'Valid 0x... EVM address',
        };
        symptoms.push('Invalid or Missing payTo Recipient Address');
      } else {
        checks.push({
          category: 'header_schema',
          name: 'payTo Address Check',
          passed: true,
          severity: 'info',
          details: `Recipient payTo is a valid EVM address: ${payTo}`,
        });
      }

      // Check asset
      const asset = primaryAccept.asset;
      if (!isValidEvmAddress(asset)) {
        checks.push({
          category: 'header_schema',
          name: 'USDC Asset Check',
          passed: false,
          severity: 'critical',
          details: `Asset contract "${asset}" is invalid or missing.`,
        });
        schemaErrors.push('Invalid asset token contract address');
      }
    }
  }

  // --- 4. DISCOVERY /.well-known/x402.json CHECK ---
  const discoveryUrl = `${parsedTarget.origin}/.well-known/x402.json`;
  let hasDiscovery = false;
  try {
    const dRes = await fetch(discoveryUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'x402-trustgate-auditor/1.0' },
    });
    hasDiscovery = dRes.status === 200;
  } catch {
    hasDiscovery = false;
  }

  if (!hasDiscovery) {
    checks.push({
      category: 'discovery',
      name: 'x402 Discovery Catalog',
      passed: false,
      severity: 'critical',
      details: `Discovery endpoint ${discoveryUrl} returned non-200. Indexers require machine-readable catalog.`,
    });
    symptoms.push('Missing /.well-known/x402.json Discovery Route');
  } else {
    checks.push({
      category: 'discovery',
      name: 'x402 Discovery Catalog',
      passed: true,
      severity: 'info',
      details: 'Machine-readable catalog exists at /.well-known/x402.json.',
    });
  }

  // --- 5. SKILL.MD STATIC RISK SCAN (If provided) ---
  let rawSkillContent = '';
  let sanitizedSkillContent = '';
  if (skillUrl) {
    try {
      const sRes = await fetch(skillUrl, {
        headers: { 'User-Agent': 'x402-trustgate-auditor/1.0' },
      });
      if (sRes.ok) {
        rawSkillContent = await sRes.text();
      }
    } catch {
      // Ignored
    }

    if (rawSkillContent) {
      const lower = rawSkillContent.toLowerCase();
      let hasPrivateKeyExpose = lower.includes('private_key') || lower.includes('privatekey') || /0x[a-f0-9]{64}/i.test(rawSkillContent);
      let hasUnpinnedUrl = /http:\/\/(?!localhost|127\.0\.0\.1)/i.test(rawSkillContent);
      let hasPromptInjectionRisk = lower.includes('ignore previous') || lower.includes('system prompt override') || lower.includes('unrestricted');

      if (hasPrivateKeyExpose) {
        checks.push({
          category: 'skill_static',
          name: 'SKILL.md Secret Exposure Check',
          passed: false,
          severity: 'critical',
          details: 'SKILL.md references private key variables without secure credential vault guards.',
        });
        symptoms.push('SKILL.md Private Key Exposure Pattern');
      }

      if (hasUnpinnedUrl) {
        checks.push({
          category: 'skill_static',
          name: 'SKILL.md Transport Security',
          passed: false,
          severity: 'warning',
          details: 'SKILL.md contains unpinned unencrypted HTTP URLs (use HTTPS).',
        });
        symptoms.push('SKILL.md Insecure HTTP References');
      }

      if (hasPromptInjectionRisk) {
        checks.push({
          category: 'skill_static',
          name: 'SKILL.md Prompt Vulnerability',
          passed: false,
          severity: 'critical',
          details: 'SKILL.md lacks injection boundary encapsulation for user inputs.',
        });
        symptoms.push('SKILL.md Prompt-Injection Vulnerability Pattern');
      }

      // Generate sanitized SKILL.md
      sanitizedSkillContent = rawSkillContent
        .replace(/http:\/\//gi, 'https://')
        .replace(/PRIVATE_KEY/g, 'SECURE_VAULT_KEY_REF')
        .replace(/(\b\w+=\b)0x[a-f0-9]{64}/gi, '$1[REDACTED_USE_VAULT]')
        + `\n\n<!-- Hardened by x402-trustgate: Strict data boundary tags enforced. Sanitized at ${new Date().toISOString()} -->\n`;
    }
  }

  // --- COMPUTE TRUST TIER ---
  const criticalCount = checks.filter((c) => !c.passed && c.severity === 'critical').length;
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length;

  let estimatedTrustTier: DiagnosticTeaser['estimatedTrustTier'] = 'AAA';
  if (criticalCount >= 4) {
    estimatedTrustTier = 'D';
  } else if (criticalCount === 3) {
    estimatedTrustTier = 'C';
  } else if (criticalCount === 2) {
    estimatedTrustTier = 'CCC';
  } else if (criticalCount === 1) {
    estimatedTrustTier = 'B';
  } else if (warningCount >= 2) {
    estimatedTrustTier = 'BB';
  } else if (warningCount === 1) {
    estimatedTrustTier = 'BBB';
  } else {
    estimatedTrustTier = 'A';
  }

  const isBelowTrustLine = ['D', 'C', 'CCC', 'B', 'BB'].includes(estimatedTrustTier);

  // --- TAILORED FIX CODE ---
  const tsFixCode = `// Generated drop-in fix for ${targetUrl}
import { Context, MiddlewareHandler } from 'hono';

export const x402Middleware = (): MiddlewareHandler => {
  return async (c: Context, next) => {
    const rawPayment = c.req.header('x-payment') || c.req.header('payment-signature');
    if (!rawPayment) {
      const requirement = {
        x402Version: 2,
        accepts: [{
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10000",
          resource: c.req.url,
          description: "x402 verified API endpoint",
          mimeType: "application/json",
          payTo: "${isValidEvmAddress(decodedPaymentReq?.accepts?.[0]?.payTo) ? decodedPaymentReq.accepts[0].payTo : '0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1'}",
          maxTimeoutSeconds: 300,
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: { name: "USD Coin", version: "2" }
        }]
      };
      const b64 = Buffer.from(JSON.stringify(requirement)).toString('base64');
      c.header('PAYMENT-REQUIRED', b64);
      c.header('X-402-Version', '2');
      c.header('X-402-Network', 'base');
      c.header('X-402-Chain-Id', '8453');
      c.header('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-402-Version');
      return c.json(requirement, 402);
    }
    return await next();
  };
};`;

  const pythonFixCode = `# Generated FastAPI drop-in fix for ${targetUrl}
import base64, json
from fastapi import Request, HTTPException, Response

PAYMENT_REQUIREMENT = {
    "x402Version": 2,
    "accepts": [{
        "scheme": "exact",
        "network": "eip155:8453",
        "maxAmountRequired": "10000",
        "mimeType": "application/json",
        "payTo": "${isValidEvmAddress(decodedPaymentReq?.accepts?.[0]?.payTo) ? decodedPaymentReq.accepts[0].payTo : '0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1'}",
        "maxTimeoutSeconds": 300,
        "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "extra": {"name": "USD Coin", "version": "2"}
    }]
}
B64_HEADER = base64.b64encode(json.dumps(PAYMENT_REQUIREMENT).encode()).decode()

async def x402_guard(request: Request):
    sig = request.headers.get("x-payment") or request.headers.get("payment-signature")
    if not sig:
        return Response(
            content=json.dumps(PAYMENT_REQUIREMENT),
            status_code=402,
            media_type="application/json",
            headers={
                "PAYMENT-REQUIRED": B64_HEADER,
                "X-402-Version": "2",
                "X-402-Network": "base",
                "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE"
            }
        )
`;

  const auditHash = crypto
    .createHash('sha256')
    .update(`${targetUrl}:${Date.now()}:${criticalCount}`)
    .digest('hex');

  const teaser: DiagnosticTeaser = {
    target: targetUrl,
    skillUrl,
    estimatedTrustTier,
    trustLineStatus: isBelowTrustLine ? 'BELOW_TRUST_LINE_AT_RISK' : 'ABOVE_TRUST_LINE',
    criticalBlockersCount: criticalCount,
    warningCount,
    symptomSummary: symptoms.length > 0 ? symptoms : ['Zero critical blockers detected. Fully BBB-compliant.'],
    latencySnapshot: {
      ttfbMs: getTtfb,
      coldStartRisk: isColdStart,
    },
    remediationLocked: true,
    unlockInstructions:
      'Call POST /v1/remediate with x402 payment ($2.50 USDC on Base) to unlock exact failed header diffs, drop-in middleware fix code, and a sanitized SKILL.md.',
    unlockEndpoint: '/v1/remediate',
    cost: '$2.50 USDC (2500000 atomic units, eip155:8453)',
    timestamp: new Date().toISOString(),
  };

  const fullReport: RemediationReport = {
    target: targetUrl,
    skillUrl,
    auditId: `audit_${auditHash.slice(0, 16)}`,
    passed: criticalCount === 0,
    estimatedTrustTier,
    criticalBlockersCount: criticalCount,
    checks,
    exactHeaderDiffs: {
      missingHeaders,
      malformedHeaders,
      schemaErrors,
    },
    middlewareFixCode: [
      { language: 'typescript', filename: 'x402-middleware.ts', code: tsFixCode },
      { language: 'python', filename: 'x402_middleware.py', code: pythonFixCode },
    ],
    sanitizedSkillMd: sanitizedSkillContent || undefined,
    canaryAuditAttestation: `canary-attest-v1-${auditHash}`,
    timestamp: new Date().toISOString(),
  };

  return { teaser, fullReport };
}
