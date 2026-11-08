const TAKEOVER_STATES = '[data-ec-pdf-load-error="true"], [data-ec-pdf-page-error="true"], [data-ec-pdf-view-mode]:not([data-ec-pdf-view-mode="pdf"])';
const FIRST_PAGE = 'img[data-ec-pdf-page-image="true"][data-ec-pdf-page-index="0"]';

/** A first-page preview stays only until its document's viewer has taken over. */
export function isPdfPreviewShown(previewUrl: string | null | undefined, fileUrl: string, settledFile: string | null) {
  return Boolean(previewUrl) && settledFile !== fileUrl;
}

/**
 * Call `onTakeover` once, when the viewer under `root` paints its first
 * displayed page, shows an error, or leaves PDF mode, then stop watching.
 * Returns a cleanup function.
 */
export function watchPdfPreviewTakeover(root: HTMLElement, onTakeover: () => void) {
  const isFirstPage = (image: unknown): image is HTMLImageElement =>
    image instanceof HTMLImageElement && image.matches(FIRST_PAGE);
  let watching = true;
  const stop = () => {
    watching = false;
    root.removeEventListener("load", painted, true);
    observer.disconnect();
  };
  const takeOver = () => {
    if (!watching) return;
    stop();
    onTakeover();
  };
  // Image load events do not bubble; capture them. A buffered later page can
  // finish first, so only page index 0 counts.
  function painted(event: Event) {
    if (isFirstPage(event.target)) takeOver();
  }
  // Error states carry their own recovery actions, and the Markdown view has
  // no page images. A first page that painted before this ran also counts.
  const check = () => {
    const firstPage = root.querySelector(FIRST_PAGE);
    if (root.querySelector(TAKEOVER_STATES) ||
      (isFirstPage(firstPage) && firstPage.complete && firstPage.naturalWidth > 0)) takeOver();
  };
  const observer = new MutationObserver(check);
  root.addEventListener("load", painted, true);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ec-pdf-view-mode"] });
  check();
  return stop;
}
