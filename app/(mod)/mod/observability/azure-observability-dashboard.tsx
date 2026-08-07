"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Clock3,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  TimerReset,
  Waves,
} from "lucide-react";
import {
  type ComponentType,
  type SVGProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AZURE_MONITOR_RANGES,
  type AzureMonitorPoint,
  type AzureMonitorRange,
  type AzureMonitorSnapshot,
} from "@/lib/azure-monitor-types";

const RANGE_LABELS: Record<AzureMonitorRange, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

const RANGE_RESOLUTION: Record<AzureMonitorRange, string> = {
  "1h": "1 minute",
  "24h": "5 minutes",
  "7d": "1 hour",
  "30d": "6 hours",
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type MetricKey = keyof Pick<
  AzureMonitorPoint,
  | "rpm"
  | "cpuPercent"
  | "memoryPercent"
  | "responseTimeMs"
  | "errorRatePercent"
  | "bytesReceivedMiB"
  | "bytesSentMiB"
>;

type ChartLine = {
  key: MetricKey;
  label: string;
  color: string;
};

function formatCompact(value: number, digits = 1) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    notation: Math.abs(value) >= 1_000 ? "compact" : "standard",
  }).format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatLatency(valueMs: number) {
  if (valueMs >= 1_000) return `${formatDecimal(valueMs / 1_000, 2)} s`;
  return `${formatCompact(valueMs, 0)} ms`;
}

function formatAge(timestamp: string | null) {
  if (!timestamp) return "Waiting for Azure";
  const ageSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 1_000),
  );
  if (ageSeconds < 60) return `${ageSeconds}s behind`;
  return `${Math.round(ageSeconds / 60)}m behind`;
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatChartTime(timestamp: string, range: AzureMonitorRange) {
  const options: Intl.DateTimeFormatOptions =
    range === "1h" || range === "24h"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { day: "2-digit", month: "short" };
  return new Intl.DateTimeFormat("en-IN", options).format(new Date(timestamp));
}

function buildLinePath(
  series: AzureMonitorPoint[],
  key: MetricKey,
  maximum: number,
) {
  if (series.length < 2) return "";
  let path = "";
  let drawing = false;

  series.forEach((point, index) => {
    const value = point[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      drawing = false;
      return;
    }
    const x = (index / (series.length - 1)) * 1000;
    const y = 210 - Math.min(1, Math.max(0, value / maximum)) * 178;
    path += `${drawing ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    drawing = true;
  });

  return path.trim();
}

function SectionHeading({
  detail,
  title,
}: {
  detail?: string;
  title: string;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
        {title}
      </h2>
      {detail ? (
        <span className="hidden text-sm text-black/55 dark:text-[#D5D5D5]/55 sm:block">
          {detail}
        </span>
      ) : null}
    </header>
  );
}

function MetricCard({
  detail,
  icon: IconComponent,
  label,
  loading,
  value,
}: {
  detail: string;
  icon?: Icon;
  label: string;
  loading: boolean;
  value: string;
}) {
  return (
    <article className="flex min-h-36 flex-col border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black dark:border-white/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-wide text-black/70 dark:text-[#D5D5D5]/65">
        <span>{label}</span>
        {IconComponent ? <IconComponent className="size-4" aria-hidden /> : null}
      </div>
      <div className="mt-auto pt-7">
        {loading ? (
          <span className="block h-9 w-24 animate-pulse bg-black/10 dark:bg-white/10" />
        ) : (
          <strong className="block text-3xl font-black leading-none sm:text-4xl">
            {value}
          </strong>
        )}
        <p className="mt-2 text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/55">
          {loading ? "Reading Azure Monitor" : detail}
        </p>
      </div>
    </article>
  );
}

function InlineStat({
  label,
  loading,
  value,
}: {
  label: string;
  loading: boolean;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5 text-left sm:flex-row sm:items-baseline sm:gap-1.5">
      {loading ? (
        <span className="block h-7 w-16 animate-pulse bg-black/10 dark:bg-white/10 sm:h-5" />
      ) : (
        <span className="text-[1.7rem] font-black leading-none text-black dark:text-[#D5D5D5] sm:text-xl">
          {value}
        </span>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/60 dark:text-[#D5D5D5]/60 sm:text-xs sm:tracking-wider">
        {label}
      </span>
    </div>
  );
}

function MetricChart({
  empty,
  fixedMaximum,
  lines,
  range,
  series,
  title,
  value,
}: {
  empty: boolean;
  fixedMaximum?: number;
  lines: ChartLine[];
  range: AzureMonitorRange;
  series: AzureMonitorPoint[];
  title: string;
  value: string;
}) {
  const values = lines.flatMap((line) =>
    series.flatMap((point) => {
      const candidate = point[line.key];
      return typeof candidate === "number" && Number.isFinite(candidate)
        ? [candidate]
        : [];
    }),
  );
  const maximum = fixedMaximum ?? Math.max(1, ...values) * 1.12;
  const first = series[0]?.timestamp;
  const middle = series[Math.floor(series.length / 2)]?.timestamp;
  const last = series.at(-1)?.timestamp;

  return (
    <article className="border-2 border-black/20 bg-transparent p-4 dark:border-white/20 sm:p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-black/55 dark:text-[#D5D5D5]/55">
            Azure Monitor
          </span>
          <h3 className="mt-1 text-base font-bold text-black dark:text-[#D5D5D5] sm:text-lg">
            {title}
          </h3>
        </div>
        <strong className="text-right text-xl font-black text-black dark:text-[#D5D5D5]">
          {empty ? "—" : value}
        </strong>
      </header>

      <div className="relative mt-5 h-56 overflow-hidden border-y border-black/10 dark:border-white/10">
        {empty ? (
          <div className="absolute inset-0 animate-pulse bg-black/[0.04] dark:bg-white/[0.04]" />
        ) : null}
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} over ${RANGE_LABELS[range]}`}
        >
          <title>{`${title} over ${RANGE_LABELS[range]}`}</title>
          {[32, 91, 150, 210].map((y) => (
            <line
              key={y}
              x1="0"
              x2="1000"
              y1={y}
              y2={y}
              className="stroke-black/10 dark:stroke-white/10"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {!empty
            ? lines.map((line) => (
                <path
                  key={line.key}
                  d={buildLinePath(series, line.key, maximum)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex justify-between font-mono text-[10px] text-black/45 dark:text-[#D5D5D5]/45">
          <span>{first ? formatChartTime(first, range) : "—"}</span>
          <span>{middle ? formatChartTime(middle, range) : "—"}</span>
          <span>{last ? formatChartTime(last, range) : "—"}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-black/60 dark:text-[#D5D5D5]/60">
        {lines.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-2">
            <i className="size-2" style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function CapacityRow({
  label,
  loading,
  peak,
  value,
}: {
  label: string;
  loading: boolean;
  peak: number;
  value: number;
}) {
  return (
    <div className="border-t border-black/15 py-4 first:border-t-0 dark:border-white/15">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-black/55 dark:text-[#D5D5D5]/55">
          {loading
            ? "—"
            : `${formatDecimal(value, 1)}% average · ${formatDecimal(peak, 1)}% peak`}
        </span>
      </div>
      <div className="h-2 bg-black/10 dark:bg-white/10">
        <div
          className={`h-full bg-[#253EE0] dark:bg-[#5FC4E7] ${loading ? "animate-pulse" : ""}`}
          style={{ width: loading ? "28%" : `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export default function AzureObservabilityDashboard({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const [range, setRange] = useState<AzureMonitorRange>("1h");
  const [snapshot, setSnapshot] = useState<AzureMonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const loadMetrics = useCallback(
    async (requestedRange: AzureMonitorRange, signal?: AbortSignal) => {
      const currentRequest = ++requestId.current;
      setRefreshing(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/mod/azure-metrics?range=${requestedRange}`,
          { cache: "no-store", signal },
        );
        const body = (await response.json()) as
          | AzureMonitorSnapshot
          | { error?: string };
        if (!response.ok) {
          throw new Error(
            "error" in body && body.error
              ? body.error
              : "Could not reach Azure Monitor",
          );
        }
        if (currentRequest === requestId.current) {
          setSnapshot(body as AzureMonitorSnapshot);
        }
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        if (currentRequest === requestId.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not reach Azure Monitor",
          );
        }
      } finally {
        if (currentRequest === requestId.current) setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadMetrics(range, controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMetrics(range);
    }, 30_000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, loadMetrics, range]);

  const data = snapshot?.range === range ? snapshot : null;
  const summary = data?.summary;
  const loading = !data;
  const healthClasses =
    data?.health.state === "degraded"
      ? "border-red-500 bg-red-500/10"
      : data?.health.state === "watch"
        ? "border-amber-500 bg-amber-500/10"
        : "border-[#253EE0] bg-[#5FC4E7]/25 dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10";
  const projectedDailyRequests = (summary?.averageRpm ?? 0) * 1_440;

  return (
    <div className="min-h-dvh bg-[#C2E6EC] text-black transition-colors dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 py-6 sm:px-6 sm:py-8 lg:gap-12 lg:px-10 lg:py-12">
        <header>
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link
              href="/mod"
              className="inline-flex h-10 items-center gap-2 border-2 border-black/25 px-3 text-sm font-semibold transition hover:border-black dark:border-white/25 dark:hover:border-white"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Moderator
            </Link>
            <button
              type="button"
              onClick={() => void loadMetrics(range)}
              disabled={refreshing || !enabled}
              className="inline-flex h-10 items-center gap-2 border-2 border-black bg-[#5FC4E7] px-3 text-sm font-bold text-black transition hover:bg-[#71cdec] disabled:cursor-wait disabled:opacity-60 dark:border-[#5FC4E7] dark:bg-[#5FC4E7]/15 dark:text-[#D5D5D5]"
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </button>
          </div>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-black/60 dark:text-[#D5D5D5]/60">
                Production · Azure App Service
              </p>
              <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.02] sm:text-5xl md:text-6xl lg:text-7xl">
                Production. <span className="text-[#253EE0] dark:text-[#5FC4E7]">Live.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-black/65 dark:text-[#D5D5D5]/65 sm:text-base">
                Requests, reliability and App Service capacity, read directly from
                Azure Monitor. Samples refresh every 30 seconds.
              </p>
            </div>

            <div className={`border-2 p-4 ${healthClasses}`}>
              <div className="flex items-start gap-3">
                <Waves className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-black/55 dark:text-[#D5D5D5]/55">
                    System condition
                  </span>
                  <strong className="mt-1 block text-lg">
                    {data?.health.label ?? "Establishing signal"}
                  </strong>
                  <p className="mt-1 text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/60">
                    {data?.health.reasons[0] ?? "Connecting to Azure Monitor"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-6 sm:gap-y-2">
            <InlineStat
              label="RPM now"
              value={formatCompact(summary?.currentRpm ?? 0)}
              loading={loading}
            />
            <InlineStat
              label="requests"
              value={formatCompact(summary?.totalRequests ?? 0)}
              loading={loading}
            />
            <InlineStat
              label="availability"
              value={`${formatDecimal(summary?.successRatePercent ?? 0, 2)}%`}
              loading={loading}
            />
            <InlineStat
              label="avg CPU"
              value={`${formatDecimal(summary?.averageCpuPercent ?? 0, 1)}%`}
              loading={loading}
            />
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 border-y-2 border-black/20 py-3 dark:border-white/20 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2" aria-label="Metric time range">
              {AZURE_MONITOR_RANGES.map((candidate) => (
                <button
                  type="button"
                  key={candidate}
                  aria-pressed={range === candidate}
                  onClick={() => setRange(candidate)}
                  className={`h-9 border px-3 text-xs font-bold uppercase tracking-wide transition ${
                    range === candidate
                      ? "border-black bg-black text-[#C2E6EC] dark:border-[#5FC4E7] dark:bg-[#5FC4E7] dark:text-[#0C1222]"
                      : "border-black/25 hover:border-black dark:border-white/25 dark:hover:border-white"
                  }`}
                >
                  {RANGE_LABELS[candidate]}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-black/55 dark:text-[#D5D5D5]/55">
              <Clock3 className="size-4" aria-hidden />
              {data
                ? `Updated ${formatTime(data.fetchedAt)} · ${formatAge(data.latestMetricAt)}`
                : `Loading ${RANGE_RESOLUTION[range]} samples`}
            </div>
          </div>
          {error ? (
            <div className="border-2 border-red-500 bg-red-500/10 p-4 text-sm" role="alert">
              <strong>Azure Monitor is temporarily unavailable.</strong>{" "}
              <span>{error}. This page will retry automatically.</span>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Traffic" detail={`${RANGE_RESOLUTION[range]} resolution`} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Current RPM"
              value={formatCompact(summary?.currentRpm ?? 0)}
              detail="Requests in the latest normalized minute"
              icon={Activity}
              loading={loading}
            />
            <MetricCard
              label="Average RPM"
              value={formatCompact(summary?.averageRpm ?? 0)}
              detail={`Average across ${RANGE_LABELS[range]}`}
              loading={loading}
            />
            <MetricCard
              label="Peak RPM"
              value={formatCompact(summary?.peakRpm ?? 0)}
              detail="Highest interval-normalized minute"
              loading={loading}
            />
            <MetricCard
              label="Current RPS"
              value={formatDecimal(summary?.currentRps ?? 0, 2)}
              detail={`Average ${formatDecimal(summary?.averageRps ?? 0, 2)} RPS`}
              loading={loading}
            />
            <MetricCard
              label="Total requests"
              value={formatCompact(summary?.totalRequests ?? 0)}
              detail={`Observed over ${RANGE_LABELS[range]}`}
              loading={loading}
            />
            <MetricCard
              label="Daily run rate"
              value={formatCompact(projectedDailyRequests)}
              detail="Projected from this range average"
              loading={loading}
            />
          </div>
          <MetricChart
            title="Requests per minute"
            range={range}
            series={data?.series ?? []}
            lines={[{ key: "rpm", label: "RPM", color: "#253EE0" }]}
            value={`${formatCompact(summary?.currentRpm ?? 0)} now`}
            empty={loading}
          />
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Reliability" detail="HTTP status and response time" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Server availability"
              value={`${formatDecimal(summary?.successRatePercent ?? 0, 2)}%`}
              detail={`${formatCompact(summary?.successfulRequests ?? 0)} HTTP 2xx responses`}
              icon={ShieldCheck}
              loading={loading}
            />
            <MetricCard
              label="Redirects"
              value={formatCompact(summary?.redirects ?? 0)}
              detail="HTTP 3xx responses"
              loading={loading}
            />
            <MetricCard
              label="Client errors"
              value={formatCompact(summary?.clientErrors ?? 0)}
              detail={`${formatDecimal(summary?.clientErrorRatePercent ?? 0, 2)}% HTTP 4xx rate`}
              loading={loading}
            />
            <MetricCard
              label="Server errors"
              value={formatCompact(summary?.serverErrors ?? 0)}
              detail={`${formatDecimal(summary?.serverErrorRatePercent ?? 0, 2)}% HTTP 5xx rate`}
              loading={loading}
            />
            <MetricCard
              label="Average response"
              value={formatLatency(summary?.averageResponseTimeMs ?? 0)}
              detail="Azure backend response time"
              icon={TimerReset}
              loading={loading}
            />
            <MetricCard
              label="Peak response"
              value={formatLatency(summary?.peakResponseTimeMs ?? 0)}
              detail="Slowest interval maximum"
              loading={loading}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricChart
              title="HTTP 5xx rate"
              range={range}
              series={data?.series ?? []}
              lines={[{ key: "errorRatePercent", label: "Server error rate", color: "#E5484D" }]}
              value={`${formatDecimal(summary?.serverErrorRatePercent ?? 0, 2)}%`}
              empty={loading}
            />
            <MetricChart
              title="Response time"
              range={range}
              series={data?.series ?? []}
              lines={[{ key: "responseTimeMs", label: "Average milliseconds", color: "#8E4EC6" }]}
              value={formatLatency(summary?.averageResponseTimeMs ?? 0)}
              empty={loading}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading title="Capacity" detail={data ? `${data.resource.sku} · ${data.resource.region}` : "App Service plan"} />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
            <MetricChart
              title="Compute pressure"
              range={range}
              series={data?.series ?? []}
              lines={[
                { key: "cpuPercent", label: "CPU", color: "#253EE0" },
                { key: "memoryPercent", label: "Memory", color: "#F59E0B" },
              ]}
              fixedMaximum={100}
              value={`${formatDecimal(summary?.averageCpuPercent ?? 0, 1)}% CPU`}
              empty={loading}
            />
            <aside className="border-2 border-black/20 p-4 dark:border-white/20 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-black/55 dark:text-[#D5D5D5]/55">
                    Worker
                  </span>
                  <strong className="mt-1 block text-xl">
                    {data?.resource.sku ?? "B2"} / Linux
                  </strong>
                  <span className="text-xs text-black/55 dark:text-[#D5D5D5]/55">
                    {data?.resource.instanceCount ?? 1} instance · {data?.resource.planName ?? "App Service"}
                  </span>
                </div>
                <Server className="size-5" aria-hidden />
              </div>
              <CapacityRow
                label="CPU"
                value={summary?.averageCpuPercent ?? 0}
                peak={summary?.peakCpuPercent ?? 0}
                loading={loading}
              />
              <CapacityRow
                label="Memory"
                value={summary?.averageMemoryPercent ?? 0}
                peak={summary?.peakMemoryPercent ?? 0}
                loading={loading}
              />
              <div className="grid grid-cols-2 gap-3 border-t border-black/15 pt-4 dark:border-white/15">
                <div>
                  <span className="text-xs text-black/55 dark:text-[#D5D5D5]/55">Working set</span>
                  <strong className="mt-1 block text-xl">
                    {loading ? "—" : `${formatDecimal(summary?.averageWorkingSetGiB ?? 0, 2)} GiB`}
                  </strong>
                  <span className="text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
                    {loading ? "" : `${formatDecimal(summary?.peakWorkingSetGiB ?? 0, 2)} GiB peak`}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-black/55 dark:text-[#D5D5D5]/55">HTTP queue</span>
                  <strong className="mt-1 block text-xl">
                    {loading ? "—" : formatDecimal(summary?.currentQueueLength ?? 0, 0)}
                  </strong>
                  <span className="text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
                    {loading ? "" : `${formatDecimal(summary?.maxQueueLength ?? 0, 0)} peak`}
                  </span>
                </div>
              </div>
            </aside>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Peak CPU"
              value={`${formatDecimal(summary?.peakCpuPercent ?? 0, 1)}%`}
              detail={`${formatDecimal(100 - (summary?.averageCpuPercent ?? 0), 1)}% average headroom`}
              icon={Cpu}
              loading={loading}
            />
            <MetricCard
              label="Peak memory"
              value={`${formatDecimal(summary?.peakMemoryPercent ?? 0, 1)}%`}
              detail={`${formatDecimal(100 - (summary?.averageMemoryPercent ?? 0), 1)}% average headroom`}
              icon={HardDrive}
              loading={loading}
            />
            <MetricCard
              label="Data received"
              value={`${formatDecimal(summary?.bytesReceivedGiB ?? 0, 2)} GiB`}
              detail={`Across ${RANGE_LABELS[range]}`}
              loading={loading}
            />
            <MetricCard
              label="Data sent"
              value={`${formatDecimal(summary?.bytesSentGiB ?? 0, 2)} GiB`}
              detail={`Across ${RANGE_LABELS[range]}`}
              loading={loading}
            />
          </div>
        </section>

        <footer className="border-t-2 border-black/20 pt-5 text-xs leading-5 text-black/50 dark:border-white/20 dark:text-[#D5D5D5]/50">
          Azure Monitor platform metrics usually arrive one to three minutes late.
          “Live” means the newest published platform sample, not request-level tracing.
        </footer>
      </div>
    </div>
  );
}
