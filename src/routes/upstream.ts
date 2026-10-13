import { Hono } from 'hono';
import { config } from '../config.js';

export const upstreamRoutes = new Hono();

/**
 * HTTP 307 Temporary Redirect routes pointing directly to upstream CanaryGuard-402.
 * HTTP 307 guarantees that HTTP methods (POST, GET, etc.), request bodies, and
 * critical x402 payment headers (X-PAYMENT, PAYMENT-SIGNATURE, Authorization)
 * are preserved intact when the client follows the redirect to the original service.
 */

// Upstream CanaryGuard sanitize bridge
upstreamRoutes.all('/v1/sanitize', (c) => {
  const reqUrl = new URL(c.req.url);
  const targetUrl = `${config.upstreamCanaryGuardUrl}/v1/sanitize${reqUrl.search}`;
  
  c.header('Location', targetUrl);
  c.header('X-Upstream-Bridge', 'canaryguard-402');
  return c.redirect(targetUrl, 307);
});

// Upstream Base token bridge
upstreamRoutes.all('/v1/base/token', (c) => {
  const reqUrl = new URL(c.req.url);
  const targetUrl = `${config.upstreamCanaryGuardUrl}/v1/base/token${reqUrl.search}`;
  
  c.header('Location', targetUrl);
  c.header('X-Upstream-Bridge', 'canaryguard-402');
  return c.redirect(targetUrl, 307);
});
