import { config } from '../config.js';

export interface UpstreamStatus {
  url: string;
  reachable: boolean;
  lastPing: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  totalPings: number;
  consecutiveFailures: number;
  lastError: string | null;
}

let keepAliveInterval: NodeJS.Timeout | null = null;

const state: UpstreamStatus = {
  url: config.upstreamCanaryGuardUrl,
  reachable: false,
  lastPing: null,
  statusCode: null,
  latencyMs: null,
  totalPings: 0,
  consecutiveFailures: 0,
  lastError: null,
};

export async function pingUpstream(): Promise<UpstreamStatus> {
  const start = Date.now();
  state.totalPings++;
  state.lastPing = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${config.upstreamCanaryGuardUrl}/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'x402-trustgate-keepalive/1.0 (+https://x402-trustgate)',
        'Accept': 'text/html,application/json,*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    state.latencyMs = latency;
    state.statusCode = response.status;
    state.reachable = response.status >= 200 && response.status < 400;
    state.consecutiveFailures = 0;
    state.lastError = null;

    console.log(
      `[keep-alive] Pinged upstream ${config.upstreamCanaryGuardUrl} -> ${response.status} (${latency}ms)`
    );
  } catch (err: any) {
    const latency = Date.now() - start;
    state.latencyMs = latency;
    state.statusCode = null;
    state.reachable = false;
    state.consecutiveFailures++;
    state.lastError = err?.message || 'Unknown network error';

    console.warn(
      `[keep-alive] Failed to ping upstream ${config.upstreamCanaryGuardUrl}: ${state.lastError}`
    );
  }

  return state;
}

export function startKeepAlive(intervalMs: number = config.keepAliveIntervalMs): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  console.log(
    `[keep-alive] Starting upstream bridge to ${config.upstreamCanaryGuardUrl} (interval: ${intervalMs / 1000}s)`
  );

  // Initial immediate background probe
  pingUpstream().catch(() => {});

  // Periodic interval
  keepAliveInterval = setInterval(() => {
    pingUpstream().catch(() => {});
  }, intervalMs);

  // Unref timer so process can terminate cleanly if needed
  if (keepAliveInterval.unref) {
    keepAliveInterval.unref();
  }
}

export function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[keep-alive] Stopped keep-alive interval');
  }
}

export function getUpstreamStatus(): UpstreamStatus {
  return { ...state };
}
