import { performance } from "node:perf_hooks";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  rounds: { type: "string", default: "5" },
  mode: { type: "string", default: "html" },
  paths: { type: "string", default: "/,/past_papers,/notes" },
  output: { type: "string" },
  "perf-token-file": { type: "string" },
  label: { type: "string", default: "benchmark" },
  "round-delay-ms": { type: "string", default: "0" },
} });
const rounds = Number(values.rounds);
const roundDelayMs = Number(values["round-delay-ms"]);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error("rounds must be 1–20");
if (!Number.isInteger(roundDelayMs) || roundDelayMs < 0 || roundDelayMs > 300000) {
  throw new Error("round-delay-ms must be 0–300000");
}
if (!["html", "rsc", "both"].includes(values.mode)) throw new Error("mode must be html, rsc, or both");
const hosts = ["https://examcooker.acmvit.in", "https://ec-test.acmvit.in"];
const paths = values.paths.split(",");
if (paths.some((path) => !path.startsWith("/") || path.startsWith("//"))) throw new Error("Expected relative route paths");
const modes = values.mode === "both" ? ["html", "rsc"] : [values.mode];
const token = values["perf-token-file"] ? readFileSync(values["perf-token-file"], "utf8").trim() : undefined;
if (values.output) writeFileSync(values.output, "");
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

for (const mode of modes) for (const path of paths) {
  const samples = [];
  const targets = new Map(hosts.map((base) => [base, new URL(path, base)]));
  if (mode === "rsc") {
    // Next's router supplies a header-derived _rsc hash. Discover the deployed
    // version's value before timing, so a synthetic missing-hash redirect does
    // not add a round trip to every navigation sample.
    await Promise.all(hosts.map(async (base) => {
      const target = targets.get(base);
      const response = await fetch(target, {
        headers: { rsc: "1" }, redirect: "manual", signal: AbortSignal.timeout(30000),
      });
      await response.body?.cancel();
      if (response.status === 307 && response.headers.has("location")) {
        const canonical = new URL(response.headers.get("location"), target);
        const withoutHash = new URL(canonical);
        withoutHash.searchParams.delete("_rsc");
        if (!canonical.searchParams.has("_rsc") || withoutHash.href !== target.href) {
          throw new Error(`Unexpected RSC redirect for ${target.pathname} on ${target.hostname}`);
        }
        targets.set(base, canonical);
      } else if (response.status !== 200) {
        throw new Error(`RSC discovery returned HTTP ${response.status} on ${target.hostname}`);
      }
    }));
  }
  // Round zero is a separately reported warmup, not a controlled cold start.
  for (let round = 0; round <= rounds; round++) {
    if (round > 0 && roundDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, roundDelayMs));
    }
    await Promise.all(hosts.map(async (base) => {
      const start = performance.now();
      const host = new URL(base).hostname;
      const id = `${values.label}-${mode}-${paths.indexOf(path)}-${round}`;
      let row = { label: values.label, id, host, path, mode, round, roundDelayMs, warmup: round === 0 };
      try {
        const headers = mode === "rsc" ? { rsc: "1" } : {};
        if (token && host === "ec-test.acmvit.in") {
          headers["x-ec-perf-token"] = token;
          headers["x-ec-perf-id"] = id;
        }
        const response = await fetch(targets.get(base), { headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
        const headersMs = Math.round(performance.now() - start);
        let firstByteMs;
        const chunks = [];
        for await (const chunk of response.body) {
          firstByteMs ??= Math.round(performance.now() - start);
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const text = body.toString();
        const digests = [...text.matchAll(/<template[^>]*data-dgst="([^"]*)"/g)]
          .map((match) => match[1]).filter((digest) => digest !== "BAILOUT_TO_CLIENT_SIDE_RENDERING");
        if (mode === "rsc") for (const match of text.matchAll(/^[0-9a-f]+:E(.+)$/gm)) {
          try {
            const digest = String(JSON.parse(match[1]).digest ?? "RSC_ERROR");
            if (digest !== "BAILOUT_TO_CLIENT_SIDE_RENDERING") digests.push(digest);
          } catch { digests.push("INVALID_RSC_ERROR_ROW"); }
        }
        const type = response.headers.get("content-type") ?? "";
        const complete = mode === "html" ? text.includes("</body></html>") : type.includes("text/x-component") && /^[0-9a-f]+:/m.test(text);
        row = { ...row, status: response.status, headersMs, firstByteMs,
          totalMs: Math.round(performance.now() - start), bytes: body.length, complete, digests,
          colo: response.headers.get("cf-ray")?.split("-").at(-1),
          serverTiming: response.headers.get("server-timing"),
          rscHashSupplied: mode === "rsc" && targets.get(base).searchParams.has("_rsc") };
        if (response.status !== 200 || !complete || digests.length) process.exitCode = 1;
      } catch (error) {
        row = { ...row, error: error.name, totalMs: Math.round(performance.now() - start) };
        process.exitCode = 1;
      }
      if (values.output) appendFileSync(values.output, JSON.stringify(row) + "\n");
      else console.log(JSON.stringify(row));
      samples.push(row);
    }));
  }
  console.error(JSON.stringify({ mode, path, results: hosts.map((base) => {
    const host = new URL(base).hostname;
    const rows = samples.filter((row) => row.host === host && !row.warmup);
    const successful = rows.filter((row) => row.status === 200 && row.complete && !row.digests.length);
    const firstRequest = samples.find((row) => row.host === host && row.warmup);
    return { host, samples: rows.length, failed: rows.length - successful.length,
      // Surface the first visit separately: a warm median can hide the delay
      // people experience when opening an infrequently visited course.
      firstRequestTotalMs: firstRequest?.totalMs ?? null,
      firstRequestValid: firstRequest?.status === 200 && firstRequest.complete && !firstRequest.digests?.length,
      firstByteMs: successful.length ? median(successful.map((row) => row.firstByteMs)) : null,
      totalMs: successful.length ? median(successful.map((row) => row.totalMs)) : null,
      slowestMeasuredMs: successful.length ? Math.max(...successful.map((row) => row.totalMs)) : null };
  }) }));
}
