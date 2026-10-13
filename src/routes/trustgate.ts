import { Hono } from 'hono';
import { x402Payment, X402Settlement } from '../middleware/x402.js';
import { evaluateTrust, TrustEvaluationRequest } from '../services/trustEvaluator.js';

type TrustgateEnv = {
  Variables: {
    x402Settlement?: X402Settlement;
  };
};

export const trustgateRoutes = new Hono<TrustgateEnv>();

// Middleware instances for high-margin endpoints
const verifyMiddleware = x402Payment({
  priceUsdc: '0.005',
  amountUnits: '5000',
  description: 'Real-time AI agent trust score, sybil-resistance assessment, and contract authorization validation gate.',
  resourcePath: '/v1/trust/verify',
});

const gateMiddleware = x402Payment({
  priceUsdc: '0.010',
  amountUnits: '10000',
  description: 'Autonomous agent execution gateway authorizing high-risk financial transfers, token approvals, and tool call policies.',
  resourcePath: '/v1/gate/authorize',
});

const scoreMiddleware = x402Payment({
  priceUsdc: '0.002',
  amountUnits: '2000',
  description: 'Instant agent wallet reputation score and historical trust metrics on Base mainnet.',
  resourcePath: '/v1/trust/score',
});

// 1. /v1/trust/verify - GET & POST (Dual Support)
trustgateRoutes.get('/v1/trust/verify', verifyMiddleware, (c) => {
  const query = c.req.query();
  const evaluation = evaluateTrust({
    agentAddress: query.agentAddress,
    action: query.action,
    promptText: query.promptText,
  });

  return c.json({
    status: 'success',
    settlement: c.get('x402Settlement'),
    evaluation,
  });
});

trustgateRoutes.post('/v1/trust/verify', verifyMiddleware, async (c) => {
  let body: TrustEvaluationRequest = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const evaluation = evaluateTrust(body);

  return c.json({
    status: 'success',
    settlement: c.get('x402Settlement'),
    evaluation,
  });
});

// 2. /v1/gate/authorize - GET & POST (Dual Support)
trustgateRoutes.get('/v1/gate/authorize', gateMiddleware, (c) => {
  const query = c.req.query();
  const evaluation = evaluateTrust({
    agentAddress: query.agentAddress,
    action: query.action || 'authorize_high_risk_policy',
    targetAddress: query.targetAddress,
  });

  return c.json({
    status: 'authorized',
    settlement: c.get('x402Settlement'),
    authorization: {
      permitId: `permit_${Date.now()}`,
      evaluation,
    },
  });
});

trustgateRoutes.post('/v1/gate/authorize', gateMiddleware, async (c) => {
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const evaluation = evaluateTrust(body);

  return c.json({
    status: evaluation.status === 'approved' ? 'authorized' : 'denied',
    settlement: c.get('x402Settlement'),
    authorization: {
      permitId: `permit_${Date.now()}`,
      evaluation,
    },
  });
});

// 3. /v1/trust/score - GET & POST (Dual Support)
trustgateRoutes.get('/v1/trust/score', scoreMiddleware, (c) => {
  const agentAddress = c.req.query('agentAddress') || '0x0000000000000000000000000000000000000000';
  const evaluation = evaluateTrust({ agentAddress });

  return c.json({
    agentAddress,
    trustScore: evaluation.trustScore,
    riskLevel: evaluation.riskLevel,
    receipt: evaluation.receipt,
    settlement: c.get('x402Settlement'),
  });
});

trustgateRoutes.post('/v1/trust/score', scoreMiddleware, async (c) => {
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const agentAddress = body.agentAddress || '0x0000000000000000000000000000000000000000';
  const evaluation = evaluateTrust({ agentAddress });

  return c.json({
    agentAddress,
    trustScore: evaluation.trustScore,
    riskLevel: evaluation.riskLevel,
    receipt: evaluation.receipt,
    settlement: c.get('x402Settlement'),
  });
});
