import "server-only";

import { DefaultAzureCredential } from "@azure/identity";
import type {
  AzureMonitorPoint,
  AzureMonitorRange,
  AzureMonitorSnapshot,
} from "@/lib/azure-monitor-types";

const ARM_SCOPE = "https://management.azure.com/.default";
const ARM_ORIGIN = "https://management.azure.com";
const METRICS_API_VERSION = "2023-10-01";
const REQUEST_TIMEOUT_MS = 15_000;

const RANGE_CONFIG: Record<
  AzureMonitorRange,
  { durationMs: number; interval: string; intervalSeconds: number }
> = {
  "1h": { durationMs: 60 * 60 * 1_000, interval: "PT1M", intervalSeconds: 60 },
  "24h": {
    durationMs: 24 * 60 * 60 * 1_000,
    interval: "PT5M",
    intervalSeconds: 5 * 60,
  },
  "7d": {
    durationMs: 7 * 24 * 60 * 60 * 1_000,
    interval: "PT1H",
    intervalSeconds: 60 * 60,
  },
  "30d": {
    durationMs: 30 * 24 * 60 * 60 * 1_000,
    interval: "PT6H",
    intervalSeconds: 6 * 60 * 60,
  },
};

type AzureMetricDatum = {
  timeStamp: string;
  average?: number;
  maximum?: number;
  total?: number;
};

type AzureMetricResponse = {
  interval?: string;
  value?: Array<{
    name?: { value?: string };
    timeseries?: Array<{ data?: AzureMetricDatum[] }>;
  }>;
};

type Aggregation = "average" | "maximum" | "total";

let credential: DefaultAzureCredential | null = null;

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing Azure Monitor configuration: ${name}`);
  }
  return value;
}

function azureConfiguration() {
  const subscriptionId = requiredEnvironmentValue("AZURE_SUBSCRIPTION_ID");
  const resourceGroup =
    process.env.AZURE_RESOURCE_GROUP?.trim() || "rg-examcooker-prod";
  const appName =
    process.env.AZURE_WEBAPP_NAME?.trim() || "examcooker-2024";
  const planName =
    process.env.AZURE_APP_SERVICE_PLAN_NAME?.trim() ||
    "asp-examcooker-b3-southindia";

  const resourceGroupPath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
  return {
    appName,
    planName,
    region: process.env.AZURE_APP_SERVICE_REGION?.trim() || "South India",
    sku: process.env.AZURE_APP_SERVICE_SKU?.trim() || "B2",
    instanceCount: Number(process.env.AZURE_APP_SERVICE_INSTANCES || "1"),
    appResourceId: `${resourceGroupPath}/providers/Microsoft.Web/sites/${appName}`,
    planResourceId: `${resourceGroupPath}/providers/Microsoft.Web/serverfarms/${planName}`,
  };
}

function getCredential() {
  credential ??= new DefaultAzureCredential();
  return credential;
}

async function fetchAzureMetrics(input: {
  accessToken: string;
  aggregation: string;
  end: Date;
  interval: string;
  metricNames: string[];
  resourceId: string;
  start: Date;
}) {
  const url = new URL(
    `${ARM_ORIGIN}${input.resourceId}/providers/Microsoft.Insights/metrics`,
  );
  url.searchParams.set("api-version", METRICS_API_VERSION);
  url.searchParams.set(
    "timespan",
    `${input.start.toISOString()}/${input.end.toISOString()}`,
  );
  url.searchParams.set("interval", input.interval);
  url.searchParams.set("metricnames", input.metricNames.join(","));
  url.searchParams.set("aggregation", input.aggregation);
  url.searchParams.set("AutoAdjustTimegrain", "true");
  url.searchParams.set("ValidateDimensions", "false");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${input.accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Azure Monitor request failed (${response.status}): ${detail.slice(0, 240)}`,
    );
  }

  return (await response.json()) as AzureMetricResponse;
}

function metricValues(
  response: AzureMetricResponse,
  metricName: string,
  aggregation: Aggregation,
) {
  const points = new Map<string, number[]>();
  const metric = response.value?.find(
    (candidate) => candidate.name?.value === metricName,
  );

  for (const series of metric?.timeseries ?? []) {
    for (const datum of series.data ?? []) {
      const value = datum[aggregation];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const existing = points.get(datum.timeStamp) ?? [];
      existing.push(value);
      points.set(datum.timeStamp, existing);
    }
  }

  const result = new Map<string, number>();
  for (const [timestamp, values] of points) {
    const value =
      aggregation === "total"
        ? values.reduce((sum, candidate) => sum + candidate, 0)
        : aggregation === "maximum"
          ? Math.max(...values)
          : values.reduce((sum, candidate) => sum + candidate, 0) /
            values.length;
    result.set(timestamp, value);
  }
  return result;
}

function finiteValues(values: Array<number | null>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function average(values: Array<number | null>) {
  const valid = finiteValues(values);
  return valid.length > 0
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
}

function maximum(values: Array<number | null>) {
  const valid = finiteValues(values);
  return valid.length > 0 ? Math.max(...valid) : 0;
}

function total(values: Array<number | null>) {
  return finiteValues(values).reduce((sum, value) => sum + value, 0);
}

function lastValue(values: Array<number | null>) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function deriveHealth(summary: AzureMonitorSnapshot["summary"]) {
  const degradedReasons: string[] = [];
  const watchReasons: string[] = [];

  if (summary.serverErrorRatePercent >= 2) {
    degradedReasons.push(
      `${round(summary.serverErrorRatePercent, 1)}% server error rate`,
    );
  } else if (summary.serverErrorRatePercent >= 0.5) {
    watchReasons.push(
      `${round(summary.serverErrorRatePercent, 1)}% server error rate`,
    );
  }

  if (summary.averageMemoryPercent >= 90 || summary.maxQueueLength > 5) {
    degradedReasons.push(
      summary.maxQueueLength > 5
        ? `HTTP queue reached ${round(summary.maxQueueLength, 0)}`
        : `${round(summary.averageMemoryPercent, 0)}% average memory`,
    );
  } else if (
    summary.averageMemoryPercent >= 80 ||
    summary.peakCpuPercent >= 95 ||
    summary.maxQueueLength > 0
  ) {
    watchReasons.push(
      summary.averageMemoryPercent >= 80
        ? `${round(summary.averageMemoryPercent, 0)}% average memory`
        : summary.maxQueueLength > 0
          ? `HTTP queue reached ${round(summary.maxQueueLength, 0)}`
          : `${round(summary.peakCpuPercent, 0)}% peak CPU`,
    );
  }

  if (degradedReasons.length > 0) {
    return {
      state: "degraded" as const,
      label: "Degraded",
      reasons: [...degradedReasons, ...watchReasons],
    };
  }
  if (watchReasons.length > 0) {
    return {
      state: "watch" as const,
      label: "Needs attention",
      reasons: watchReasons,
    };
  }
  return {
    state: "healthy" as const,
    label: "Operating normally",
    reasons: ["No capacity queue or elevated server-error signal"],
  };
}

export async function getAzureMonitorSnapshot(
  range: AzureMonitorRange,
): Promise<AzureMonitorSnapshot> {
  const config = azureConfiguration();
  const rangeConfig = RANGE_CONFIG[range];
  const end = new Date();
  const start = new Date(end.getTime() - rangeConfig.durationMs);
  const token = await getCredential().getToken(ARM_SCOPE);
  if (!token?.token) throw new Error("Azure identity did not return an access token");

  const [appMetrics, planMetrics, fileSystemMetrics] = await Promise.all([
    fetchAzureMetrics({
      accessToken: token.token,
      aggregation: "Total,Average,Maximum",
      end,
      interval: rangeConfig.interval,
      metricNames: [
        "Requests",
        "Http2xx",
        "Http3xx",
        "Http4xx",
        "Http5xx",
        "HttpResponseTime",
        "MemoryWorkingSet",
        "BytesReceived",
        "BytesSent",
        "CpuTime",
        "IoReadBytesPerSecond",
        "IoWriteBytesPerSecond",
      ],
      resourceId: config.appResourceId,
      start,
    }),
    fetchAzureMetrics({
      accessToken: token.token,
      aggregation: "Average,Maximum",
      end,
      interval: rangeConfig.interval,
      metricNames: [
        "CpuPercentage",
        "MemoryPercentage",
        "HttpQueueLength",
        "DiskQueueLength",
      ],
      resourceId: config.planResourceId,
      start,
    }),
    fetchAzureMetrics({
      accessToken: token.token,
      aggregation: "Average,Maximum",
      end,
      interval: "PT6H",
      metricNames: ["FileSystemUsage"],
      resourceId: config.appResourceId,
      start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1_000),
    }),
  ]);

  const requests = metricValues(appMetrics, "Requests", "total");
  const successfulRequests = metricValues(appMetrics, "Http2xx", "total");
  const redirects = metricValues(appMetrics, "Http3xx", "total");
  const serverErrors = metricValues(appMetrics, "Http5xx", "total");
  const clientErrors = metricValues(appMetrics, "Http4xx", "total");
  const responseTimes = metricValues(appMetrics, "HttpResponseTime", "average");
  const responseTimePeaks = metricValues(appMetrics, "HttpResponseTime", "maximum");
  const workingSet = metricValues(appMetrics, "MemoryWorkingSet", "average");
  const workingSetPeaks = metricValues(appMetrics, "MemoryWorkingSet", "maximum");
  const bytesReceived = metricValues(appMetrics, "BytesReceived", "total");
  const bytesSent = metricValues(appMetrics, "BytesSent", "total");
  const cpuTime = metricValues(appMetrics, "CpuTime", "total");
  const ioRead = metricValues(appMetrics, "IoReadBytesPerSecond", "average");
  const ioReadPeaks = metricValues(
    appMetrics,
    "IoReadBytesPerSecond",
    "maximum",
  );
  const ioWrite = metricValues(appMetrics, "IoWriteBytesPerSecond", "average");
  const ioWritePeaks = metricValues(
    appMetrics,
    "IoWriteBytesPerSecond",
    "maximum",
  );
  const cpu = metricValues(planMetrics, "CpuPercentage", "average");
  const cpuPeaks = metricValues(planMetrics, "CpuPercentage", "maximum");
  const memory = metricValues(planMetrics, "MemoryPercentage", "average");
  const memoryPeaks = metricValues(planMetrics, "MemoryPercentage", "maximum");
  const queue = metricValues(planMetrics, "HttpQueueLength", "average");
  const queuePeaks = metricValues(planMetrics, "HttpQueueLength", "maximum");
  const diskQueue = metricValues(planMetrics, "DiskQueueLength", "average");
  const diskQueuePeaks = metricValues(
    planMetrics,
    "DiskQueueLength",
    "maximum",
  );
  const fileSystemUsage = metricValues(
    fileSystemMetrics,
    "FileSystemUsage",
    "average",
  );
  const fileSystemUsagePeaks = metricValues(
    fileSystemMetrics,
    "FileSystemUsage",
    "maximum",
  );

  const timestamps = Array.from(
    new Set([
      ...requests.keys(),
      ...successfulRequests.keys(),
      ...redirects.keys(),
      ...serverErrors.keys(),
      ...cpu.keys(),
      ...memory.keys(),
      ...responseTimes.keys(),
      ...cpuTime.keys(),
      ...ioRead.keys(),
      ...ioWrite.keys(),
    ]),
  ).sort();

  const series: AzureMonitorPoint[] = timestamps.map((timestamp) => {
    const requestCount = requests.get(timestamp) ?? null;
    const serverErrorCount = serverErrors.get(timestamp) ?? null;
    return {
      timestamp,
      requests: requestCount,
      rps:
        requestCount === null
          ? null
          : requestCount / rangeConfig.intervalSeconds,
      rpm:
        requestCount === null
          ? null
          : requestCount / (rangeConfig.intervalSeconds / 60),
      cpuPercent: cpu.get(timestamp) ?? null,
      memoryPercent: memory.get(timestamp) ?? null,
      responseTimeMs:
        responseTimes.has(timestamp)
          ? (responseTimes.get(timestamp) ?? 0) * 1_000
          : null,
      serverErrors: serverErrorCount,
      clientErrors: clientErrors.get(timestamp) ?? null,
      errorRatePercent:
        requestCount && serverErrorCount !== null
          ? (serverErrorCount / requestCount) * 100
          : requestCount === 0
            ? 0
            : null,
      queueLength: queue.get(timestamp) ?? null,
      workingSetGiB:
        workingSet.has(timestamp)
          ? (workingSet.get(timestamp) ?? 0) / 1_073_741_824
          : null,
      bytesReceivedMiB:
        bytesReceived.has(timestamp)
          ? (bytesReceived.get(timestamp) ?? 0) / 1_048_576
          : null,
      bytesSentMiB:
        bytesSent.has(timestamp)
          ? (bytesSent.get(timestamp) ?? 0) / 1_048_576
          : null,
      cpuTimeSeconds: cpuTime.get(timestamp) ?? null,
      ioReadMiBPerSecond:
        ioRead.has(timestamp)
          ? (ioRead.get(timestamp) ?? 0) / 1_048_576
          : null,
      ioWriteKiBPerSecond:
        ioWrite.has(timestamp)
          ? (ioWrite.get(timestamp) ?? 0) / 1_024
          : null,
      diskQueueLength: diskQueue.get(timestamp) ?? null,
    };
  });

  const totalRequests = total(series.map((point) => point.requests));
  const totalServerErrors = total(series.map((point) => point.serverErrors));
  const totalClientErrors = total(series.map((point) => point.clientErrors));
  const totalCpuTimeSeconds = total(Array.from(cpuTime.values()));
  const elapsedSeconds = rangeConfig.durationMs / 1_000;
  const summary: AzureMonitorSnapshot["summary"] = {
    totalRequests: round(totalRequests, 0),
    averageRps: round(totalRequests / elapsedSeconds, 2),
    peakRps: round(maximum(series.map((point) => point.rps)), 2),
    averageRpm: round((totalRequests / elapsedSeconds) * 60, 1),
    peakRpm: round(maximum(series.map((point) => point.rpm)), 1),
    averageCpuPercent: round(average(series.map((point) => point.cpuPercent)), 1),
    peakCpuPercent: round(maximum(Array.from(cpuPeaks.values())), 1),
    averageMemoryPercent: round(
      average(series.map((point) => point.memoryPercent)),
      1,
    ),
    peakMemoryPercent: round(maximum(Array.from(memoryPeaks.values())), 1),
    averageResponseTimeMs: round(
      average(series.map((point) => point.responseTimeMs)),
      0,
    ),
    peakResponseTimeMs: round(
      maximum(Array.from(responseTimePeaks.values())) * 1_000,
      0,
    ),
    serverErrors: round(totalServerErrors, 0),
    serverErrorRatePercent: round(
      totalRequests > 0 ? (totalServerErrors / totalRequests) * 100 : 0,
      2,
    ),
    successfulRequests: round(total(Array.from(successfulRequests.values())), 0),
    redirects: round(total(Array.from(redirects.values())), 0),
    clientErrors: round(totalClientErrors, 0),
    clientErrorRatePercent: round(
      totalRequests > 0 ? (totalClientErrors / totalRequests) * 100 : 0,
      2,
    ),
    successRatePercent: round(
      totalRequests > 0
        ? ((totalRequests - totalServerErrors) / totalRequests) * 100
        : 100,
      2,
    ),
    maxQueueLength: round(maximum(Array.from(queuePeaks.values())), 1),
    averageWorkingSetGiB: round(
      average(series.map((point) => point.workingSetGiB)),
      2,
    ),
    peakWorkingSetGiB: round(
      maximum(Array.from(workingSetPeaks.values())) / 1_073_741_824,
      2,
    ),
    bytesReceivedGiB: round(
      total(Array.from(bytesReceived.values())) / 1_073_741_824,
      2,
    ),
    bytesSentGiB: round(
      total(Array.from(bytesSent.values())) / 1_073_741_824,
      2,
    ),
    totalCpuTimeSeconds: round(totalCpuTimeSeconds, 1),
    cpuTimePerRequestMs: round(
      totalRequests > 0
        ? (totalCpuTimeSeconds / totalRequests) * 1_000
        : 0,
      2,
    ),
    currentIoReadMiBPerSecond: round(
      lastValue(Array.from(ioRead.values())) / 1_048_576,
      2,
    ),
    peakIoReadMiBPerSecond: round(
      maximum(Array.from(ioReadPeaks.values())) / 1_048_576,
      2,
    ),
    currentIoWriteKiBPerSecond: round(
      lastValue(Array.from(ioWrite.values())) / 1_024,
      2,
    ),
    peakIoWriteKiBPerSecond: round(
      maximum(Array.from(ioWritePeaks.values())) / 1_024,
      2,
    ),
    fileSystemUsageGiB: round(
      lastValue(Array.from(fileSystemUsage.values())) / 1_073_741_824,
      2,
    ),
    peakFileSystemUsageGiB: round(
      maximum(Array.from(fileSystemUsagePeaks.values())) / 1_073_741_824,
      2,
    ),
    currentDiskQueueLength: round(
      lastValue(Array.from(diskQueue.values())),
      1,
    ),
    maxDiskQueueLength: round(maximum(Array.from(diskQueuePeaks.values())), 1),
    currentRps: round(lastValue(series.map((point) => point.rps)), 2),
    currentRpm: round(lastValue(series.map((point) => point.rpm)), 1),
    currentCpuPercent: round(
      lastValue(series.map((point) => point.cpuPercent)),
      1,
    ),
    currentMemoryPercent: round(
      lastValue(series.map((point) => point.memoryPercent)),
      1,
    ),
    currentQueueLength: round(
      lastValue(series.map((point) => point.queueLength)),
      1,
    ),
  };

  return {
    range,
    intervalSeconds: rangeConfig.intervalSeconds,
    fetchedAt: end.toISOString(),
    latestMetricAt: timestamps.at(-1) ?? null,
    resource: {
      appName: config.appName,
      planName: config.planName,
      region: config.region,
      sku: config.sku,
      instanceCount: Number.isFinite(config.instanceCount)
        ? config.instanceCount
        : 1,
    },
    health: deriveHealth(summary),
    summary,
    series,
  };
}
