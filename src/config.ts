import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Payment Recipient Wallet on Base
  payToWallet: process.env.PAY_TO_WALLET || '0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1',

  // Upstream CanaryGuard instance (for 307 redirects & background keep-alive)
  upstreamCanaryGuardUrl: (process.env.UPSTREAM_CANARYGUARD_URL || 'https://canaryguard-402.onrender.com').replace(/\/+$/, ''),

  // x402 Facilitator service
  x402FacilitatorUrl: (process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator').replace(/\/+$/, ''),

  // Background keep-alive interval in ms (default: 9 minutes)
  keepAliveIntervalMs: (parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES || '9', 10) || 9) * 60 * 1000,

  // Base Mainnet Constants
  network: 'eip155:8453',
  chainId: 8453,
  usdcAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  usdcName: 'USD Coin',
  usdcVersion: '2',
  serviceName: 'x402-trustgate',
  serviceVersion: '1.0.0',
};
