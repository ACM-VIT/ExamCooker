export const NAVIGATION_EVENT = "examcooker:navigation";

function trimHash(path: string) {
  const hashIndex = path.indexOf("#");
  return hashIndex === -1 ? path : path.slice(0, hashIndex);
}

export function currentBrowserPath() {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function toRouteRenderPath(path: string) {
  if (typeof window !== "undefined") {
    try {
      const url = new URL(path, window.location.origin);
      return `${url.pathname}${url.search}`;
    } catch {
      return trimHash(path);
    }
  }

  return trimHash(path);
}

export function currentBrowserRoutePath() {
  return toRouteRenderPath(currentBrowserPath());
}

export function currentRenderedRoutePath() {
  if (typeof document === "undefined") {
    return "";
  }

  return (
    document.documentElement.dataset.examcookerRenderedRoutePath ??
    currentBrowserRoutePath()
  );
}

export function markRenderedRoutePath(path: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.examcookerRenderedRoutePath = path;
}
