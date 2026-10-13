import { Hono } from 'hono';
import { config } from './config.js';
import { corsMiddleware } from './middleware/cors.js';
import { healthRoutes } from './routes/health.js';
import { wellKnownRoutes } from './routes/wellKnown.js';
import { upstreamRoutes } from './routes/upstream.js';
import { trustgateRoutes } from './routes/trustgate.js';
import { auditorRoutes } from './routes/auditor.js';
import { safeFetchRoutes } from './routes/safeFetchRoute.js';

export const app = new Hono();

// Global CORS middleware
app.use('*', corsMiddleware());

// High-speed response timing logger
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const elapsed = (performance.now() - start).toFixed(2);
  c.header('X-Response-Time-Ms', elapsed);
  c.header('X-Service', config.serviceName);
});

// Root landing & metadata summary
app.get('/', (c) => {
  return c.json({
    service: config.serviceName,
    version: config.serviceVersion,
    description: 'Autonomous AI agent trust verification gate & Base mainnet x402 revenue service',
    network: config.network,
    chainId: config.chainId,
    asset: config.usdcAsset,
    payToWallet: config.payToWallet,
    discovery: '/.well-known/x402.json',
    health: '/health',
    upstreamBridge: {
      url: config.upstreamCanaryGuardUrl,
      endpoints: ['/v1/sanitize', '/v1/base/token'],
      redirectCode: 307,
    },
    localEndpoints: [
      { path: '/v1/diagnose', methods: ['GET'], price: 'FREE (200 OK)', description: 'x402 Trust-Line latency, dual-method, and header audit hook' },
      { path: '/v1/remediate', methods: ['GET', 'POST'], price: '0.95 USDC', description: 'Unlock header diffs, custom drop-in middleware patch, and sanitized SKILL.md' },
      { path: '/v1/harden-skill', methods: ['GET', 'POST'], price: '0.85 USDC', description: 'De-flag and harden raw SKILL.md for ClawHub and AgentEconomy static scanner compliance' },
      { path: '/v1/safefetch', methods: ['GET', 'POST'], price: '0.03 USDC', description: 'Single-hop DOM injection-stripped web fetcher with cryptographic data envelope' },
      { path: '/v1/trust/verify', methods: ['GET', 'POST'], price: '0.005 USDC', description: 'AI agent trust & sybil resistance gate' },
      { path: '/v1/gate/authorize', methods: ['GET', 'POST'], price: '0.010 USDC', description: 'Agent spending & policy gate' },
      { path: '/v1/trust/score', methods: ['GET', 'POST'], price: '0.002 USDC', description: 'Instant wallet reputation metrics' },
    ],
  });
});

// Mount modular sub-routers
app.route('', healthRoutes);
app.route('', wellKnownRoutes);
app.route('', upstreamRoutes);
app.route('', trustgateRoutes);
app.route('', auditorRoutes);
app.route('', safeFetchRoutes);

// Fallback 404 handler
app.notFound((c) => {
  return c.json({ error: 'not_found', path: c.req.path }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('[x402-trustgate] Unhandled error:', err);
  return c.json({ error: 'internal_server_error', message: err.message }, 500);
});
