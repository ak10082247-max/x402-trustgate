import fs from 'fs';
import path from 'path';
import { runDiagnostics } from '../src/services/diagnostics.js';

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
 * Fetches live services from x402-list directory if requested
 */
async function fetchDirectoryTargets(): Promise<ScanTarget[]> {
  try {
    console.log('[scanner] Ingesting live listed services from https://x402-list.com/api/v1/services...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://x402-list.com/api/v1/services', {
      headers: { 'User-Agent': 'x402-trustgate-auditor/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Directory returned HTTP ${res.status}`);
    }

    const data: any = await res.json();
    const items = Array.isArray(data) ? data : (data.services || data.data || data.items || []);
    const extracted: ScanTarget[] = [];

    for (const item of items) {
      const url = typeof item === 'string' ? item : (item.url || item.endpoint || item.serviceUrl || item.api);
      if (url && typeof url === 'string' && url.startsWith('http')) {
        extracted.push({
          url,
          skillUrl: item.skillUrl || item.skill_url,
        });
      }
    }

    console.log(`[scanner] Successfully extracted ${extracted.length} live services from directory.`);
    return extracted;
  } catch (err: any) {
    console.warn(`[scanner] Could not fetch live directory: ${err.message}. Continuing with target list.`);
    return [];
  }
}

/**
 * Parses target URLs from CLI arguments or targets.json
 */
async function loadTargets(): Promise<ScanTarget[]> {
  const args = process.argv.slice(2);
  let targets: ScanTarget[] = [];

  // 1. Check for --fetch-directory flag
  if (args.includes('--fetch-directory') || args.includes('-d')) {
    const live = await fetchDirectoryTargets();
    if (live.length > 0) {
      targets.push(...live);
    }
  }

  // 2. Check for --file argument
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
      const list = parsed.map((item) =>
        typeof item === 'string' ? { url: item } : item
      );
      targets.push(...list);
      return targets;
    }
  }

  // 3. Check if direct URLs passed as CLI arguments
  const urlArgs = args.filter((a) => !a.startsWith('-') && a.startsWith('http'));
  if (urlArgs.length > 0) {
    targets.push(...urlArgs.map((u) => ({ url: u })));
    return targets;
  }

  // 4. Check default targets.json in cwd
  const defaultFile = path.resolve(process.cwd(), 'targets.json');
  if (fs.existsSync(defaultFile)) {
    const raw = fs.readFileSync(defaultFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const list = parsed.map((item) =>
        typeof item === 'string' ? { url: item } : item
      );
      targets.push(...list);
    }
  }

  // Fallback defaults if still empty
  if (targets.length === 0) {
    targets = [
      { url: 'https://canaryguard-402.onrender.com/v1/sanitize' },
      { url: 'https://canaryguard-402.onrender.com/v1/base/token' },
      { url: 'https://httpbin.org/status/405' },
    ];
  }

  // De-duplicate targets by URL
  const seen = new Set<string>();
  return targets.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
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

  // Production trustgate URL - never fallback to localhost:3000 in outreach reports
  const serviceHost = process.env.PUBLIC_TRUSTGATE_URL || 'https://x402-trustgate.onrender.com';
  const diagnoseLink = `${serviceHost}/v1/diagnose?target=${encodeURIComponent(targetUrl)}`;
  const remediateEndpoint = `${serviceHost}/v1/remediate`;
  const hardenSkillEndpoint = `${serviceHost}/v1/harden-skill`;

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

## ⚡ 1-Click Automated Remediation Patch ($0.95 USDC)

We have generated an automated, copy-pasteable drop-in middleware patch (TypeScript/Node.js & Python/FastAPI) and sanitized \`SKILL.md\` tailored specifically to your service's endpoints.

> **Compliance Note:** Priced at **$0.95 USDC** (\`950000\` units on Base) to fully comply with Agent Economy Report's September 26, 2026 indexing rules (avoiding the penalty for transactions $> $1.00 on micro-payment wallets).

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

### De-Flag SKILL.md via Skill Hardener ($0.85 USDC):
\`\`\`bash
curl -X POST ${hardenSkillEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>" \\
  -d '{"skill_url": "https://${domain}/SKILL.md"}'
\`\`\`

### What the $0.95 Remediation Delivers:
1. **Tailored Drop-In Middleware:** Exact TypeScript / Python middleware enforcing sub-50ms dual \`GET\` and \`POST\` responses and valid Base \`eip155:8453\` headers.
2. **Hardened \`SKILL.md\`:** Strips prompt-injection vectors, unpinned links, and ClawHub reserved words.
3. **Cryptographic Attestation:** Deterministic SHA-256 safety receipt to verify compliance on \`agenteconomy.report\`.

---

*Report automatically generated by [x402-trustgate](https://x402-trustgate.onrender.com) • Base Mainnet ecosystem security initiative.*
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

  const targets = await loadTargets();
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

        // Also save primary domain report
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
