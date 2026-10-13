import dotenv from 'dotenv';
dotenv.config();

async function submitDirectories() {
  console.log(`====================================================`);
  console.log(`🚀 [x402-trustgate] Directory Submission & Registration`);
  console.log(`====================================================\n`);

  const servicePayload = {
    url: 'https://x402-trustgate.onrender.com',
    email: 'ak10082247@gmail.com',
    service_name: 'x402 TrustGate',
    description: 'Autonomous AI agent trust verification gate, x402 BBB trust-line auditor, skill hardener, and secure web envelope proxy on Base mainnet.',
    website_url: 'https://github.com/ak10082247-max/x402-trustgate',
    category: 'Verification',
    endpoints: [
      '/v1/diagnose',
      '/v1/remediate',
      '/v1/harden-skill',
      '/v1/safefetch',
      '/v1/trust/verify'
    ],
    notes: 'Production x402 gateway on Base (eip155:8453, USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, payTo: 0x73279fa4BadA7CAC888c62CDa4f5c8104765f6f1). Dual V1+V2 header compatible, <50ms probes, free diagnostic endpoint, and automated zero-fail fallbacks.'
  };

  // 1. Submit to x402-list.com API
  console.log(`[1/3] Submitting to https://x402-list.com/api/v1/submit...`);
  try {
    const res1 = await fetch('https://x402-list.com/api/v1/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'x402-trustgate-registrar/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify(servicePayload)
    });
    const text1 = await res1.text();
    console.log(`   -> HTTP Status: ${res1.status}`);
    console.log(`   -> Response: ${text1}`);
  } catch (err: any) {
    console.warn(`   -> x402-list.com/api/v1/submit failed: ${err.message}`);
  }

  // 2. Submit to x402-list.com root /submit endpoint
  console.log(`\n[2/3] Submitting to https://x402-list.com/submit...`);
  try {
    const res2 = await fetch('https://x402-list.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'x402-trustgate-registrar/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify(servicePayload)
    });
    const text2 = await res2.text();
    console.log(`   -> HTTP Status: ${res2.status}`);
    console.log(`   -> Response: ${text2.slice(0, 300)}`);
  } catch (err: any) {
    console.warn(`   -> x402-list.com/submit failed: ${err.message}`);
  }

  // 3. Submit to HagglyAI API
  console.log(`\n[3/3] Submitting to https://hagglyai.com/api/v1/services/submit...`);
  try {
    const res3 = await fetch('https://hagglyai.com/api/v1/services/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'x402-trustgate-registrar/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        ...servicePayload,
        discovery_endpoint: `https://x402-trustgate.onrender.com/.well-known/x402.json`,
      })
    });
    const text3 = await res3.text();
    console.log(`   -> HTTP Status: ${res3.status}`);
    console.log(`   -> Response: ${text3.slice(0, 300)}`);
  } catch (err: any) {
    console.warn(`   -> HagglyAI note: ${err.message}`);
  }
}

submitDirectories().catch(console.error);
