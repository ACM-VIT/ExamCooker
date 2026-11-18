import assert from "node:assert/strict";
import { test } from "node:test";
import { rebasePdfPageEditDraft, serializePdfPageEdits, type PdfPageEdits } from "./page-edits";

const rotated: PdfPageEdits = { pageOrder: null, pageRotations: { "0": 90 } };
const reordered: PdfPageEdits = { pageOrder: [1, 0], pageRotations: null };
const key = (edits: PdfPageEdits | null) => serializePdfPageEdits(edits, 2);

test("a page fixer draft with unsaved changes survives a refreshed saved value", () => {
  const state = { savedKey: key(null), baseline: null, draft: rotated };
  const rebased = rebasePdfPageEditDraft(state, key(reordered), reordered, 2);
  assert.deepEqual(rebased, { savedKey: key(reordered), baseline: reordered, draft: rotated });
});

test("an unchanged draft follows the newly saved value", () => {
  const state = { savedKey: key(null), baseline: null, draft: null };
  const rebased = rebasePdfPageEditDraft(state, key(reordered), reordered, 2);
  assert.deepEqual(rebased, { savedKey: key(reordered), baseline: reordered, draft: reordered });
  assert.equal(rebasePdfPageEditDraft(rebased, key(reordered), reordered, 2), rebased);
});
