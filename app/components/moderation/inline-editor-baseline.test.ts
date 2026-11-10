import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEditorBaseline } from "./inline-editor-baseline";

const isEqual = (left: { title: string }, right: { title: string }) =>
  left.title === right.title;

test("reopening after a save keeps the saved values while the page is stale", () => {
  const adopted = { title: "Foo" };
  const saved = { title: "Bar" };
  // The page re-rendered with a new object that still holds the old title.
  const next = resolveEditorBaseline({ adopted, page: { title: "Foo" }, local: saved, isEqual });
  assert.equal(next.baseline, saved);
  assert.equal(next.adopted, adopted);
});

test("page values replace the baseline once they change", () => {
  const refreshed = { title: "Baz" };
  const next = resolveEditorBaseline({
    adopted: { title: "Foo" },
    page: refreshed,
    local: { title: "Bar" },
    isEqual,
  });
  assert.equal(next.baseline, refreshed);
  assert.equal(next.adopted, refreshed);
});
