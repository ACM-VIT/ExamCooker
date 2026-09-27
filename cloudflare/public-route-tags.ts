// The entry Worker and bundled OpenNext config can contain separate copies of
// this module. A shared symbol connects them without retaining request objects.
const PATHS = Symbol.for("examcooker.public-request-paths");
const COURSE = /^[a-z]{2,8}\d{3,4}[a-z]?$/i;
const EXAM = /^(?:cat-[12]|fat|model-cat-[12]|model-fat|mid|quiz|cia|other)$/;
const CATALOG_TAGS = ["courses", "notes", "past_papers", "syllabus", "upcoming_exams"];

/** Only public route/data tags: no sessions or user-specific cache entries. */
export function publicRouteTags(pathname: string): string[] | undefined {
  const segments = pathname.split("/").filter(Boolean);
  let route: string[];
  let dataTags = CATALOG_TAGS;
  if (pathname === "/") {
    route = ["(home)"];
  } else if (segments[0] === "past_papers" && segments.length === 1) {
    route = ["past_papers"];
  } else if (segments[0] === "past_papers" && segments.length === 3 &&
    segments[1] === "exam" && EXAM.test(segments[2])) {
    route = ["past_papers", "exam", "[exam]"];
  } else if (segments[0] === "past_papers" && COURSE.test(segments[1] ?? "")) {
    route = ["past_papers", "[code]"];
    if (segments.length === 3 && EXAM.test(segments[2])) route.push("[exam]");
    else if (segments.length === 4 && segments[2] === "paper" && /^[a-z0-9]{1,64}$/i.test(segments[3])) {
      route.push("paper", "[id]");
      dataTags = ["past_papers", `past_paper:${segments[3]}`, "upcoming_exams"];
    } else if (segments.length !== 2) return;
  } else return;

  const tags = ["_N_T_/layout", "_N_T_/(app)/layout"];
  let segmentPath = "/(app)";
  for (const segment of route) {
    segmentPath += `/${segment}`;
    tags.push(`_N_T_${segmentPath}/layout`);
  }
  tags.push(`_N_T_${segmentPath}/page`, `_N_T_${pathname}`, ...dataTags);
  if (pathname === "/") tags.push("_N_T_/index");
  return tags;
}

function requestPaths(): WeakMap<object, string> {
  const runtime = globalThis as typeof globalThis & { [PATHS]?: WeakMap<object, string> };
  return runtime[PATHS] ??= new WeakMap<object, string>();
}

export function recordPublicRequestPath(ctx: object, url: string, method: string) {
  if (method !== "GET" && method !== "HEAD") return;
  const pathname = new URL(url).pathname;
  if (publicRouteTags(pathname)) requestPaths().set(ctx, pathname);
}

export function getPublicRequestPath(ctx: object) {
  return requestPaths().get(ctx);
}
