import { Context, MiddlewareHandler } from 'hono';
import { config } from '../config.js';

export interface X402BazaarInfo {
  input: {
    type: 'http';
    method: 'POST' | 'GET';
    body?: Record<string, any>;
    queryParams?: Record<string, any>;
  };
  output: Record<string, any>;
}

export interface X402Options {
  priceUsdc: string;       // e.g. "0.005"
  amountUnits: string;     // e.g. "5000" (USDC has 6 decimals)
  description: string;
  resourcePath?: string;
  maxTimeoutSeconds?: number;
  bazaarInfo?: X402BazaarInfo;
}

export interface X402AcceptItem {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  amount?: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: {
    name: string;
    version: string;
  };
}

export interface X402RequirementPayload {
  x402Version: number;
  error?: string;
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: X402AcceptItem[];
  extensions?: {
    bazaar?: {
      info?: X402BazaarInfo;
    };
  };
}

export interface X402Settlement {
  success: boolean;
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  txHash: string;
  settledAt: string;
  facilitator: string;
  payer?: string;
  error?: string;
}

/**
 * Returns default CDP Bazaar and Roundhouse AI input/output descriptor for a resource path
 */
function getDefaultBazaarInfo(path: string, description: string): X402BazaarInfo {
  if (path.includes('remediate')) {
    return {
      input: {
        type: 'http',
        method: 'POST',
        body: {
          target: 'https://api.example.com/v1/paid-route',
          skill_url: 'https://raw.githubusercontent.com/owner/repo/main/SKILL.md',
        },
      },
      output: {
        status: 'success',
        remediation: {
          target: 'https://api.example.com/v1/paid-route',
          passed: true,
          exactHeaderDiffs: { missingHeaders: [], malformedHeaders: {}, schemaErrors: [] },
          middlewareFixCode: [
            { language: 'typescript', filename: 'x402-middleware.ts', code: '...' },
            { language: 'python', filename: 'x402_middleware.py', code: '...' },
          ],
        },
      },
    };
  }
  if (path.includes('harden-skill')) {
    return {
      input: {
        type: 'http',
        method: 'POST',
        body: {
          skill: 'find-people',
          raw_skill: '---\nname: my-skill\n---\nProvide wallet signer...',
        },
      },
      output: {
        status: 'success',
        hardenedSkill: '---\nname: my-skill\n---\nProvide managed x402 signer...',
        fixesApplied: ['REPLACED_KEYS_TRIGGERS', 'ADDED_CANARYGUARD_PREFLIGHT'],
      },
    };
  }
  if (path.includes('safefetch')) {
    return {
      input: {
        type: 'http',
        method: 'POST',
        body: {
          url: 'https://example.com/article',
        },
      },
      output: {
        status: 'success',
        data: {
          envelope: '<untrusted_data_envelope nonce="..." role="external_untrusted_data" url="...">...</untrusted_data_envelope>',
          threatScore: 0,
          cleanMarkdown: 'Clean markdown text',
        },
      },
    };
  }
  return {
    input: {
      type: 'http',
      method: 'POST',
      body: {
        agentAddress: '0x1111111111111111111111111111111111111111',
        action: 'transfer_usdc',
      },
    },
    output: {
      status: 'success',
      evaluation: {
        status: 'approved',
        riskLevel: 'clean',
      },
    },
  };
}

export const DEFAULT_PAY_TO_WALLET = '0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1';

/**
 * Creates dual-compatible x402 V1 + V2 payment enforcement middleware
 */
export const x402Payment = (options: X402Options): MiddlewareHandler => {
  return async (c: Context, next) => {
    // Determine canonical resource URL
    const reqUrl = new URL(c.req.url);
    const hostHeader = c.req.header('x-forwarded-host') || c.req.header('host') || reqUrl.host;
    const protoHeader = c.req.header('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
    const path = options.resourcePath || reqUrl.pathname;
    const resourceUrl = `${protoHeader}://${hostHeader}${path}`;

    const maxTimeout = options.maxTimeoutSeconds || 300;
    const payToWallet = process.env.PAY_TO_WALLET || config.payToWallet || DEFAULT_PAY_TO_WALLET;

    const acceptItem: X402AcceptItem = {
      scheme: 'exact',
      network: config.network, // eip155:8453
      maxAmountRequired: options.amountUnits,
      amount: options.amountUnits,
      resource: resourceUrl,
      description: options.description,
      mimeType: 'application/json',
      payTo: payToWallet,
      maxTimeoutSeconds: maxTimeout,
      asset: config.usdcAsset, // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
      extra: {
        name: config.usdcName,
        version: config.usdcVersion,
      },
    };

    const bazaarInfo = options.bazaarInfo || getDefaultBazaarInfo(path, options.description);

    const requirementPayload: X402RequirementPayload = {
      x402Version: 2,
      error: 'Payment required',
      resource: {
        url: resourceUrl,
        description: options.description,
        mimeType: 'application/json',
      },
      accepts: [acceptItem],
      extensions: {
        bazaar: {
          info: bazaarInfo,
        },
      },
    };

    const base64Requirement = Buffer.from(
      JSON.stringify(requirementPayload)
    ).toString('base64');

    // Extract payment authorization headers
    const rawPayment =
      c.req.header('x-payment') ||
      c.req.header('payment-signature') ||
      c.req.header('X-PAYMENT') ||
      c.req.header('PAYMENT-SIGNATURE');

    let paymentHeader = rawPayment?.trim();

    // Check Authorization: Bearer <x402-token> or Authorization: x402 <token>
    if (!paymentHeader) {
      const auth = c.req.header('authorization');
      if (auth) {
        if (auth.toLowerCase().startsWith('bearer ')) {
          paymentHeader = auth.slice(7).trim();
        } else if (auth.toLowerCase().startsWith('x402 ')) {
          paymentHeader = auth.slice(5).trim();
        }
      }
    }

    // 1. UNAUTHENTICATED REQUEST: Return 402 in < 50ms (purely in-memory, zero network overhead)
    if (!paymentHeader) {
      // Set all x402 standard response headers
      c.header('PAYMENT-REQUIRED', base64Requirement);
      c.header('X-Payment-Required', base64Requirement);
      c.header('X-402-Version', '2');
      c.header('X-402-Payment-To', payToWallet);
      c.header('X-402-Amount', options.priceUsdc);
      c.header('X-402-Amount-Units', options.amountUnits);
      c.header('X-402-Asset', config.usdcAsset);
      c.header('X-402-Network', 'base');
      c.header('X-402-Chain-Id', String(config.chainId));
      c.header('Cache-Control', 'no-store');

      return c.json(
        {
          x402Version: 2,
          accepts: [acceptItem],
          extensions: {
            bazaar: {
              info: bazaarInfo,
            },
          },
        },
        402
      );
    }

    // 2. PAYMENT HEADER PRESENT: Verify signature against Facilitator
    try {
      const settlement = await verifyPaymentWithFacilitator({
        payment: paymentHeader,
        requirement: acceptItem,
        resource: resourceUrl,
      });

      if (!settlement.success) {
        return c.json(
          {
            x402Version: 2,
            error: 'payment_verification_failed',
            details: settlement.error || 'The provided x402 payment signature could not be verified by the facilitator.',
          },
          402
        );
      }

      // Attach settlement response headers
      const settlementEncoded = Buffer.from(JSON.stringify(settlement)).toString('base64');
      c.header('PAYMENT-RESPONSE', settlementEncoded);
      c.header('X-Payment-Response', settlementEncoded);
      c.header('X-PAYMENT-RESPONSE', settlementEncoded);
      c.header('X-402-Version', '2');

      // Store settlement context for route handler
      c.set('x402Settlement', settlement);

      // Proceed to the protected business logic
      return await next();
    } catch (err: any) {
      console.error('[x402] Error verifying payment with facilitator:', err);
      return c.json(
        {
          x402Version: 2,
          error: 'payment_verification_failed',
          details: err?.message || 'Error communicating with x402 facilitator',
        },
        402
      );
    }
  };
};

/**
 * Communicates with the x402 Facilitator to verify signature & settle payment on Base mainnet
 */
async function verifyPaymentWithFacilitator(params: {
  payment: string;
  requirement: X402AcceptItem;
  resource: string;
}): Promise<X402Settlement> {
  const facilitatorBase = config.x402FacilitatorUrl;
  const payToWallet = process.env.PAY_TO_WALLET || config.payToWallet || DEFAULT_PAY_TO_WALLET;

  // 1. ISOLATE TEST BYPASS STRICTLY TO NODE_ENV === 'test'
  if (process.env.NODE_ENV === 'test') {
    if (
      params.payment.startsWith('test_simulated_payment_') ||
      params.payment === 'valid_test_signature' ||
      process.env.SIMULATE_SETTLEMENT === 'true'
    ) {
      return {
        success: true,
        network: config.network,
        asset: config.usdcAsset,
        payTo: payToWallet,
        amount: params.requirement.maxAmountRequired,
        txHash: `0xsimulated_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`,
        settledAt: new Date().toISOString(),
        facilitator: facilitatorBase,
        payer: '0x1111111111111111111111111111111111111111',
      };
    }
  }

  // 2. ENFORCE REAL FACILITATOR /verify AND /settle ON BASE MAINNET (when NODE_ENV !== 'test')
  let paymentPayload: any = null;
  try {
    const decoded = Buffer.from(params.payment, 'base64').toString('utf-8');
    paymentPayload = JSON.parse(decoded);
  } catch {
    try {
      paymentPayload = JSON.parse(params.payment);
    } catch {
      paymentPayload = { signature: params.payment };
    }
  }

  // Facilitator endpoint URLs
  const baseUrl = facilitatorBase.replace(/\/(verify|settle)$/, '');
  const verifyUrl = `${baseUrl}/verify`;
  const settleUrl = `${baseUrl}/settle`;

  const requestPayload = {
    paymentPayload,
    payment: params.payment,
    paymentHeader: params.payment,
    paymentRequirements: params.requirement,
    requirements: params.requirement,
    resource: params.resource,
    network: config.network,
    asset: config.usdcAsset,
    payTo: payToWallet,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Step 1: POST to /verify
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'x402-trustgate/1.0',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    if (!verifyRes.ok) {
      const errText = await verifyRes.text().catch(() => '');
      clearTimeout(timeout);
      return {
        success: false,
        network: config.network,
        asset: config.usdcAsset,
        payTo: payToWallet,
        amount: params.requirement.maxAmountRequired,
        txHash: '',
        settledAt: '',
        facilitator: facilitatorBase,
        error: `Facilitator verification rejected (HTTP ${verifyRes.status}): ${errText || verifyRes.statusText}`,
      };
    }

    const verifyData: any = await verifyRes.json();
    const isValid = verifyData.isValid === true || verifyData.valid === true;

    if (!isValid) {
      clearTimeout(timeout);
      return {
        success: false,
        network: config.network,
        asset: config.usdcAsset,
        payTo: payToWallet,
        amount: params.requirement.maxAmountRequired,
        txHash: '',
        settledAt: '',
        facilitator: facilitatorBase,
        error: verifyData.error || verifyData.reason || 'Payment signature verification failed',
      };
    }

    // Step 2: POST to /settle
    const settleRes = await fetch(settleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'x402-trustgate/1.0',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!settleRes.ok) {
      const errText = await settleRes.text().catch(() => '');
      return {
        success: false,
        network: config.network,
        asset: config.usdcAsset,
        payTo: payToWallet,
        amount: params.requirement.maxAmountRequired,
        txHash: '',
        settledAt: '',
        facilitator: facilitatorBase,
        error: `Facilitator settlement rejected (HTTP ${settleRes.status}): ${errText || settleRes.statusText}`,
      };
    }

    const settleData: any = await settleRes.json();
    const isSuccess =
      (settleData.success === true || settleData.isValid === true) &&
      Boolean(settleData.txHash || settleData.transaction || settleData.transactionHash);

    if (!isSuccess) {
      return {
        success: false,
        network: config.network,
        asset: config.usdcAsset,
        payTo: payToWallet,
        amount: params.requirement.maxAmountRequired,
        txHash: '',
        settledAt: '',
        facilitator: facilitatorBase,
        error: settleData.error || settleData.reason || 'Payment settlement confirmation failed',
      };
    }

    const txHash =
      settleData.txHash ||
      settleData.transaction ||
      settleData.transactionHash ||
      settleData.receipt?.transactionHash;

    return {
      success: true,
      network: settleData.network || config.network,
      asset: settleData.asset || config.usdcAsset,
      payTo: payToWallet,
      amount: settleData.amount || params.requirement.maxAmountRequired,
      txHash,
      settledAt: settleData.settledAt || new Date().toISOString(),
      facilitator: facilitatorBase,
      payer: settleData.payer || settleData.signer || paymentPayload?.payer,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      success: false,
      network: config.network,
      asset: config.usdcAsset,
      payTo: payToWallet,
      amount: params.requirement.maxAmountRequired,
      txHash: '',
      settledAt: '',
      facilitator: facilitatorBase,
      error: err?.message || 'Error communicating with x402 facilitator',
    };
  }
}
