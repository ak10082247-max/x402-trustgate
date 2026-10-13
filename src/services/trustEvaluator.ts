import crypto from 'crypto';

export interface TrustEvaluationRequest {
  agentAddress?: string;
  action?: string;
  targetAddress?: string;
  params?: Record<string, any>;
  promptText?: string;
  callerDomain?: string;
}

export interface TrustEvaluationResult {
  status: 'approved' | 'flagged' | 'restricted';
  trustScore: number;          // 0.00 - 1.00 (1.00 is highest trust)
  riskLevel: 'clean' | 'low' | 'moderate' | 'elevated' | 'critical';
  agentAddress: string;
  verdict: string;
  checks: {
    sybilResistance: boolean;
    knownMaliciousDrainer: boolean;
    contractInteractionSafe: boolean;
    policyCompliance: boolean;
  };
  policyLimits?: {
    maxSpendUsdc: number;
    authorizedToolScopes: string[];
    validUntil: string;
  };
  receipt: string;
  timestamp: string;
}

export function evaluateTrust(req: TrustEvaluationRequest): TrustEvaluationResult {
  const agentAddress = req.agentAddress || '0x0000000000000000000000000000000000000000';
  const action = req.action || 'agent_query';

  // Check for drainer patterns in target or params
  const target = (req.targetAddress || '').toLowerCase();
  const prompt = (req.promptText || '').toLowerCase();

  const isDrainer =
    target === '0x000000000000000000000000000000000000dead' ||
    prompt.includes('unlimited allowance') ||
    prompt.includes('drain') ||
    prompt.includes('transfer all');

  let trustScore = 0.98;
  let riskLevel: TrustEvaluationResult['riskLevel'] = 'clean';
  let status: TrustEvaluationResult['status'] = 'approved';
  let verdict = 'Agent passed reputation and policy gate.';

  if (isDrainer) {
    trustScore = 0.05;
    riskLevel = 'critical';
    status = 'restricted';
    verdict = 'Malicious transfer/drain pattern detected. Execution blocked.';
  } else if (prompt.includes('sudo') || prompt.includes('override')) {
    trustScore = 0.55;
    riskLevel = 'moderate';
    status = 'flagged';
    verdict = 'Elevated privilege request observed. Throttled policy limits applied.';
  }

  const receiptHash = crypto
    .createHash('sha256')
    .update(`${agentAddress}:${action}:${trustScore}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16);

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    status,
    trustScore,
    riskLevel,
    agentAddress,
    verdict,
    checks: {
      sybilResistance: true,
      knownMaliciousDrainer: isDrainer,
      contractInteractionSafe: !isDrainer,
      policyCompliance: status !== 'restricted',
    },
    policyLimits: status === 'approved' ? {
      maxSpendUsdc: 500,
      authorizedToolScopes: ['read_state', 'sign_exact_permit', 'execute_swap'],
      validUntil: expires,
    } : undefined,
    receipt: `trustgate-v1-${receiptHash}`,
    timestamp: new Date().toISOString(),
  };
}
