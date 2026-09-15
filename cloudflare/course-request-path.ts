// The entry Worker and bundled OpenNext config can contain separate copies of
// this module. A shared symbol connects them without retaining request objects.
const PATHS = Symbol.for("examcooker.course-request-paths");
export const COURSE_PATH = /^\/past_papers\/(?:\[code\]|[a-z]{2,6}\d{3}[a-z]?)(?:\/(?:\[exam\]|cat1|cat2|fat))?$/i;

function requestPaths(): WeakMap<object, string> {
  const runtime = globalThis as typeof globalThis & { [PATHS]?: WeakMap<object, string> };
  return runtime[PATHS] ??= new WeakMap<object, string>();
}

export function recordCourseRequestPath(ctx: object, url: string) {
  const pathname = new URL(url).pathname;
  if (COURSE_PATH.test(pathname)) requestPaths().set(ctx, pathname);
}

export function getCourseRequestPath(ctx: object) {
  return requestPaths().get(ctx);
}
