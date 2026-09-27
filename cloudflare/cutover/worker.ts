import rum from "./rum.js.txt";
import { Backend, COOKIE, PREFIX, ROLLOUT, chooseBackend, hasSession, isAzureOnly, isDocument, isPublicPage, originUrl, routeLabel } from "./policy";
import { sign, verify } from "./tokens";

interface Env {
  CANARY: Fetcher;
  CF_PERCENT: string;
  SIGNING_SECRET: string;
  PROBE_SECRET: string;
  POSTHOG_KEY: string;
}
type Assignment = { backend: Backend; id: string; rollout: string; exp: number };
type Context = Assignment & { page: string; route: string; synthetic: boolean; eligible: boolean; country: string; device: string };
const ORIGIN = "https://examcooker.acmvit.in";
const noStore = { "cache-control": "private, no-store", "cloudflare-cdn-cache-control": "no-store" };

async function capture(env: Env, context: Context, event: string, values: Record<string, unknown>) {
  try {
    const response = await fetch("https://eu.i.posthog.com/i/v0/e/", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: env.POSTHOG_KEY, event, distinct_id: `ec-rollout:${context.id}`, properties: {
        $process_person_profile: false, $geoip_disable: true, rollout: ROLLOUT,
        backend: context.backend, page_id: context.page, route: context.route,
        synthetic: context.synthetic, eligible: context.eligible, country: context.country,
        device: context.device, ...values,
      } }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(JSON.stringify({ event: "telemetry_failure", status: response.status }));
  } catch { console.error('{"event":"telemetry_failure"}'); }
}

async function telemetry(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin || Number(request.headers.get("content-length") || 0) > 4096) return new Response(null, { status: 403, headers: noStore });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers: noStore });
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4096) { await reader.cancel(); return new Response(null, { status: 413, headers: noStore }); }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  const text = new TextDecoder().decode(combined);
  let body;
  try { body = JSON.parse(text); } catch { return new Response(null, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || typeof body.token !== "string") return new Response(null, { status: 400, headers: noStore });
  const context = await verify<Context>(body.token || "", env.SIGNING_SECRET);
  if (!context || context.rollout !== ROLLOUT || context.exp < Date.now() || !context.page) return new Response(null, { status: 403, headers: noStore });
  const values: Record<string, number | string> = {};
  if (body.event === "ec_cutover_page") {
    for (const field of ["ttfb_ms", "html_ms", "dom_ms"]) {
      if (!Number.isFinite(body[field]) || body[field] < 0 || body[field] > 3600000) return new Response(null, { status: 400, headers: noStore });
      values[field] = body[field];
    }
  } else if (body.event === "ec_cutover_vital" || body.event === "ec_cutover_pdf") {
    if (!Number.isFinite(body.value) || body.value < 0 || body.value > 3600000) return new Response(null, { status: 400, headers: noStore });
    values.value = body.value;
    if (body.event === "ec_cutover_vital") {
      if (!["LCP", "CLS"].includes(body.metric)) return new Response(null, { status: 400, headers: noStore });
      values.metric = body.metric;
    }
  } else if (body.event !== "ec_cutover_error") return new Response(null, { status: 400, headers: noStore });
  ctx.waitUntil(capture(env, context, body.event, values));
  return new Response(null, { status: 204, headers: noStore });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === `${PREFIX}/event`) return telemetry(request, env, ctx);
    if (url.pathname.startsWith(PREFIX)) return new Response(null, { status: 404, headers: noStore });
    const probe = request.headers.get("x-ec-probe") === env.PROBE_SECRET;
    // Preview access is authenticated; production traffic never needs a probe.
    if (url.origin !== ORIGIN && !probe) return new Response(null, { status: 404, headers: noStore });
    const percent = Math.min(100, Math.max(0, Number(env.CF_PERCENT) || 0));
    const rawCookie = (request.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    let assignment = rawCookie ? await verify<Assignment>(rawCookie, env.SIGNING_SECRET) : null;
    if (assignment?.rollout !== ROLLOUT || assignment.exp < Date.now() || !["azure", "cloudflare"].includes(assignment.backend)) assignment = null;
    const forced = request.headers.get("x-ec-force-backend");
    let backend = chooseBackend(request, assignment?.backend || null, percent, crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
    if (probe && (forced === "azure" || forced === "cloudflare") && !hasSession(request) && !isAzureOnly(url.pathname)) backend = forced;
    const document = isDocument(request);
    const eligible = !hasSession(request) && !isAzureOnly(url.pathname) && isPublicPage(url.pathname) && !/bot|crawler|spider|headless/i.test(request.headers.get("user-agent") || "");
    const minted = !assignment && document && eligible;
    if (minted) assignment = { backend, id: crypto.randomUUID(), rollout: ROLLOUT, exp: Date.now() + 86400000 };
    const requestedBackend = request.headers.get("x-ec-document-backend");
    if (!document && requestedBackend && requestedBackend !== backend) {
      return new Response(null, { status: 409, headers: { ...noStore, "x-ec-reload": "1" } });
    }
    const headers = new Headers(request.headers);
    for (const name of ["x-ec-probe", "x-ec-force-backend", "x-ec-document-backend", "host"]) headers.delete(name);
    const upstream = new Request<unknown, IncomingRequestCfProperties>(originUrl(url), new Request(request, { headers, redirect: "manual" }));
    const azure = () => fetch(upstream, { cf: { cacheTtl: 0, cacheEverything: false } });
    const started = performance.now();
    let response: Response;
    try {
      response = backend === "cloudflare" ? await env.CANARY.fetch(upstream) : await azure();
      // Only immutable, content-addressed resources can cross build boundaries.
      if (response.status === 404 && request.method === "GET" && /^\/_next\/static\/(chunks|css|media)\/.+\.(js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif)$/.test(url.pathname)) {
        const fallback = backend === "cloudflare" ? await azure() : await env.CANARY.fetch(upstream);
        if (fallback.ok) { response = fallback; backend = backend === "azure" ? "cloudflare" : "azure"; }
      }
    } catch {
      response = new Response("Temporarily unavailable", { status: 502, headers: noStore });
    }
    const elapsed = Math.round(performance.now() - started);
    response = new Response(response.body, response);
    response.headers.set("x-ec-backend", backend);
    response.headers.set("x-ec-rollout", ROLLOUT);
    response.headers.append("server-timing", `ec_origin;dur=${elapsed};desc="${backend}"`);
    if (!url.pathname.startsWith("/_next/static/") && !url.pathname.startsWith("/vendor/embedpdf/immutable/")) {
      for (const [key, value] of Object.entries(noStore)) response.headers.set(key, value);
      response.headers.delete("etag");
      response.headers.delete("last-modified");
    }
    if (minted) response.headers.append("set-cookie", `${COOKIE}=${await sign(assignment!, env.SIGNING_SECRET)}; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax`);
    if (document) {
      const context: Context = { backend, id: assignment?.id || crypto.randomUUID(), rollout: ROLLOUT,
        exp: Date.now() + 7200000, page: crypto.randomUUID(), route: routeLabel(url.pathname),
        synthetic: probe || /bot|crawler|spider|headless/i.test(request.headers.get("user-agent") || ""), eligible,
        country: String(request.cf?.country || "unknown"), device: /mobile|android/i.test(request.headers.get("user-agent") || "") ? "mobile" : "desktop",
      };
      ctx.waitUntil(capture(env, context, "ec_cutover_request", { status: response.status, origin_ms: elapsed }));
      if (response.headers.get("content-type")?.includes("text/html")) {
        const token = await sign(context, env.SIGNING_SECRET);
        response = new HTMLRewriter().on("head", { element(element) {
          element.prepend(`<script data-backend="${backend}" data-token="${token}">${rum}</script>`, { html: true });
        } }).transform(response);
      }
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
