import { spawnSync } from "node:child_process";

const hours = Number(process.argv[2] || 24);
if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error("Use a window of 1–168 hours.");
function call(tool, args) {
  const result = spawnSync("npx", ["--yes", "@posthog/cli@latest", "api", "call", "--json", tool, JSON.stringify(args)], { encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || "PostHog query failed; check CLI authentication.");
  return JSON.parse(result.stdout);
}
const project = call("project-get", {});
if (project.id !== 169929) throw new Error(`Expected ExamCooker project 169929 (display name Code2Create), got ${project.id}. Switch the CLI project before querying.`);
// The initial rollout's prefetch reload loop inflated document/error counts.
// Compare traffic only after the fix was deployed (allowing propagation time).
const measurementStart = "2026-09-27 01:40:00";
const filter = `timestamp >= now() - INTERVAL ${hours} HOUR AND timestamp >= toDateTime('${measurementStart}', 'UTC') AND properties.rollout = 'cf-canary-2026-09-27' AND properties.synthetic = false AND properties.eligible = true`;
const queries = {
  traffic: `SELECT properties.backend AS backend, count() AS documents, count(DISTINCT distinct_id) AS visitors, countIf(toInt(properties.status) >= 500) AS server_errors, quantile(0.50)(toFloat(properties.origin_ms)) AS origin_p50_ms, quantile(0.95)(toFloat(properties.origin_ms)) AS origin_p95_ms FROM events WHERE ${filter} AND event = 'ec_cutover_request' GROUP BY backend`,
  navigation: `SELECT properties.backend AS backend, properties.route AS route, count() AS samples, quantile(0.50)(toFloat(properties.ttfb_ms)) AS ttfb_p50_ms, quantile(0.75)(toFloat(properties.ttfb_ms)) AS ttfb_p75_ms, quantile(0.95)(toFloat(properties.ttfb_ms)) AS ttfb_p95_ms, quantile(0.75)(toFloat(properties.dom_ms)) AS dom_p75_ms FROM events WHERE ${filter} AND event = 'ec_cutover_page' GROUP BY backend, route ORDER BY samples DESC LIMIT 40`,
  vitals: `SELECT properties.backend AS backend, properties.route AS route, properties.metric AS metric, count() AS samples, quantile(0.75)(toFloat(properties.value)) AS p75, quantile(0.95)(toFloat(properties.value)) AS p95 FROM events WHERE ${filter} AND event = 'ec_cutover_vital' GROUP BY backend, route, metric ORDER BY samples DESC LIMIT 40`,
  pdf: `SELECT properties.backend AS backend, count() AS samples, quantile(0.50)(toFloat(properties.value)) AS first_pdf_p50_ms, quantile(0.75)(toFloat(properties.value)) AS first_pdf_p75_ms, quantile(0.95)(toFloat(properties.value)) AS first_pdf_p95_ms FROM events WHERE ${filter} AND event = 'ec_cutover_pdf' GROUP BY backend`,
  errors: `SELECT properties.backend AS backend, count() AS error_events, count(DISTINCT properties.page_id) AS affected_documents FROM events WHERE ${filter} AND event = 'ec_cutover_error' GROUP BY backend`,
};
console.log(JSON.stringify({ project: project.id, hours, measurementStartUTC: measurementStart, note: "Synthetic probes, signed-in traffic and the prefetch reload incident excluded. Navigation/vitals measure full document loads; LCP and CLS arrive when a tab is hidden. Compare matched routes, countries and devices with adequate samples." }));
for (const [name, query] of Object.entries(queries)) {
  const result = call("execute-sql", { query });
  console.log(`\n${name}\n${typeof result.results === "string" ? result.results : JSON.stringify(result.results)}`);
}
