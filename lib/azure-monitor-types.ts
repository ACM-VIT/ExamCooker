export const AZURE_MONITOR_RANGES = ["1h", "24h", "7d", "30d"] as const;

export type AzureMonitorRange = (typeof AZURE_MONITOR_RANGES)[number];

export type AzureMonitorPoint = {
  timestamp: string;
  rps: number | null;
  requests: number | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  responseTimeMs: number | null;
  serverErrors: number | null;
  clientErrors: number | null;
  errorRatePercent: number | null;
  queueLength: number | null;
  workingSetGiB: number | null;
};

export type AzureMonitorSnapshot = {
  range: AzureMonitorRange;
  intervalSeconds: number;
  fetchedAt: string;
  latestMetricAt: string | null;
  resource: {
    appName: string;
    planName: string;
    region: string;
    sku: string;
    instanceCount: number;
  };
  health: {
    state: "healthy" | "watch" | "degraded";
    label: string;
    reasons: string[];
  };
  summary: {
    totalRequests: number;
    averageRps: number;
    peakRps: number;
    averageCpuPercent: number;
    peakCpuPercent: number;
    averageMemoryPercent: number;
    peakMemoryPercent: number;
    averageResponseTimeMs: number;
    peakResponseTimeMs: number;
    serverErrors: number;
    serverErrorRatePercent: number;
    clientErrors: number;
    successRatePercent: number;
    maxQueueLength: number;
    currentRps: number;
    currentCpuPercent: number;
    currentMemoryPercent: number;
  };
  series: AzureMonitorPoint[];
};

export function isAzureMonitorRange(
  value: string | null,
): value is AzureMonitorRange {
  return AZURE_MONITOR_RANGES.includes(value as AzureMonitorRange);
}
