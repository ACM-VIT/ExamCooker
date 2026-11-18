import assert from "node:assert/strict";
import { test } from "node:test";
import {
  previousInAppPath,
  recordInAppNavigation,
  startInAppHistory,
  type InAppHistory,
} from "./voice-agent-helpers";

function navigate(
  history: InAppHistory,
  ...steps: Array<[Parameters<typeof recordInAppNavigation>[1], string]>
) {
  return steps.reduce(
    (current, [action, path]) => recordInAppNavigation(current, action, path),
    history,
  );
}

test("a push followed by a replace keeps the pushed entry", () => {
  const history = navigate(
    startInAppHistory("/"),
    ["push", "/notes"],
    ["replace", "/notes?sort=recent"],
  );
  assert.deepEqual(history, { entries: ["/", "/notes?sort=recent"], index: 1 });
  assert.equal(previousInAppPath(history), "/");
});

test("back and forward move within the recorded entries", () => {
  const visited = navigate(
    startInAppHistory("/"),
    ["push", "/notes"],
    ["push", "/past_papers"],
  );
  const back = recordInAppNavigation(visited, "pop", "/notes");
  assert.deepEqual(back, { ...visited, index: 1 });
  const forward = recordInAppNavigation(back, "pop", "/past_papers");
  assert.deepEqual(forward, { ...visited, index: 2 });
});

test("a fragment link adds an entry instead of wiping the history", () => {
  // Browsers report a new fragment entry with popstate and hashchange.
  const history = navigate(
    startInAppHistory("/"),
    ["push", "/syllabus"],
    ["pop", "/syllabus#module-2"],
    ["hash", "/syllabus#module-2"],
  );
  assert.deepEqual(history, {
    entries: ["/", "/syllabus", "/syllabus#module-2"],
    index: 2,
  });
  assert.equal(previousInAppPath(history), "/syllabus");
});

test("going back to a page from before voice started leaves nothing to go back to", () => {
  // Voice started on the paper page; the browser's Back lands on a course page
  // the tracker never saw. The paper must not be offered as "previous".
  const history = recordInAppNavigation(
    startInAppHistory("/past_papers/CSE1001/paper/one"),
    "pop",
    "/past_papers/CSE1001",
  );
  assert.deepEqual(history, startInAppHistory("/past_papers/CSE1001"));
  assert.equal(previousInAppPath(history), null);
});

test("pushing from an earlier entry drops the forward entries", () => {
  const history = navigate(
    startInAppHistory("/"),
    ["push", "/notes"],
    ["push", "/past_papers"],
    ["pop", "/notes"],
    ["push", "/syllabus"],
  );
  assert.deepEqual(history, { entries: ["/", "/notes", "/syllabus"], index: 2 });
});

test("the first page has nothing to go back to", () => {
  assert.equal(previousInAppPath(null), null);
  assert.equal(previousInAppPath(startInAppHistory("/")), null);
});
