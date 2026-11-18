import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEditorBaseline } from "./inline-editor-baseline";

type Draft = { title: string };

const isEqual = (left: Draft, right: Draft) => left.title === right.title;

test("reopening after a save keeps the saved values while the page is stale", () => {
  const adopted = { title: "Foo" };
  const saved = { title: "Bar" };
  // The page re-rendered with a new object that still holds the old title.
  const next = resolveEditorBaseline({
    adopted,
    page: { title: "Foo" },
    local: saved,
    pending: [saved],
    isEqual,
  });
  assert.equal(next.baseline, saved);
  assert.equal(next.adopted, adopted);
  assert.deepEqual(next.pending, [saved]);
});

test("page values replace the baseline once they change", () => {
  const refreshed = { title: "Baz" };
  const next = resolveEditorBaseline({
    adopted: { title: "Foo" },
    page: refreshed,
    local: { title: "Bar" },
    pending: [{ title: "Bar" }],
    isEqual,
  });
  assert.equal(next.baseline, refreshed);
  assert.equal(next.adopted, refreshed);
  assert.deepEqual(next.pending, []);
});

test("a refresh for an earlier save does not replace a later save", () => {
  // The editor opens on the page values.
  const original = { title: "Original" };
  let adopted = original;
  let pending: readonly Draft[] = [];
  let local = original;

  const open = (page: Draft) => {
    const next = resolveEditorBaseline({ adopted, page, local, pending, isEqual });
    adopted = next.adopted;
    pending = next.pending;
    local = next.baseline;
    return next.baseline;
  };
  const save = (draft: Draft) => {
    local = draft;
    pending = [...pending, draft];
  };

  assert.equal(open(original).title, "Original");
  save({ title: "A" });
  // Reopen before the refresh for A arrives.
  assert.equal(open(original).title, "A");
  // The refresh for A arrives while B is being edited, then B is saved.
  const pageAfterA = { title: "A" };
  save({ title: "B" });
  // Reopen before the refresh for B arrives.
  assert.equal(open(pageAfterA).title, "B");
  assert.equal(open(pageAfterA).title, "B");
  // The refresh for B arrives.
  assert.equal(open({ title: "B" }).title, "B");
  assert.deepEqual(pending, []);
  // Someone else renames it later; the editor follows the page.
  assert.equal(open({ title: "C" }).title, "C");
});
