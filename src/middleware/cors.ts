import { MiddlewareHandler } from 'hono';

export const corsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    // Set permissive CORS for agent indexers & client SDKs
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-PAYMENT, PAYMENT-SIGNATURE, X-Payment, Payment-Signature, x-402-version, X-Requested-With, Range'
    );
    c.header(
      'Access-Control-Expose-Headers',
      'WWW-Authenticate, X-PAYMENT, PAYMENT-SIGNATURE, X-402-Version, Location, PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Required, X-Payment-Response, EXTENSION-RESPONSES, Idempotency-Replayed, X-402-Payment-To, X-402-Amount, X-402-Amount-Units, X-402-Asset, X-402-Network, X-402-Chain-Id, X-Request-Id'
    );

    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();
  };
};
