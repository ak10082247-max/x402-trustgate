import fs from 'fs';
import path from 'path';
import { runDiagnostics } from '../src/services/diagnostics.js';
import { config } from '../src/config.js';

interface ScanTarget {
  url: string;
  skillUrl?: string;
}

// Ensure outreach-reports directory exists
const reportsDir = path.resolve(process.cwd(), 'outreach-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Parses target URLs from CLI arguments or targets.json
 */
function loadTargets(): ScanTarget[] {
  const args = process.argv.slice(2);
  const targets: ScanTarget[] = [];

  // Check for --file argument
  let filePath = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' || args[i] === '-f') {
      filePath = args[i + 1];
      break;
    }
  }

  if (filePath && fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === 'string' ? { url: item } : item
      );
    }
  }

  // Check if direct URLs passed as CLI arguments
  const urlArgs = args.filter((a) => !a.startsWith('-') && a.startsWith('http'));
  if (urlArgs.length > 0) {
    return urlArgs.map((u) => ({ url: u }));
  }

  // Check default targets.json in cwd
  const defaultFile = path.resolve(process.cwd(), 'targets.json');
  if (fs.existsSync(defaultFile)) {
    const raw = fs.readFileSync(defaultFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === 'string' ? { url: item } : item
      );
    }
  }

  // Fallback defaults
  return [
    { url: 'https://canaryguard-402.onrender.com/v1/sanitize' },
    { url: 'https://canaryguard-402.onrender.com/v1/base/token' },
    { url: 'https://httpbin.org/status/405' },
  ];
}

/**
 * Formats a clean outreach markdown report for failing services
 */
function generateOutreachMarkdown(params: {
  targetUrl: string;
  domain: string;
  estimatedTrustTier: string;
  criticalBlockersCount: number;
  checks: any[];
  symptoms: string[];
  ttfbMs: number;
}): string {
  const { targetUrl, domain, estimatedTrustTier, criticalBlockersCount, checks, symptoms, ttfbMs } = params;
  const timestamp = new Date().toISOString();
  const serviceHost = config.host === '0.0.0.0' ? 'http://localhost:3000' : `http://${config.host}:${config.port}`;
  const diagnoseLink = `${serviceHost}/v1/diagnose?target=${encodeURIComponent(targetUrl)}`;
  const remediateEndpoint = `${serviceHost}/v1/remediate`;

  const failedChecks = checks.filter((c) => !c.passed);

  return `# x402 Trust-Line Audit & Compliance Notice: ${domain}

**Target Endpoint:** \`${targetUrl}\`  
**Audit Timestamp:** \`${timestamp}\`  
**Current Trust Tier:** **\`Tier ${estimatedTrustTier}\`** (${criticalBlockersCount > 0 ? '❌ BELOW BBB TRUST-LINE' : '⚠️ AT RISK'})  
**Indexers Affected:** [agenteconomy.report](https://agenteconomy.report) • [roundhouseai.io](https://roundhouseai.io) • Coinbase CDP Bazaar

---

## ⚠️ Executive Summary

During our routine automated ecosystem sweep, your x402 service was flagged by the **x402 Trust-Line Auditor**. Autonomous AI agents and crawler indexers frequently evaluate your endpoint, but **${criticalBlockersCount} critical compliance blockers** currently prevent your service from being listed above the **BBB Trust-Line**.

### Observed Symptoms:
${symptoms.map((s) => `- ❌ **${s}**`).join('\n')}

When an autonomous AI agent encounters these issues, transactions fail silently or the agent's payment router demotes your endpoint in favor of competing compliant providers.

---

## 🔍 Exact Timestamped Probe Evidence

| Category | Check Name | Status | Severity | Technical Details |
| :--- | :--- | :--- | :--- | :--- |
${checks
  .map(
    (c) =>
      `| \`${c.category}\` | ${c.name} | ${c.passed ? '✅ PASSED' : '❌ FAILED'} | \`${c.severity}\` | ${c.details.replace(/\|/g, '\\|')} |`
  )
  .join('\n')}

**Latency Snapshot:**
* **Measured TTFB:** \`${ttfbMs}ms\` ${ttfbMs > 800 ? '(Flagged: High Cold-Start Latency)' : '(Acceptable)'}

---

## 🛠️ Free Live Verification

You can independently verify your endpoint's live compliance status at any time via our free zero-cost diagnostic hook:

🔗 **[Run Live Verification Check](${diagnoseLink})**

\`\`\`bash
# Run free diagnostic test from your terminal:
curl -s "${diagnoseLink}"
\`\`\`

---

## ⚡ 1-Click Automated Remediation Patch ($2.50 USDC)

We have generated an automated, copy-pasteable drop-in middleware patch (TypeScript/Node.js & Python/FastAPI) and sanitized \`SKILL.md\` tailored specifically to your service's endpoints.

### Purchase & Unlock Remediation via x402 Agent / cURL:

\`\`\`bash
# 1. Probe the remediation endpoint (returns HTTP 402 with Base Mainnet payment details):
curl -i -X POST ${remediateEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"target": "${targetUrl}"}'

# 2. Attach Base Mainnet (eip155:8453) USDC payment authorization to unlock fix code:
curl -X POST ${remediateEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \\
  -d '{"target": "${targetUrl}"}'
\`\`\`

### AgentKit / ElizaOS Autonomous Command:
\`\`\`bash
x402-agent call --endpoint ${remediateEndpoint} --body '{"target": "${targetUrl}"}' --pay 2.50-USDC
\`\`\`

### What the $2.50 Remediation Delivers:
1. **Tailored Drop-In Middleware:** Exact TypeScript / Python middleware enforcing sub-50ms dual \`GET\` and \`POST\` responses and valid Base \`eip155:8453\` headers.
2. **Hardened \`SKILL.md\`:** Strips prompt-injection vectors, private key references, and insecure endpoints.
3. **Cryptographic Attestation:** Deterministic SHA-256 safety receipt to verify compliance on \`agenteconomy.report\`.

---

*Report automatically generated by [x402-trustgate](https://github.com/ak10082247-max/x402-trustgate) • Base Mainnet ecosystem security initiative.*
`;
}

/**
 * Main execution loop
 */
async function main() {
  console.log(`====================================================`);
  console.log(`🔍 [x402-trustgate] Ecosystem Lead Generation Scanner`);
  console.log(`🌐 Base Mainnet x402 Trust-Line Auditor`);
  console.log(`====================================================\n`);

  const targets = loadTargets();
  console.log(`Loaded ${targets.length} target endpoint(s) for audit...\n`);

  const summary: {
    target: string;
    tier: string;
    criticalCount: number;
    ttfbMs: number;
    reportPath?: string;
  }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] Auditing: ${target.url}...`);

    try {
      const { teaser, fullReport } = await runDiagnostics(target.url, target.skillUrl);

      console.log(`   -> TTFB: ${teaser.latencySnapshot.ttfbMs}ms | Tier: ${teaser.estimatedTrustTier} | Critical Blockers: ${teaser.criticalBlockersCount}`);

      let reportPath: string | undefined = undefined;

      // If service fails 1 or more BBB Trust-Line checks, generate outreach report
      if (teaser.criticalBlockersCount > 0 || teaser.warningCount > 0) {
        const parsedUrl = new URL(target.url);
        const domain = parsedUrl.hostname;
        const pathSlug = parsedUrl.pathname.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9]/g, '_') || 'root';
        const fileName = `${domain}_${pathSlug}.md`;
        const filePath = path.join(reportsDir, fileName);

        // Also save primary domain report if only 1 endpoint for that domain
        const domainFilePath = path.join(reportsDir, `${domain}.md`);

        const markdown = generateOutreachMarkdown({
          targetUrl: target.url,
          domain,
          estimatedTrustTier: teaser.estimatedTrustTier,
          criticalBlockersCount: teaser.criticalBlockersCount,
          checks: fullReport.checks,
          symptoms: teaser.symptomSummary,
          ttfbMs: teaser.latencySnapshot.ttfbMs,
        });

        fs.writeFileSync(filePath, markdown, 'utf8');
        fs.writeFileSync(domainFilePath, markdown, 'utf8');

        reportPath = path.relative(process.cwd(), domainFilePath);
        console.log(`   📄 Generated outreach report: ${reportPath}`);
      } else {
        console.log(`   ✅ Target passed BBB Trust-Line requirements!`);
      }

      summary.push({
        target: target.url,
        tier: teaser.estimatedTrustTier,
        criticalCount: teaser.criticalBlockersCount,
        ttfbMs: teaser.latencySnapshot.ttfbMs,
        reportPath,
      });
    } catch (err: any) {
      console.error(`   ❌ Failed to probe ${target.url}: ${err.message}`);
      summary.push({
        target: target.url,
        tier: 'D',
        criticalCount: 99,
        ttfbMs: 0,
      });
    }

    console.log('');
  }

  console.log(`====================================================`);
  console.log(`📊 Ecosystem Audit Summary`);
  console.log(`====================================================`);
  for (const item of summary) {
    const status = item.criticalCount === 0 ? '✅ PASSED' : '⚠️ OUTREACH GENERATED';
    console.log(
      `- ${item.target}\n  Tier: ${item.tier} | Blockers: ${item.criticalCount} | TTFB: ${item.ttfbMs}ms | ${status}${item.reportPath ? ` -> ${item.reportPath}` : ''}`
    );
  }
  console.log(`\nCompleted sweep. Generated reports stored in: ${path.relative(process.cwd(), reportsDir)}/\n`);
}

main().catch((err) => {
  console.error('Fatal scanner error:', err);
  process.exit(1);
});
