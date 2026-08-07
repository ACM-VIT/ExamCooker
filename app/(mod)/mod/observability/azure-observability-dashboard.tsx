"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CircleGauge,
  Clock3,
  Cloud,
  Cpu,
  DatabaseZap,
  Gauge,
  RefreshCw,
  Server,
  ShieldCheck,
  Siren,
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
import styles from "./observability.module.css";

const RANGE_LABELS: Record<AzureMonitorRange, string> = {
  "1h": "Live · 1H",
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
};

const RANGE_COPY: Record<AzureMonitorRange, string> = {
  "1h": "one-minute resolution",
  "24h": "five-minute resolution",
  "7d": "hourly resolution",
  "30d": "six-hour resolution",
};

const SERVER_ERROR_BUDGET_PERCENT = 0.5;

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type MetricKey = keyof Pick<
  AzureMonitorPoint,
  | "rps"
  | "cpuPercent"
  | "memoryPercent"
  | "responseTimeMs"
  | "errorRatePercent"
  | "queueLength"
>;

type ChartLine = {
  key: MetricKey;
  label: string;
  color: string;
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
    notation: value >= 1_000 ? "compact" : "standard",
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
  return `${formatCompact(valueMs)} ms`;
}

function formatMetricAge(timestamp: string | null) {
  if (!timestamp) return "waiting for Azure";
  const ageSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 1_000),
  );
  if (ageSeconds < 60) return `${ageSeconds}s behind`;
  return `${Math.round(ageSeconds / 60)}m behind`;
}

function formatUpdatedAt(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function chartTimestamp(timestamp: string, range: AzureMonitorRange) {
  const options: Intl.DateTimeFormatOptions =
    range === "1h" || range === "24h"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { day: "2-digit", month: "short" };
  return new Intl.DateTimeFormat("en-IN", options).format(new Date(timestamp));
}

function buildLinePath(
  series: AzureMonitorPoint[],
  key: MetricKey,
  maxValue: number,
) {
  if (series.length < 2) return "";
  let path = "";
  let drawing = false;
  for (let index = 0; index < series.length; index += 1) {
    const value = series[index]?.[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      drawing = false;
      continue;
    }
    const x = (index / (series.length - 1)) * 1000;
    const y = 210 - Math.min(1, Math.max(0, value / maxValue)) * 178;
    path += `${drawing ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    drawing = true;
  }
  return path.trim();
}

function MetricChart({
  description,
  empty,
  fixedMaximum,
  lines,
  range,
  series,
  title,
  valueLabel,
}: {
  description: string;
  empty: boolean;
  fixedMaximum?: number;
  lines: ChartLine[];
  range: AzureMonitorRange;
  series: AzureMonitorPoint[];
  title: string;
  valueLabel: string;
}) {
  const allValues = lines.flatMap((line) =>
    series.flatMap((point) => {
      const value = point[line.key];
      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    }),
  );
  const dataMaximum = allValues.length > 0 ? Math.max(...allValues) : 1;
  const maxValue = fixedMaximum ?? Math.max(dataMaximum * 1.12, 1);
  const firstTimestamp = series[0]?.timestamp;
  const middleTimestamp = series[Math.floor(series.length / 2)]?.timestamp;
  const lastTimestamp = series.at(-1)?.timestamp;

  return (
    <section className={styles.chartCard} aria-label={`${title}: ${description}`}>
      <header className={styles.chartHeader}>
        <div>
          <p className={styles.eyebrow}>{description}</p>
          <h2>{title}</h2>
        </div>
        <div className={styles.chartValue}>{empty ? "—" : valueLabel}</div>
      </header>
      <div className={styles.chartFrame} data-loading={empty}>
        {empty ? <div className={styles.chartSkeleton} aria-hidden="true" /> : null}
        <svg
          className={styles.chart}
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
              className={styles.gridLine}
            />
          ))}
          {!empty
            ? lines.map((line) => (
                <path
                  key={line.key}
                  d={buildLinePath(series, line.key, maxValue)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  className={styles.metricLine}
                />
              ))
            : null}
        </svg>
        <div className={styles.chartAxis} aria-hidden="true">
          <span>{firstTimestamp ? chartTimestamp(firstTimestamp, range) : "—"}</span>
          <span>{middleTimestamp ? chartTimestamp(middleTimestamp, range) : "—"}</span>
          <span>{lastTimestamp ? chartTimestamp(lastTimestamp, range) : "—"}</span>
        </div>
      </div>
      <footer className={styles.legend}>
        {lines.map((line) => (
          <span key={line.key}>
            <i style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </footer>
    </section>
  );
}

function KpiCard({
  detail,
  icon: IconComponent,
  label,
  loading,
  tone = "neutral",
  value,
}: {
  detail: string;
  icon: Icon;
  label: string;
  loading: boolean;
  tone?: "neutral" | "good" | "warn" | "bad";
  value: string;
}) {
  return (
    <article className={styles.kpiCard} data-tone={tone}>
      <div className={styles.kpiTopline}>
        <span>{label}</span>
        <IconComponent aria-hidden="true" />
      </div>
      <strong className={loading ? styles.valueSkeleton : undefined}>
        {loading ? "00.0" : value}
      </strong>
      <p>{loading ? "loading Azure signal" : detail}</p>
    </article>
  );
}

function CapacityBar({
  color,
  label,
  loading,
  value,
}: {
  color: string;
  label: string;
  loading: boolean;
  value: number;
}) {
  return (
    <div className={styles.capacityRow}>
      <div>
        <span>{label}</span>
        <strong>{loading ? "—" : `${formatDecimal(value, 1)}%`}</strong>
      </div>
      <div className={styles.capacityTrack}>
        <i
          style={{
            backgroundColor: color,
            width: loading ? "36%" : `${Math.min(100, Math.max(1, value))}%`,
          }}
          data-loading={loading}
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
  const loading = data === null;
  const summary = data?.summary;
  const healthState = data?.health.state ?? "watch";
  const serverErrorTone =
    (summary?.serverErrorRatePercent ?? 0) >= 2
      ? "bad"
      : (summary?.serverErrorRatePercent ?? 0) >= 0.5
        ? "warn"
        : "good";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <Link href="/mod" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" />
            Control room
          </Link>
          <div className={styles.azureMark}>
            <Cloud aria-hidden="true" />
            <span>AZURE MONITOR</span>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadMetrics(range)}
            disabled={refreshing || !enabled}
          >
            <RefreshCw aria-hidden="true" data-spinning={refreshing} />
            Refresh
          </button>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.liveLabel}>
              <span /> LIVE TELEMETRY
            </div>
            <h1>
              ExamCooker
              <em> pulse.</em>
            </h1>
            <p>
              A direct read on requests, reliability and the single B2 worker
              serving production in South India.
            </p>
          </div>
          <section className={styles.healthPanel} data-state={healthState}>
            <div className={styles.healthOrb}>
              <Waves aria-hidden="true" />
            </div>
            <div>
              <span>System condition</span>
              <strong>{data?.health.label ?? "Establishing signal"}</strong>
              <p>{data?.health.reasons[0] ?? "Connecting to Azure Monitor"}</p>
            </div>
          </section>
        </header>

        <section className={styles.controlStrip}>
          <div className={styles.rangePicker} aria-label="Metric time range">
            {AZURE_MONITOR_RANGES.map((candidate) => (
              <button
                type="button"
                key={candidate}
                data-active={range === candidate}
                aria-pressed={range === candidate}
                onClick={() => setRange(candidate)}
              >
                {RANGE_LABELS[candidate]}
              </button>
            ))}
          </div>
          <div className={styles.freshness}>
            <Clock3 aria-hidden="true" />
            <span>
              {data
                ? `Updated ${formatUpdatedAt(data.fetchedAt)} · ${formatMetricAge(data.latestMetricAt)}`
                : "Opening secure Azure stream"}
            </span>
          </div>
        </section>

        {error ? (
          <div className={styles.errorBanner} role="alert">
            <Siren aria-hidden="true" />
            <div>
              <strong>Azure signal interrupted</strong>
              <span>{error}. The dashboard will retry automatically.</span>
            </div>
          </div>
        ) : null}

        <section className={styles.kpiGrid}>
          <KpiCard
            icon={Activity}
            label="Average traffic"
            value={`${formatDecimal(summary?.averageRps ?? 0, 2)} rps`}
            detail={`${formatCompact(summary?.totalRequests ?? 0)} requests in ${RANGE_LABELS[range]}`}
            loading={loading}
          />
          <KpiCard
            icon={Gauge}
            label="Peak traffic"
            value={`${formatDecimal(summary?.peakRps ?? 0, 1)} rps`}
            detail={`Highest ${RANGE_COPY[range]} bucket`}
            loading={loading}
          />
          <KpiCard
            icon={ShieldCheck}
            label="Server-side success"
            value={`${formatDecimal(summary?.successRatePercent ?? 0, 2)}%`}
            detail={`${formatCompact(summary?.serverErrors ?? 0)} server errors observed`}
            loading={loading}
            tone={serverErrorTone}
          />
          <KpiCard
            icon={TimerReset}
            label="Average response"
            value={formatLatency(summary?.averageResponseTimeMs ?? 0)}
            detail={`Peak ${formatLatency(summary?.peakResponseTimeMs ?? 0)}`}
            loading={loading}
            tone={(summary?.averageResponseTimeMs ?? 0) > 2_000 ? "warn" : "neutral"}
          />
        </section>

        <section className={styles.primaryGrid}>
          <MetricChart
            title="Request velocity"
            description="Traffic waveform"
            range={range}
            series={data?.series ?? []}
            lines={[{ key: "rps", label: "Requests / second", color: "#48f0b4" }]}
            valueLabel={`${formatDecimal(summary?.currentRps ?? 0, 2)} rps now`}
            empty={loading}
          />
          <aside className={styles.capacityCard}>
            <header>
              <div>
                <p className={styles.eyebrow}>Worker headroom</p>
                <h2>Capacity</h2>
              </div>
              <CircleGauge aria-hidden="true" />
            </header>
            <div className={styles.machineTag}>
              <Server aria-hidden="true" />
              <div>
                <strong>{data?.resource.sku ?? "B2"} / Linux</strong>
                <span>
                  {data?.resource.instanceCount ?? 1} instance · {data?.resource.region ?? "South India"}
                </span>
              </div>
            </div>
            <CapacityBar
              label="Average CPU"
              value={summary?.averageCpuPercent ?? 0}
              color="#65b5ff"
              loading={loading}
            />
            <CapacityBar
              label="Average memory"
              value={summary?.averageMemoryPercent ?? 0}
              color="#ffb65c"
              loading={loading}
            />
            <CapacityBar
              label="99.5% SLO error budget used"
              value={Math.min(
                100,
                ((summary?.serverErrorRatePercent ?? 0) /
                  SERVER_ERROR_BUDGET_PERCENT) *
                  100,
              )}
              color="#ff667c"
              loading={loading}
            />
            <div className={styles.queueReadout}>
              <DatabaseZap aria-hidden="true" />
              <span>Peak HTTP queue</span>
              <strong>{loading ? "—" : formatDecimal(summary?.maxQueueLength ?? 0, 0)}</strong>
            </div>
          </aside>
        </section>

        <section className={styles.chartGrid}>
          <MetricChart
            title="Compute pressure"
            description="App Service plan"
            range={range}
            series={data?.series ?? []}
            lines={[
              { key: "cpuPercent", label: "CPU", color: "#65b5ff" },
              { key: "memoryPercent", label: "Memory", color: "#ffb65c" },
            ]}
            fixedMaximum={100}
            valueLabel={`${formatDecimal(summary?.averageCpuPercent ?? 0, 1)}% / ${formatDecimal(summary?.averageMemoryPercent ?? 0, 1)}%`}
            empty={loading}
          />
          <MetricChart
            title="Server error rate"
            description="Reliability signal"
            range={range}
            series={data?.series ?? []}
            lines={[
              { key: "errorRatePercent", label: "HTTP 5xx", color: "#ff667c" },
            ]}
            valueLabel={`${formatDecimal(summary?.serverErrorRatePercent ?? 0, 2)}%`}
            empty={loading}
          />
          <MetricChart
            title="Response time"
            description="Backend duration"
            range={range}
            series={data?.series ?? []}
            lines={[
              { key: "responseTimeMs", label: "Average milliseconds", color: "#c59cff" },
            ]}
            valueLabel={formatLatency(summary?.averageResponseTimeMs ?? 0)}
            empty={loading}
          />
        </section>

        <section className={styles.statRail}>
          <div>
            <Activity aria-hidden="true" />
            <span>Daily run rate</span>
            <strong>
              {loading
                ? "—"
                : formatCompact((summary?.averageRps ?? 0) * 86_400)}
            </strong>
          </div>
          <div>
            <Waves aria-hidden="true" />
            <span>Burst factor</span>
            <strong>
              {loading
                ? "—"
                : `${formatDecimal(
                    (summary?.peakRps ?? 0) /
                      Math.max(summary?.averageRps ?? 0, 0.01),
                    1,
                  )}×`}
            </strong>
          </div>
          <div>
            <Cpu aria-hidden="true" />
            <span>Average CPU headroom</span>
            <strong>
              {loading
                ? "—"
                : `${formatDecimal(100 - (summary?.averageCpuPercent ?? 0), 1)}%`}
            </strong>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>99.5% SLO budget left</span>
            <strong>
              {loading
                ? "—"
                : `${formatDecimal(
                    Math.max(
                      0,
                      100 -
                        ((summary?.serverErrorRatePercent ?? 0) /
                          SERVER_ERROR_BUDGET_PERCENT) *
                          100,
                    ),
                    1,
                  )}%`}
            </strong>
          </div>
        </section>

        <footer className={styles.footer}>
          <div>
            <span className={styles.footerPulse} />
            Secure server-side Azure Resource Manager connection
          </div>
          <p>
            Azure Monitor metrics usually arrive 1–3 minutes late. “Live” reflects
            the newest published platform sample, not request-level tracing.
          </p>
        </footer>
      </div>
    </main>
  );
}
