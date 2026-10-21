import { normalizeCourseCode } from "@/lib/course-tags";

export const PDF_JOURNEY_READY_EVENT = "ec:pdf-viewer-ready";
export const PDF_JOURNEY_TIMEOUT_MS = 60_000;

type NavigationType = "push" | "replace" | "traverse";
type Outcome = "visible" | "render_error" | "timeout" | "backgrounded" | "superseded" | "pagehide";
type Properties = Record<string, string | number | boolean>;
type Capture = (event: "pdf_open_started" | "pdf_open_finished", properties: Properties, immediate: boolean) => void;
type Attempt = {
  path: string;
  startedAt: number;
  properties: Properties;
  timer: number;
  viewerReadyAt?: number;
};

const paperRoute = /^\/past_papers\/[^/]+\/paper\/[^/]+$/;
const cleanPath = (path: string) => (path.replace(/\/$/, "") || "/").replace(
  /^(\/past_papers\/)([^/]+)(\/paper\/)/,
  (match, prefix, code, suffix) => {
    try { return `${prefix}${encodeURIComponent(normalizeCourseCode(decodeURIComponent(code)))}${suffix}`; }
    catch { return match; }
  },
);
const sourceRoute = (path: string) => paperRoute.test(path)
  ? "paper" : /^\/past_papers\/[^/]+$/.test(path) ? "course" : "other";

// This measures client router dispatch -> a decoded, on-screen PDF page after
// two animation frames. It deliberately does not reuse the document-load clock.
// Custom properties omit route IDs, queries, URLs and document bytes. The SDK
// still attaches its usual page/session context.
export function installPdfOpenJourneyTracking(options: {
  capture: Capture;
  build: string;
  backend: string;
}) {
  if (typeof IntersectionObserver === "undefined" || typeof Element.prototype.checkVisibility !== "function") {
    return { start(_url: string, _navigationType: NavigationType) {}, dispose() {} };
  }
  let attempt: Attempt | null = null;
  let lastPath = cleanPath(location.pathname);
  let root: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  const intersections = new Map<Element, boolean>();
  let frame: number | null = null;
  let decodedImage: { image: HTMLImageElement; source: string; ready: boolean } | null = null;

  const send = (event: Parameters<Capture>[0], properties: Properties, immediate = false) => {
    try { options.capture(event, properties, immediate); } catch { /* Telemetry cannot block navigation. */ }
  };
  const stopObserving = () => {
    observer?.disconnect();
    observer = null;
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    intersections.clear();
    decodedImage = null;
    root = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const finish = (outcome: Outcome, extra: Properties = {}) => {
    if (!attempt) return;
    const current = attempt;
    attempt = null;
    clearTimeout(current.timer);
    stopObserving();
    send("pdf_open_finished", {
      ...current.properties, outcome,
      duration_ms: Math.max(0, performance.now() - current.startedAt),
      ...(current.viewerReadyAt === undefined ? {} : {
        viewer_ready_ms: current.viewerReadyAt - current.startedAt,
      }),
      ...extra,
    }, outcome === "pagehide" || outcome === "backgrounded");
  };
  const visible = (element: Element) => {
    return element.isConnected && intersections.get(element) === true &&
      element.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  };
  const check = () => {
    if (!attempt || !root || cleanPath(location.pathname) !== attempt.path || document.visibilityState !== "visible") return;
    const image = [...root.querySelectorAll<HTMLImageElement>('img[data-ec-pdf-page-image="true"]')].find(image =>
      image.complete && image.naturalWidth > 0 &&
      (image.src.startsWith("blob:") || image.src.startsWith("data:image/")) && visible(image));
    if (image) {
      if (decodedImage?.image !== image || decodedImage.source !== image.src) {
        const current = attempt;
        const pending = { image, source: image.src, ready: false };
        decodedImage = pending;
        void image.decode().then(() => {
          if (attempt !== current || decodedImage !== pending) return;
          pending.ready = true;
          // Recheck visibility after decoding and another paint boundary.
          scheduleCheck();
        }, () => {
          if (decodedImage === pending) decodedImage = null;
        });
      } else if (decodedImage.ready) {
        finish("visible", { image_source: image.src.startsWith("blob:") ? "blob" : "inline" });
      }
    } else if ([...root.querySelectorAll('[data-ec-pdf-page-error="true"], [data-ec-pdf-load-error="true"]')].some(visible)) {
      finish("render_error");
    }
  };
  const scheduleCheck = () => {
    if (!attempt || frame !== null) return;
    const current = attempt;
    // Coalesce mutations/load/scroll notifications and cross a paint boundary.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = null;
        if (attempt === current) check();
      });
    });
  };
  const attach = (candidate: HTMLElement) => {
    if (!attempt || cleanPath(candidate.dataset.ecPdfJourneyPath || "") !== attempt.path) return;
    if (root !== candidate) {
      stopObserving();
      root = candidate;
      const collect = () => {
        if (!attempt || root !== candidate) return;
        for (const element of candidate.querySelectorAll('img[data-ec-pdf-page-image="true"], [data-ec-pdf-page-error="true"], [data-ec-pdf-load-error="true"]')) {
          if (intersections.has(element)) continue;
          intersections.set(element, false);
          intersectionObserver?.observe(element);
        }
        scheduleCheck();
      };
      intersectionObserver = new IntersectionObserver(entries => {
        if (!attempt || root !== candidate) return;
        for (const entry of entries) intersections.set(entry.target, entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0);
        scheduleCheck();
      });
      observer = new MutationObserver(collect);
      // Observe only the active viewer, only for the duration of this attempt.
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
      collect();
    }
    attempt.viewerReadyAt ??= performance.now();
    scheduleCheck();
  };
  const ready = (event: Event) => {
    if (event.target instanceof HTMLElement) attach(event.target);
  };
  const loaded = (event: Event) => {
    if (attempt && root && event.target instanceof HTMLImageElement && root.contains(event.target)) scheduleCheck();
  };
  const backgrounded = () => { if (document.visibilityState === "hidden") finish("backgrounded"); };
  const pagehide = () => finish("pagehide");
  document.addEventListener(PDF_JOURNEY_READY_EVENT, ready);
  document.addEventListener("load", loaded, true);
  document.addEventListener("visibilitychange", backgrounded);
  window.addEventListener("pagehide", pagehide);

  return {
    start(url: string, navigationType: NavigationType) {
      let target: URL;
      try { target = new URL(url, location.href); } catch { return; }
      if (target.origin !== location.origin) return;
      const path = cleanPath(target.pathname);
      // Query/hash changes and repeated dispatches to the pending destination
      // do not constitute another paper open. Back/forward to a different paper does.
      if (path === lastPath) return;
      const from = sourceRoute(lastPath);
      lastPath = path;
      finish("superseded");
      if (!paperRoute.test(path)) return;
      const properties: Properties = {
        journey_id: crypto.randomUUID(), journey_version: 1, sampling_rate: 1,
        navigation_kind: "client", navigation_type: navigationType, from_route: from,
        app_revision: options.build, document_backend: options.backend,
      };
      attempt = {
        path, properties, startedAt: performance.now(),
        timer: window.setTimeout(() => finish("timeout"), PDF_JOURNEY_TIMEOUT_MS),
      };
      send("pdf_open_started", properties);
      if (document.visibilityState !== "visible") { finish("backgrounded"); return; }
      // A retained page can already contain decoded images on back/forward.
      // Its ready event re-arms the check when React makes it visible again.
      for (const candidate of document.querySelectorAll<HTMLElement>("[data-ec-pdf-journey-path]")) attach(candidate);
    },
    dispose() {
      if (attempt) clearTimeout(attempt.timer);
      attempt = null;
      stopObserving();
      document.removeEventListener(PDF_JOURNEY_READY_EVENT, ready);
      document.removeEventListener("load", loaded, true);
      document.removeEventListener("visibilitychange", backgrounded);
      window.removeEventListener("pagehide", pagehide);
    },
  };
}
