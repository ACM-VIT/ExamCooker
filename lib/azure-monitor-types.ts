export const AZURE_MONITOR_RANGES = ["1h", "24h", "7d", "30d"] as const;

export type AzureMonitorRange = (typeof AZURE_MONITOR_RANGES)[number];

export type AzureMonitorPoint = {
  timestamp: string;
  rps: number | null;
  rpm: number | null;
  requests: number | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  responseTimeMs: number | null;
  serverErrors: number | null;
  clientErrors: number | null;
  errorRatePercent: number | null;
  queueLength: number | null;
  workingSetGiB: number | null;
  bytesReceivedMiB: number | null;
  bytesSentMiB: number | null;
  cpuTimeSeconds: number | null;
  ioReadMiBPerSecond: number | null;
  ioWriteKiBPerSecond: number | null;
  diskQueueLength: number | null;
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
    averageRpm: number;
    peakRpm: number;
    averageCpuPercent: number;
    peakCpuPercent: number;
    averageMemoryPercent: number;
    peakMemoryPercent: number;
    averageResponseTimeMs: number;
    peakResponseTimeMs: number;
    serverErrors: number;
    serverErrorRatePercent: number;
    successfulRequests: number;
    redirects: number;
    clientErrors: number;
    clientErrorRatePercent: number;
    successRatePercent: number;
    maxQueueLength: number;
    averageWorkingSetGiB: number;
    peakWorkingSetGiB: number;
    bytesReceivedGiB: number;
    bytesSentGiB: number;
    totalCpuTimeSeconds: number;
    cpuTimePerRequestMs: number;
    currentIoReadMiBPerSecond: number;
    peakIoReadMiBPerSecond: number;
    currentIoWriteKiBPerSecond: number;
    peakIoWriteKiBPerSecond: number;
    fileSystemUsageGiB: number;
    peakFileSystemUsageGiB: number;
    currentDiskQueueLength: number;
    maxDiskQueueLength: number;
    currentRps: number;
    currentRpm: number;
    currentCpuPercent: number;
    currentMemoryPercent: number;
    currentQueueLength: number;
  };
  series: AzureMonitorPoint[];
};

export function isAzureMonitorRange(
  value: string | null,
): value is AzureMonitorRange {
  return AZURE_MONITOR_RANGES.includes(value as AzureMonitorRange);
}
