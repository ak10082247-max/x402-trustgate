import { Hono } from 'hono';
import { x402Payment, X402Settlement } from '../middleware/x402.js';
import { runDiagnostics } from '../services/diagnostics.js';
import { hardenSkillMd } from '../services/skillHardener.js';

type AuditorEnv = {
  Variables: {
    x402Settlement?: X402Settlement;
  };
};

export const auditorRoutes = new Hono<AuditorEnv>();

// Middleware for $0.95 USDC remediation (avoids the > $1.00 Agent Economy Report delisting trap)
const remediationMiddleware = x402Payment({
  priceUsdc: '0.95',
  amountUnits: '950000', // $0.95 USDC (6 decimals = 950,000 units on Base eip155:8453)
  description: 'Complete x402 Trust-Line deep audit, header diffs, custom middleware patch, and sanitized SKILL.md.',
  resourcePath: '/v1/remediate',
});

// Middleware for $0.85 USDC skill hardening
const hardenSkillMiddleware = x402Payment({
  priceUsdc: '0.85',
  amountUnits: '850000', // $0.85 USDC (6 decimals = 850,000 units on Base eip155:8453)
  description: 'De-flag and harden raw SKILL.md for ClawHub and AgentEconomy static scanner compliance.',
  resourcePath: '/v1/harden-skill',
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
 * 2. POST /v1/remediate & GET /v1/remediate (PAID $0.95 USDC = 950000 units on Base)
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

/**
 * 3. POST /v1/harden-skill & GET /v1/harden-skill (PAID $0.85 USDC = 850000 units on Base)
 * Takes a raw SKILL.md string or URL and returns a de-flagged, static-scanner-compliant SKILL.md.
 */
auditorRoutes.get('/v1/harden-skill', hardenSkillMiddleware, async (c) => {
  const skillUrl = c.req.query('skill_url') || c.req.query('url');

  if (!skillUrl) {
    return c.json(
      {
        error: 'missing_skill_input',
        message: 'Query parameter "skill_url" or POST JSON body with "skill_content" is required.',
      },
      400
    );
  }

  try {
    const res = await fetch(skillUrl, { headers: { 'User-Agent': 'x402-trustgate/1.0' } });
    if (!res.ok) {
      throw new Error(`Failed to fetch SKILL.md from ${skillUrl} (HTTP ${res.status})`);
    }
    const rawContent = await res.text();
    const result = hardenSkillMd(rawContent);

    return c.json({
      status: 'success',
      settlement: c.get('x402Settlement'),
      result,
    });
  } catch (err: any) {
    return c.json(
      {
        error: 'harden_skill_failed',
        message: err?.message || 'Error hardening SKILL.md',
      },
      400
    );
  }
});

auditorRoutes.post('/v1/harden-skill', hardenSkillMiddleware, async (c) => {
  let body: {
    skill_content?: string;
    skillContent?: string;
    raw_skill?: string;
    rawSkill?: string;
    content?: string;
    skill_url?: string;
    url?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  let rawContent =
    body.raw_skill ||
    body.rawSkill ||
    body.skill_content ||
    body.skillContent ||
    body.content;
  const skillUrl = body.skill_url || body.url || c.req.query('skill_url') || c.req.query('url');

  if (!rawContent && skillUrl) {
    try {
      const res = await fetch(skillUrl, { headers: { 'User-Agent': 'x402-trustgate/1.0' } });
      if (!res.ok) {
        throw new Error(`Failed to fetch SKILL.md from ${skillUrl} (HTTP ${res.status})`);
      }
      rawContent = await res.text();
    } catch (err: any) {
      return c.json(
        {
          error: 'fetch_failed',
          message: err?.message || 'Failed to fetch SKILL.md from provided URL',
        },
        400
      );
    }
  }

  if (!rawContent) {
    return c.json(
      {
        error: 'missing_skill_content',
        message: 'Provide "raw_skill", "skill_content", or "skill_url" in JSON body.',
      },
      400
    );
  }

  const result = hardenSkillMd(rawContent);

  return c.json({
    status: 'success',
    settlement: c.get('x402Settlement'),
    hardenedSkill: result.hardenedSkill,
    fixesApplied: result.changesMade,
    result,
  });
});
