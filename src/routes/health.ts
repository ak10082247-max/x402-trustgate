import { Hono } from 'hono';
import { config } from '../config.js';
import { getUpstreamStatus } from '../services/keepAlive.js';

export const healthRoutes = new Hono();

/**
 * GET /health: Instant 200 OK JSON with uptime and upstream CanaryGuard reachability status
 */
healthRoutes.get('/health', (c) => {
  const upstream = getUpstreamStatus();

  return c.json({
    status: 'healthy',
    service: config.serviceName,
    version: config.serviceVersion,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    payToWallet: config.payToWallet,
    network: config.network,
    chainId: config.chainId,
    asset: config.usdcAsset,
    facilitator: config.x402FacilitatorUrl,
    upstream: {
      url: upstream.url,
      reachable: upstream.reachable,
      lastPing: upstream.lastPing,
      statusCode: upstream.statusCode,
      latencyMs: upstream.latencyMs,
      consecutiveFailures: upstream.consecutiveFailures,
      lastError: upstream.lastError,
    },
  }, 200);
});
