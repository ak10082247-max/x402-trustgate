import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { config } from '../src/config.js';

test('1. Health route: GET /health returns 200 OK with uptime and upstream status', async () => {
  const res = await app.request('/health');
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.service, 'x402-trustgate');
  assert.equal(data.payToWallet, config.payToWallet);
  assert.equal(data.network, 'eip155:8453');
  assert.equal(data.asset, config.usdcAsset);
  assert.ok(data.upstream);
  assert.equal(data.upstream.url, config.upstreamCanaryGuardUrl);
});

test('2. Upstream Bridge: GET and POST /v1/sanitize return 307 Temporary Redirect', async () => {
  // GET /v1/sanitize
  const getRes = await app.request('/v1/sanitize');
  assert.equal(getRes.status, 307);
  assert.equal(
    getRes.headers.get('location'),
    `${config.upstreamCanaryGuardUrl}/v1/sanitize`
  );

  // POST /v1/sanitize with JSON body and payment headers preserved
  const postRes = await app.request('/v1/sanitize?strict_mode=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': 'dummy_payment_sig',
    },
    body: JSON.stringify({ content: 'Test text' }),
  });
  assert.equal(postRes.status, 307);
  assert.equal(
    postRes.headers.get('location'),
    `${config.upstreamCanaryGuardUrl}/v1/sanitize?strict_mode=true`
  );
});

test('3. Upstream Bridge: ALL /v1/base/token returns 307 Temporary Redirect', async () => {
  const res = await app.request('/v1/base/token');
  assert.equal(res.status, 307);
  assert.equal(
    res.headers.get('location'),
    `${config.upstreamCanaryGuardUrl}/v1/base/token`
  );
});

test('4. Dual-compatible x402: GET /v1/trust/verify returns 402 in < 50ms with valid x402 headers & body', async () => {
  const start = performance.now();
  const res = await app.request('/v1/trust/verify');
  const elapsed = performance.now() - start;

  assert.equal(res.status, 402);
  assert.ok(elapsed < 50, `Expected response under 50ms, got ${elapsed.toFixed(2)}ms`);

  // Verify headers
  const paymentRequiredHeader = res.headers.get('PAYMENT-REQUIRED');
  assert.ok(paymentRequiredHeader, 'PAYMENT-REQUIRED header must be present');

  const decodedHeader = JSON.parse(
    Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')
  );
  assert.equal(decodedHeader.x402Version, 2);
  assert.equal(decodedHeader.accepts[0].network, 'eip155:8453');
  assert.equal(decodedHeader.accepts[0].asset, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  assert.equal(decodedHeader.accepts[0].payTo, config.payToWallet);

  // Verify JSON body
  const body = await res.json();
  assert.equal(body.x402Version, 2);
  assert.ok(Array.isArray(body.accepts));
  assert.equal(body.accepts[0].scheme, 'exact');
  assert.equal(body.accepts[0].network, 'eip155:8453');
  assert.equal(body.accepts[0].maxAmountRequired, '5000');
  assert.equal(body.accepts[0].asset, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  assert.equal(body.accepts[0].payTo, config.payToWallet);
  assert.equal(body.accepts[0].extra.name, 'USD Coin');
  assert.equal(body.accepts[0].extra.version, '2');
});

test('5. Dual-compatible x402: POST /v1/trust/verify returns 402 unauthenticated', async () => {
  const res = await app.request('/v1/trust/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentAddress: '0x123' }),
  });

  assert.equal(res.status, 402);
  assert.ok(res.headers.get('PAYMENT-REQUIRED'));
  const body = await res.json();
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts[0].network, 'eip155:8453');
});

test('6. Paid request: POST /v1/trust/verify with valid payment returns 200 OK and PAYMENT-RESPONSE', async () => {
  const res = await app.request('/v1/trust/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': 'valid_test_signature',
    },
    body: JSON.stringify({
      agentAddress: '0x1111111111111111111111111111111111111111',
      action: 'transfer_usdc',
      promptText: 'Legitimate user prompt',
    }),
  });

  assert.equal(res.status, 200);
  const paymentRespHeader = res.headers.get('PAYMENT-RESPONSE');
  assert.ok(paymentRespHeader, 'PAYMENT-RESPONSE header must be present on successful settlement');

  const settlement = JSON.parse(
    Buffer.from(paymentRespHeader, 'base64').toString('utf8')
  );
  assert.equal(settlement.success, true);
  assert.equal(settlement.network, 'eip155:8453');
  assert.equal(settlement.asset, config.usdcAsset);

  const body = await res.json();
  assert.equal(body.status, 'success');
  assert.ok(body.evaluation);
  assert.equal(body.evaluation.status, 'approved');
  assert.equal(body.evaluation.riskLevel, 'clean');
});

test('7. Discovery: GET /.well-known/x402.json catalog references local & upstream endpoints', async () => {
  const res = await app.request('/.well-known/x402.json');
  assert.equal(res.status, 200);

  const catalog = await res.json();
  assert.equal(catalog.name, 'x402-trustgate');
  assert.equal(catalog.x402Version, 2);
  assert.equal(catalog.payment_recipient, config.payToWallet);
  assert.equal(catalog.network, 'eip155:8453');
  assert.equal(catalog.wallet_family.payTo, config.payToWallet);

  // Check local endpoints present
  const localVerify = catalog.endpoints.find((e: any) => e.id === 'trust-verify');
  assert.ok(localVerify, 'Local trust-verify endpoint must be in catalog');
  assert.equal(localVerify.pricing.payTo, config.payToWallet);

  // Check upstream CanaryGuard endpoint present under same wallet family
  const upstreamSanitize = catalog.endpoints.find((e: any) => e.id === 'canaryguard-sanitize');
  assert.ok(upstreamSanitize, 'Upstream canaryguard-sanitize endpoint must be referenced');
  assert.equal(upstreamSanitize.payment_recipient, config.payToWallet);
  assert.equal(upstreamSanitize.bridgeRedirectStatus, 307);
});
