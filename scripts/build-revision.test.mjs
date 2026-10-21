import assert from "node:assert/strict";
import { test } from "node:test";
import { getBuildRevision } from "./build-revision.mjs";

test("CI providers identify builds without requiring a checkout", () => {
  const noGit = () => { throw new Error("No checkout"); };
  assert.equal(getBuildRevision({ GITHUB_SHA: "github", WORKERS_CI_COMMIT_SHA: "workers" }, noGit), "github");
  assert.equal(getBuildRevision({ WORKERS_CI_COMMIT_SHA: "workers", VERCEL_GIT_COMMIT_SHA: "vercel" }, noGit), "workers");
  assert.equal(getBuildRevision({ VERCEL_GIT_COMMIT_SHA: "vercel" }, noGit), "vercel");
});

test("manual builds use Git and source archives remain usable", () => {
  assert.equal(getBuildRevision({ GITHUB_SHA: " " }, () => "git-commit"), "git-commit");
  assert.equal(getBuildRevision({}, () => { throw new Error("No checkout"); }), "local");
});
