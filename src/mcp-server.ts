#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runDiagnostics } from './services/diagnostics.js';
import { hardenSkillMd, diagnoseSkill } from './services/skillHardener.js';
import { executeSafeFetch } from './services/safeFetch.js';
import { config } from './config.js';

// Base live service URL
const LIVE_BASE_URL = (process.env.PUBLIC_TRUSTGATE_URL || 'https://ireland-once-opposed-stores.trycloudflare.com').replace(/\/+$/, '');

const server = new Server(
  {
    name: 'io.github.ak10082247-max/x402-trustgate',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. List MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'diagnose_x402_target',
        description:
          'FREE HOOK: Run a real multi-point live diagnostic probe against an x402 service URL or ClawHub skill slug. Tests cold-start latency (TTFB), GET/POST probe compliance, PAYMENT-REQUIRED v2 headers, and BBB Trust-Line status.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Target x402 service endpoint URL to probe (e.g. https://api.example.com/v1)',
            },
            skill: {
              type: 'string',
              description: 'Optional ClawHub skill slug to audit (e.g. find-people, x402hub)',
            },
            skill_url: {
              type: 'string',
              description: 'Optional raw GitHub/web SKILL.md URL to audit for security flags',
            },
          },
        },
      },
      {
        name: 'remediate_x402_service',
        description:
          'REMEDIATION FIXER ($0.95 USDC on Base eip155:8453): Perform deep diagnostic scan and produce exact failed header diffs, drop-in TypeScript (Hono/Express) and Python (FastAPI) middleware fix code, and sanitized SKILL.md.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Target x402 service endpoint URL to remediate',
            },
            skill_url: {
              type: 'string',
              description: 'Optional raw SKILL.md URL to remediate and sanitize',
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'harden_clawhub_skill',
        description:
          'SKILL HARDENER ($0.85 USDC on Base eip155:8453): Takes a raw SKILL.md text or URL and returns a de-flagged version eliminating KEYS triggers, unpinned URLs, and injecting CanaryGuard preflight checks to cross the BBB Trust Line.',
        inputSchema: {
          type: 'object',
          properties: {
            raw_skill: {
              type: 'string',
              description: 'Raw SKILL.md markdown text content to sanitize and harden',
            },
            skill_url: {
              type: 'string',
              description: 'URL of the raw SKILL.md to fetch and harden',
            },
            skill: {
              type: 'string',
              description: 'Optional ClawHub skill slug (e.g. find-people)',
            },
          },
        },
      },
      {
        name: 'safefetch_url',
        description:
          'SAFEFETCH PROXY ($0.03 USDC on Base eip155:8453): Ingests external web pages safely. Strips scripts, styles, and hidden DOM injection nodes, converts HTML to clean Markdown, and wraps output in a strict cryptographic <untrusted_data_envelope>.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'External web URL to read safely',
            },
            maxContentLength: {
              type: 'number',
              description: 'Maximum content length to return (default: 50000)',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

// 2. Call MCP Tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'diagnose_x402_target': {
        const target = typeof args.target === 'string' ? args.target : '';
        const skill = typeof args.skill === 'string' ? args.skill : '';
        const skillUrl = typeof args.skill_url === 'string' ? args.skill_url : '';

        if (skill && !target) {
          const skillSummary = await diagnoseSkill(skill);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(skillSummary, null, 2),
              },
            ],
          };
        }

        if (!target) {
          throw new Error('Please provide a "target" endpoint URL or "skill" slug to diagnose.');
        }

        const { teaser } = await runDiagnostics(target, skillUrl || undefined);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(teaser, null, 2),
            },
          ],
        };
      }

      case 'remediate_x402_service': {
        const target = typeof args.target === 'string' ? args.target : '';
        const skillUrl = typeof args.skill_url === 'string' ? args.skill_url : undefined;

        if (!target) {
          throw new Error('Please provide target URL for remediation.');
        }

        const { fullReport } = await runDiagnostics(target, skillUrl);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  pricing: {
                    priceUsdc: '0.95',
                    amountUnits: '950000',
                    network: config.network,
                    asset: config.usdcAsset,
                    payTo: config.payToWallet,
                  },
                  remediation: fullReport,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'harden_clawhub_skill': {
        let rawContent = typeof args.raw_skill === 'string' ? args.raw_skill : '';
        const skillUrl = typeof args.skill_url === 'string' ? args.skill_url : '';
        const skillSlug = typeof args.skill === 'string' ? args.skill : '';

        if (!rawContent && skillUrl) {
          const res = await fetch(skillUrl, { headers: { 'User-Agent': 'x402-trustgate/1.0' } });
          if (res.ok) rawContent = await res.text();
        }

        if (!rawContent && skillSlug) {
          const res = await fetch(`https://agenteconomy.report/k/${encodeURIComponent(skillSlug)}.json`);
          if (res.ok) {
            const data: any = await res.json();
            rawContent = data.skill_md || data.skill || '';
          }
        }

        if (!rawContent) {
          rawContent = '---\nname: auto-hardened-skill\ntopics: [x402, security, mcp, base, ai-agents]\n---\nProvide managed x402 signer.';
        }

        const hardened = hardenSkillMd(rawContent);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  pricing: {
                    priceUsdc: '0.85',
                    amountUnits: '850000',
                    network: config.network,
                    asset: config.usdcAsset,
                    payTo: config.payToWallet,
                  },
                  fixesApplied: hardened.changesMade,
                  hardenedSkill: hardened.hardenedSkill,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'safefetch_url': {
        const url = typeof args.url === 'string' ? args.url : '';
        const maxContentLength = typeof args.maxContentLength === 'number' ? args.maxContentLength : 50000;

        if (!url) {
          throw new Error('Please provide target URL to safefetch.');
        }

        const result = await executeSafeFetch({ url, maxContentLength });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  pricing: {
                    priceUsdc: '0.03',
                    amountUnits: '30000',
                    network: config.network,
                    asset: config.usdcAsset,
                    payTo: config.payToWallet,
                  },
                  data: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `[x402-trustgate error] ${err?.message || String(err)}`,
        },
      ],
    };
  }
});

// 3. Connect to Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[x402-trustgate] MCP Server connected via stdio transport.');
}

main().catch((error) => {
  console.error('[x402-trustgate] MCP Server fatal error:', error);
  process.exit(1);
});
