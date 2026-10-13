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
    description: 'Autonomous AI agent trust verification gate, sybil resistance, policy authorization, and security bridge on Base mainnet.',
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
      // 1. Local High-Margin Endpoint: Trust Verification Gate
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
            agentAddress: { type: 'string', description: 'Agent EVM address or signer wallet' },
            action: { type: 'string', description: 'Action type to evaluate (e.g. transfer, call, sign)' },
            promptText: { type: 'string', description: 'Agent prompt or instruction text to audit' },
            targetAddress: { type: 'string', description: 'Target contract or destination address' },
            callerDomain: { type: 'string', description: 'Origin domain or tool calling origin' },
          },
        },
        extensions: {
          bazaar: {
            info: {
              input: {
                type: 'http',
                bodyType: 'json',
                body: {
                  agentAddress: '0x1111111111111111111111111111111111111111',
                  action: 'execute_swap',
                  promptText: 'Check agent credentials and verify allowance limits',
                },
              },
              output: {
                type: 'json',
                example: {
                  status: 'approved',
                  trustScore: 0.98,
                  riskLevel: 'clean',
                  verdict: 'Agent passed reputation and policy gate.',
                  receipt: 'trustgate-v1-abcdef0123456789',
                },
              },
            },
          },
        },
      },

      // 2. Local High-Margin Endpoint: Spending & Policy Authorization Gate
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
        inputSchema: {
          type: 'object',
          properties: {
            agentAddress: { type: 'string' },
            action: { type: 'string' },
            targetAddress: { type: 'string' },
            params: { type: 'object' },
          },
        },
      },

      // 3. Local High-Margin Endpoint: Reputation Score
      {
        id: 'trust-score',
        name: 'Agent Wallet Trust Score',
        type: 'local',
        method: 'GET',
        url: `${baseUrl}/v1/trust/score`,
        description: 'Instant on-chain and behavioral trust metric calculation for agent addresses.',
        pricing: {
          amount: '2000',
          price: '0.002 USDC',
          asset: config.usdcAsset,
          network: config.network,
          chainId: config.chainId,
          payTo: config.payToWallet,
        },
      },

      // 4. Upstream CanaryGuard Endpoint (Under the same wallet family)
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

      // 5. Upstream CanaryGuard Base Token bridge
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
      tools: ['trustgate_verify', 'trustgate_authorize', 'canary_sanitize'],
    },
  };

  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(catalog);
});
