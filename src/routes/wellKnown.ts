import { Hono } from 'hono';
import { config } from '../config.js';

export const wellKnownRoutes = new Hono();

/**
 * GET /.well-known/x402.json: Full machine-readable catalog listing both
 * our local high-margin endpoints AND referencing the upstream canaryguard-402
 * endpoints under the same payTo wallet family.
 */
wellKnownRoutes.get('/.well-known/x402.json', (c) => {
  const reqUrl = new URL(c.req.url);
  const hostHeader = c.req.header('x-forwarded-host') || c.req.header('host') || reqUrl.host;
  const protoHeader = c.req.header('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
  const baseUrl = `${protoHeader}://${hostHeader}`;

  const catalog = {
    name: 'x402-trustgate',
    description: 'Autonomous AI agent trust verification gate, x402 trust-line auditor, and secure web envelope bridge on Base mainnet.',
    version: config.serviceVersion,
    x402Version: 2,
    facilitator: config.x402FacilitatorUrl,
    payment_recipient: config.payToWallet,
    accepted_tokens: [config.usdcAsset],
    network: config.network,
    chainId: config.chainId,
    wallet_family: {
      payTo: config.payToWallet,
      ecosystem: 'Base Mainnet (eip155:8453)',
      asset: config.usdcAsset,
      assetName: config.usdcName,
      services: ['x402-trustgate', 'CanaryGuard 402'],
    },
    pricing: {
      default_asset: config.usdcAsset,
      network: config.network,
      chainId: config.chainId,
      payTo: config.payToWallet,
    },
    endpoints: [
      // 1. ENGINE 1 (Free Hook): x402 Trust-Line Diagnosis
      {
        id: 'trustline-diagnose',
        name: 'x402 Trust-Line Auditor & Cold-Start Diagnostic (Free Hook)',
        type: 'local',
        method: 'GET',
        url: `${baseUrl}/v1/diagnose`,
        description: 'Runs real live latency probe, dual-method GET/POST check, x402 v2 header validation, and SKILL.md risk scan to assess BBB Trust-Line status.',
        pricing: {
          amount: '0',
          price: 'FREE (200 OK)',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
        inputSchema: {
          type: 'object',
          required: ['target'],
          properties: {
            target: { type: 'string', description: 'Target x402 service URL to probe' },
            skill_url: { type: 'string', description: 'Optional raw URL to SKILL.md for static risk analysis' },
          },
        },
      },

      // 2. ENGINE 1 (Paid Fixer): Deep Remediation & Middleware Patch
      {
        id: 'trustline-remediate',
        name: 'x402 Trust-Line Remediation & Drop-In Fixer ($2.50 USDC)',
        type: 'local',
        method: 'POST',
        url: `${baseUrl}/v1/remediate`,
        description: 'Deep audit returning exact broken header diffs, copy-pasteable TypeScript & Python middleware fixes, and hardened SKILL.md with cryptographic attestation.',
        pricing: {
          amount: '2500000',
          price: '2.50 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
        inputSchema: {
          type: 'object',
          required: ['target'],
          properties: {
            target: { type: 'string', description: 'Target x402 service endpoint URL' },
            skill_url: { type: 'string', description: 'Optional raw URL to SKILL.md' },
          },
        },
      },

      // 3. ENGINE 2: Single-Hop SafeFetch with Cryptographic Envelope
      {
        id: 'safefetch-envelope',
        name: 'Single-Hop SafeFetch & Strict Data Envelope ($0.03 USDC)',
        type: 'local',
        method: 'POST',
        url: `${baseUrl}/v1/safefetch`,
        description: 'Fetches untrusted web pages, strips hidden DOM injection nodes, converts to clean Markdown, and wraps output in a strict cryptographic data role boundary.',
        pricing: {
          amount: '30000',
          price: '0.03 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
        inputSchema: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', description: 'Target public web URL to extract and sanitize' },
            maxContentLength: { type: 'number', default: 50000 },
          },
        },
      },

      // 4. Local High-Margin Endpoint: Trust Verification Gate
      {
        id: 'trust-verify',
        name: 'Agent Trust & Reputation Verification Gate',
        type: 'local',
        method: 'POST',
        url: `${baseUrl}/v1/trust/verify`,
        description: 'Deterministic risk evaluation, identity attestation, sybil resistance, and execution gate for AI agents.',
        pricing: {
          amount: '5000',
          price: '0.005 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
        inputSchema: {
          type: 'object',
          properties: {
            agentAddress: { type: 'string' },
            action: { type: 'string' },
            promptText: { type: 'string' },
          },
        },
      },

      // 5. Local High-Margin Endpoint: Spending & Policy Authorization Gate
      {
        id: 'gate-authorize',
        name: 'Autonomous Action Spending & Policy Authorization Gate',
        type: 'local',
        method: 'POST',
        url: `${baseUrl}/v1/gate/authorize`,
        description: 'Authorizes high-risk execution bounds, token approvals, and tool call policies for autonomous agents.',
        pricing: {
          amount: '10000',
          price: '0.010 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
      },

      // 6. Upstream CanaryGuard Endpoint (Under the same wallet family)
      {
        id: 'canaryguard-sanitize',
        name: 'CanaryGuard Prompt-Injection Firewall & Honeypot Scrubber',
        type: 'upstream-partner',
        method: 'POST',
        url: `${config.upstreamCanaryGuardUrl}/v1/sanitize`,
        bridgeUrl: `${baseUrl}/v1/sanitize`,
        bridgeRedirectStatus: 307,
        description: 'Deterministic prompt-injection firewall and honeypot scrubber for AI agents. Sanitizes untrusted text and blocks detected wallet-draining commands before context ingestion.',
        payment_recipient: config.payToWallet,
        pricing: {
          amount: '3000',
          price: '0.003 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
        inputSchema: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 50000 },
            strict_mode: { type: 'boolean', default: true },
          },
        },
      },

      // 7. Upstream CanaryGuard Base Token bridge
      {
        id: 'canaryguard-base-token',
        name: 'CanaryGuard Base Token Bridge',
        type: 'upstream-partner',
        method: 'ALL',
        url: `${config.upstreamCanaryGuardUrl}/v1/base/token`,
        bridgeUrl: `${baseUrl}/v1/base/token`,
        bridgeRedirectStatus: 307,
        description: 'Base network token analysis and security validation.',
        payment_recipient: config.payToWallet,
      },
    ],
    upstream_bridge: {
      service: 'CanaryGuard 402',
      upstreamUrl: config.upstreamCanaryGuardUrl,
      payTo: config.payToWallet,
      keepAliveInterval: '9 minutes',
      routes: [
        { local: '/v1/sanitize', upstream: `${config.upstreamCanaryGuardUrl}/v1/sanitize`, redirect: 307 },
        { local: '/v1/base/token', upstream: `${config.upstreamCanaryGuardUrl}/v1/base/token`, redirect: 307 },
      ],
    },
    mcp: {
      tools: ['trustgate_diagnose', 'trustgate_remediate', 'trustgate_safefetch', 'canary_sanitize'],
    },
  };

  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(catalog);
});
