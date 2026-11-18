/**
 * Picks the values an inline editor opens with.
 *
 * A save updates the editor's own baseline at once, but the page's data can
 * still be the pre-save copy for a while. So the page's values replace the
 * baseline only when they differ from the ones last adopted; until then the
 * editor keeps what it saved, and reopening cannot bring back stale values.
 */
export function resolveEditorBaseline<T>(input: {
  /** The page values the baseline was last taken from. */
  adopted: T;
  /** The page values now. */
  page: T;
  /** The editor's own baseline, including its saves. */
  local: T;
  isEqual: (left: T, right: T) => boolean;
}): { adopted: T; baseline: T } {
  return input.isEqual(input.adopted, input.page)
    ? { adopted: input.adopted, baseline: input.local }
    : { adopted: input.page, baseline: input.page };
}
