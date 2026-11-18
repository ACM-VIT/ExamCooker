import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileSavedPageEdits, savePageEditsLocally } from "./saved-page-edits";

const initial = { propKey: "base", value: "base", pendingKeys: [] };

test("a local save is kept until the refreshed prop catches up", () => {
  const saved = savePageEditsLocally(initial, "a", "a");
  assert.equal(reconcileSavedPageEdits(saved, "base", "base"), saved);
  assert.deepEqual(reconcileSavedPageEdits(saved, "a", "a"), { propKey: "a", value: "a", pendingKeys: [] });
});

test("an earlier save arriving does not roll back a later one", () => {
  const saved = savePageEditsLocally(savePageEditsLocally(initial, "a", "a"), "b", "b");
  const afterFirst = reconcileSavedPageEdits(saved, "a", "a");
  assert.equal(afterFirst.value, "b");
  assert.deepEqual(reconcileSavedPageEdits(afterFirst, "b", "b"), { propKey: "b", value: "b", pendingKeys: [] });
});

test("a change saved elsewhere replaces a pending local save", () => {
  const saved = savePageEditsLocally(initial, "a", "a");
  assert.deepEqual(reconcileSavedPageEdits(saved, "other", "other"), {
    propKey: "other",
    value: "other",
    pendingKeys: [],
  });
});
