import { Hono } from 'hono';
import { x402Payment, X402Settlement } from '../middleware/x402.js';
import { runDiagnostics } from '../services/diagnostics.js';

type AuditorEnv = {
  Variables: {
    x402Settlement?: X402Settlement;
  };
};

export const auditorRoutes = new Hono<AuditorEnv>();

// Middleware for $2.50 USDC remediation
const remediationMiddleware = x402Payment({
  priceUsdc: '2.50',
  amountUnits: '2500000', // $2.50 USDC (6 decimals = 2,500,000 units)
  description: 'Complete x402 Trust-Line deep audit, header diffs, custom middleware patch, and sanitized SKILL.md.',
  resourcePath: '/v1/remediate',
});

/**
 * 1. GET /v1/diagnose (FREE HOOK - 200 OK, zero payment required)
 * Runs live diagnostic probe against target and returns teaser.
 */
auditorRoutes.get('/v1/diagnose', async (c) => {
  const target = c.req.query('target');
  const skillUrl = c.req.query('skill_url') || c.req.query('skillUrl');

  if (!target) {
    return c.json(
      {
        error: 'missing_target_url',
        message: 'Query parameter "target" is required (e.g. /v1/diagnose?target=https://api.example.com/v1/paid-route)',
      },
      400
    );
  }

  try {
    const { teaser } = await runDiagnostics(target, skillUrl);
    return c.json(teaser, 200);
  } catch (err: any) {
    return c.json(
      {
        error: 'diagnostic_failed',
        message: err?.message || 'Failed to probe target URL',
        target,
      },
      400
    );
  }
});

/**
 * 2. POST /v1/remediate & GET /v1/remediate (PAID $2.50 USDC = 2500000 units on Base)
 * Unlocks deep scan, exact header diffs, custom middleware fix, and sanitized SKILL.md.
 */
auditorRoutes.get('/v1/remediate', remediationMiddleware, async (c) => {
  const target = c.req.query('target');
  const skillUrl = c.req.query('skill_url') || c.req.query('skillUrl');

  if (!target) {
    return c.json(
      {
        error: 'missing_target_url',
        message: 'Query parameter "target" or POST JSON body is required for remediation.',
      },
      400
    );
  }

  try {
    const { fullReport } = await runDiagnostics(target, skillUrl);
    return c.json(
      {
        status: 'success',
        settlement: c.get('x402Settlement'),
        remediation: fullReport,
      },
      200
    );
  } catch (err: any) {
    return c.json(
      {
        error: 'remediation_probe_failed',
        message: err?.message || 'Error executing full remediation audit',
      },
      400
    );
  }
});

auditorRoutes.post('/v1/remediate', remediationMiddleware, async (c) => {
  let body: { target?: string; skill_url?: string; skillUrl?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const target = body.target || c.req.query('target');
  const skillUrl = body.skill_url || body.skillUrl || c.req.query('skill_url') || c.req.query('skillUrl');

  if (!target) {
    return c.json(
      {
        error: 'missing_target_url',
        message: 'JSON body property "target" is required (e.g. { "target": "https://api.example.com/v1/paid" }).',
      },
      400
    );
  }

  try {
    const { fullReport } = await runDiagnostics(target, skillUrl);
    return c.json(
      {
        status: 'success',
        settlement: c.get('x402Settlement'),
        remediation: fullReport,
      },
      200
    );
  } catch (err: any) {
    return c.json(
      {
        error: 'remediation_probe_failed',
        message: err?.message || 'Error executing full remediation audit',
      },
      400
    );
  }
});
