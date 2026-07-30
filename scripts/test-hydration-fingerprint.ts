import assert from "node:assert/strict";
import { toRouteTemplate } from "../lib/posthog/route-template";

// The hydration-recovery `$exception` used to bake the concrete path — CUIDs
// and all — into `error.message`, so every newly visited note/paper minted a
// fresh Error Tracking issue. `toRouteTemplate` collapses the path to its route
// template; these cases lock in that no per-resource identifier survives.
const cases: Array<[string, string]> = [
    ["/notes/clz19jxuv000ez14te8ntkgxz", "/notes/[id]"],
    ["/notes/course/BCSE302L", "/notes/course/[code]"],
    [
        "/past_papers/CSE1001/paper/clz19jxuv000ez14te8ntkgxz",
        "/past_papers/[code]/paper/[id]",
    ],
    ["/past_papers/exam/theory", "/past_papers/exam/[exam]"],
    ["/past_papers/CSE1001/cat1", "/past_papers/[code]/[exam]"],
    ["/past_papers/CSE1001", "/past_papers/[code]"],
    ["/past_papers", "/past_papers"],
    ["/syllabus/course/BCSE302L", "/syllabus/course/[code]"],
    ["/syllabus/clz19jxuv000ez14te8ntkgxz", "/syllabus/[id]"],
    ["/auth", "/auth"],
    ["/", "/"],
    // Query strings / fragments must be stripped before templating.
    ["/notes/clz19jxuv000ez14te8ntkgxz?ref=share#top", "/notes/[id]"],
    // Unknown routes still collapse opaque identifiers via the fallback.
    ["/unknown/clz19jxuv000ez14te8ntkgxz", "/unknown/[id]"],
    ["/unknown/12345", "/unknown/[id]"],
];

for (const [input, expected] of cases) {
    assert.equal(
        toRouteTemplate(input),
        expected,
        `toRouteTemplate(${JSON.stringify(input)}) should be ${expected}`,
    );
}

// The concrete CUID must never survive into the templated route (the value that
// feeds the exception message and therefore the fingerprint).
assert.equal(
    toRouteTemplate("/notes/clz19jxuv000ez14te8ntkgxz").includes(
        "clz19jxuv000ez14te8ntkgxz",
    ),
    false,
    "route template must not leak the resource CUID",
);

console.log("hydration fingerprint route-template tests passed");
