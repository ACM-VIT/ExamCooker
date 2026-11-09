import assert from "node:assert/strict";
import { test } from "node:test";
import { reducer } from "./use-toast";

test("toasts beyond the limit are evicted and dismissals close before removal", () => {
  const first = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: { id: "1", open: true } });
  const second = reducer(first, { type: "ADD_TOAST", toast: { id: "2", open: true } });
  assert.deepEqual(second.toasts.map((t) => t.id), ["2"]);

  const dismissed = reducer(second, { type: "DISMISS_TOAST", toastId: "2" });
  assert.equal(dismissed.toasts[0]?.open, false);
  assert.deepEqual(reducer(dismissed, { type: "REMOVE_TOAST", toastId: "2" }).toasts, []);
});
