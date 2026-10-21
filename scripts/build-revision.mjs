import { execFileSync } from "node:child_process";

// Shared by browser telemetry and source maps so one build has one revision.
export function getBuildRevision(env = process.env, readGit = () =>
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) {
  for (const key of ["GITHUB_SHA", "WORKERS_CI_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"]) {
    if (env[key]?.trim()) return env[key].trim();
  }
  try { return readGit() || "local"; }
  catch { return "local"; }
}
