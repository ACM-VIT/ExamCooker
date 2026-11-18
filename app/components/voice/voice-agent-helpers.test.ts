import assert from "node:assert/strict";
import { test } from "node:test";
import {
  previousInAppPath,
  recordInAppNavigation,
  startInAppHistory,
  type InAppHistory,
} from "./voice-agent-helpers";

// Each step carries history.length as the browser reports it after the change.
function navigate(
  history: InAppHistory,
  ...steps: Array<[Parameters<typeof recordInAppNavigation>[1], string, number]>
) {
  return steps.reduce(
    (current, [action, path, length]) =>
      recordInAppNavigation(current, action, path, length),
    history,
  );
}

test("a push followed by a replace keeps the pushed entry", () => {
  const history = navigate(
    startInAppHistory("/", 1),
    ["push", "/notes", 2],
    ["replace", "/notes?sort=recent", 2],
  );
  assert.deepEqual(history, {
    entries: ["/", "/notes?sort=recent"],
    keys: [null, null],
    index: 1,
    entryIndex: null,
    historyLength: 2,
  });
  assert.equal(previousInAppPath(history), "/");
});

test("back and forward move within the recorded entries", () => {
  const visited = navigate(
    startInAppHistory("/", 1),
    ["push", "/notes", 2],
    ["push", "/past_papers", 3],
  );
  const back = recordInAppNavigation(visited, "pop", "/notes", 3);
  assert.deepEqual(back, { ...visited, index: 1 });
  const forward = recordInAppNavigation(back, "pop", "/past_papers", 3);
  assert.deepEqual(forward, { ...visited, index: 2 });
});

test("a fragment link adds an entry instead of wiping the history", () => {
  // Browsers report a new fragment entry with popstate and hashchange.
  const history = navigate(
    startInAppHistory("/", 1),
    ["push", "/syllabus", 2],
    ["pop", "/syllabus#module-2", 3],
    ["hash", "/syllabus#module-2", 3],
  );
  assert.deepEqual(history, {
    entries: ["/", "/syllabus", "/syllabus#module-2"],
    keys: [null, null, null],
    index: 2,
    entryIndex: null,
    historyLength: 3,
  });
  assert.equal(previousInAppPath(history), "/syllabus");
});

test("a fragment link back to a recorded path is still a new entry", () => {
  const history = navigate(
    startInAppHistory("/syllabus", 1),
    ["pop", "/syllabus#module-2", 2],
    ["hash", "/syllabus#module-2", 2],
    ["pop", "/syllabus", 3],
  );
  assert.deepEqual(history.entries, [
    "/syllabus",
    "/syllabus#module-2",
    "/syllabus",
  ]);
  assert.equal(previousInAppPath(history), "/syllabus#module-2");
});

test("going back to a fragment from before voice started leaves nothing to go back to", () => {
  // Voice started on #two; Back lands on #one, which it never saw. #two is now
  // a forward entry, so it must not be offered as "previous".
  const history = navigate(
    startInAppHistory("/paper#two", 2),
    ["pop", "/paper#one", 2],
    ["hash", "/paper#one", 2],
  );
  assert.deepEqual(history, startInAppHistory("/paper#one", 2));
  assert.equal(previousInAppPath(history), null);
});

test("going back to a page from before voice started leaves nothing to go back to", () => {
  // Voice started on the paper page; the browser's Back lands on a course page
  // the tracker never saw. The paper must not be offered as "previous".
  const history = recordInAppNavigation(
    startInAppHistory("/past_papers/CSE1001/paper/one", 2),
    "pop",
    "/past_papers/CSE1001",
    2,
  );
  assert.deepEqual(history, startInAppHistory("/past_papers/CSE1001", 2));
  assert.equal(previousInAppPath(history), null);
});

test("pushing from an earlier entry drops the forward entries", () => {
  const history = navigate(
    startInAppHistory("/", 1),
    ["push", "/notes", 2],
    ["push", "/past_papers", 3],
    ["pop", "/notes", 3],
    ["push", "/syllabus", 3],
  );
  assert.deepEqual(history, {
    entries: ["/", "/notes", "/syllabus"],
    keys: [null, null, null],
    index: 2,
    entryIndex: null,
    historyLength: 3,
  });
});

test("the first page has nothing to go back to", () => {
  assert.equal(previousInAppPath(null), null);
  assert.equal(previousInAppPath(startInAppHistory("/")), null);
});

// With the Navigation API each step also carries the current entry's key and
// index, which tells an added entry from a traversal whatever history.length
// does.
function navigateKeyed(
  history: InAppHistory,
  ...steps: Array<[Parameters<typeof recordInAppNavigation>[1], string, number, string, number]>
) {
  return steps.reduce(
    (current, [action, path, length, key, index]) =>
      recordInAppNavigation(current, action, path, length, { key, index }),
    history,
  );
}

test("a fragment link after going Back is a new entry even when history.length stays the same", () => {
  const visited = navigateKeyed(
    startInAppHistory("/paper#one", 1, { key: "one", index: 0 }),
    ["pop", "/paper#two", 2, "two", 1],
    ["hash", "/paper#two", 2, "two", 1],
    ["pop", "/paper#three", 3, "three", 2],
    ["hash", "/paper#three", 3, "three", 2],
    ["pop", "/paper#four", 4, "four", 3],
    ["hash", "/paper#four", 4, "four", 3],
  );
  // Back to #three, then a link to #two: the new entry replaces #four, so the
  // length is still 4, but its key is new.
  const history = navigateKeyed(
    visited,
    ["pop", "/paper#three", 4, "three", 2],
    ["hash", "/paper#three", 4, "three", 2],
    ["pop", "/paper#two", 4, "two-again", 3],
    ["hash", "/paper#two", 4, "two-again", 3],
  );
  assert.deepEqual(history.entries, ["/paper#one", "/paper#two", "/paper#three", "/paper#two"]);
  assert.equal(previousInAppPath(history), "/paper#three");
});

test("Back and Forward with entry keys move to the entry the browser landed on", () => {
  const visited = navigateKeyed(
    startInAppHistory("/", 1, { key: "home", index: 0 }),
    ["push", "/notes", 2, "notes", 1],
    ["push", "/notes", 3, "notes-again", 2],
  );
  // The same path twice: only the key says which entry Back reached.
  const back = recordInAppNavigation(visited, "pop", "/notes", 3, { key: "notes", index: 1 });
  assert.equal(back.index, 1);
  assert.equal(previousInAppPath(back), "/");
  const forward = recordInAppNavigation(back, "pop", "/notes", 3, { key: "notes-again", index: 2 });
  assert.equal(forward.index, 2);
});

test("an entry key voice never saw, away from the next slot, leaves nothing to go back to", () => {
  const history = navigateKeyed(
    startInAppHistory("/paper#two", 2, { key: "two", index: 1 }),
    ["pop", "/paper#one", 2, "one", 0],
    ["hash", "/paper#one", 2, "one", 0],
  );
  assert.deepEqual(history, startInAppHistory("/paper#one", 2, { key: "one", index: 0 }));
  assert.equal(previousInAppPath(history), null);
});
