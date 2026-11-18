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
    index: 1,
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
    index: 2,
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
    index: 2,
    historyLength: 3,
  });
});

test("the first page has nothing to go back to", () => {
  assert.equal(previousInAppPath(null), null);
  assert.equal(previousInAppPath(startInAppHistory("/")), null);
});
