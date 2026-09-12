import { performance } from "node:perf_hooks";

const hosts = ["https://examcooker.acmvit.in", "https://ec-test.acmvit.in"];
const paths = ["/", "/past_papers", "/notes"];
for (const path of paths) {
  for (let round = 0; round < 3; round++) {
    await Promise.all(hosts.map(async (base) => {
      const start = performance.now();
      try {
        const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
        const firstByteMs = Math.round(performance.now() - start);
        const body = await response.text();
        const digests = [...body.matchAll(/<template[^>]*data-dgst="([^"]*)"/g)].map((m) => m[1]);
        const complete = body.includes("</body></html>");
        if (response.status !== 200 || !complete) process.exitCode = 1;
        console.log(JSON.stringify({
          host: new URL(base).hostname, path, round, status: response.status,
          firstByteMs, totalMs: Math.round(performance.now() - start),
          bytes: Buffer.byteLength(body), complete, digests,
          colo: response.headers.get("cf-ray")?.split("-").at(-1),
        }));
      } catch (error) {
        console.log(JSON.stringify({ host: new URL(base).hostname, path, round,
          error: error.name, totalMs: Math.round(performance.now() - start) }));
        process.exitCode = 1;
      }
    }));
  }
}
