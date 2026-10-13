import assert from "node:assert/strict";
import { it } from "node:test";
import { parseResourceRef } from "./resource-id";

it("resolves stable ids, normalized course codes, and canonical resource URLs", () => {
  assert.deepEqual(parseResourceRef("note:abc"), { kind: "note", id: "abc" });
  assert.deepEqual(parseResourceRef(" bmat 101l "), {
    kind: "course",
    id: "BMAT101L",
  });
  assert.deepEqual(
    parseResourceRef(
      "https://examcooker.acmvit.in/past_papers/BMAT101L/paper/abc",
    ),
    { kind: "past_paper", id: "abc" },
  );
  assert.deepEqual(parseResourceRef("/notes/abc"), { kind: "note", id: "abc" });
});

it("rejects unrelated origins and invalid resource references", () => {
  for (const value of [
    "https://example.com/notes/abc",
    "https://user:password@examcooker.acmvit.in/notes/abc",
    "not a course",
    "",
    "javascript:alert(1)",
  ]) {
    assert.equal(parseResourceRef(value), null);
  }
});
