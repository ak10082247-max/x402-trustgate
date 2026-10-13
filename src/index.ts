import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { startKeepAlive, stopKeepAlive } from './services/keepAlive.js';

export { app };

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  (info) => {
    console.log(`====================================================`);
    console.log(`🚀 [x402-trustgate] Server online at http://${info.address}:${info.port}`);
    console.log(`💳 Pay-To Wallet:    ${config.payToWallet}`);
    console.log(`🌐 Network:          ${config.network} (Base Mainnet)`);
    console.log(`🪙 Asset:            USDC (${config.usdcAsset})`);
    console.log(`🔗 Upstream URL:     ${config.upstreamCanaryGuardUrl}`);
    console.log(`🧭 Discovery:        http://${info.address}:${info.port}/.well-known/x402.json`);
    console.log(`====================================================`);

    // Start background keep-alive bridge for upstream Render service
    startKeepAlive();
  }
);

const shutdown = () => {
  console.log('\n[x402-trustgate] Shutting down gracefully...');
  stopKeepAlive();
  server.close(() => {
    console.log('[x402-trustgate] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
