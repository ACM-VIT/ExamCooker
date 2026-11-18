/**
 * Picks the values an inline editor opens with.
 *
 * A save updates the editor's own baseline at once, but the page's data can
 * still be an older copy for a while: the one from before the save, or the
 * refresh after an earlier save. So the editor remembers the saves the page
 * has not shown yet, oldest first. Page values that match the ones last
 * adopted or an earlier pending save are stale and the editor keeps what it
 * saved. Page values that match the latest save, or none of them (someone
 * else changed the resource), replace the baseline.
 */
export function resolveEditorBaseline<T>(input: {
  /** The page values the baseline was last taken from. */
  adopted: T;
  /** The page values now. */
  page: T;
  /** The editor's own baseline, including its saves. */
  local: T;
  /** Values this editor saved that the page has not shown yet, oldest first. */
  pending: readonly T[];
  isEqual: (left: T, right: T) => boolean;
}): { adopted: T; baseline: T; pending: readonly T[] } {
  if (input.isEqual(input.adopted, input.page)) {
    return { adopted: input.adopted, baseline: input.local, pending: input.pending };
  }

  let shown = -1;
  input.pending.forEach((saved, index) => {
    if (input.isEqual(saved, input.page)) {
      shown = index;
    }
  });

  if (shown >= 0 && shown < input.pending.length - 1) {
    // The page caught up with an earlier save only; later ones are still due.
    return {
      adopted: input.page,
      baseline: input.local,
      pending: input.pending.slice(shown + 1),
    };
  }

  return { adopted: input.page, baseline: input.page, pending: [] };
}
