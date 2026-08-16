import assert from "node:assert/strict";
import test from "node:test";

import { ensurePdfFileName, ensureZipFileName } from "./resource-names";

test("ensureZipFileName keeps exactly one canonical extension", () => {
    const cases = [
        ["papers", "papers.zip"],
        ["papers.zip", "papers.zip"],
        ["papers.ZIP", "papers.zip"],
        ["papers.zip.zip", "papers.zip"],
        ["papers.ZIP.Zip  ", "papers.zip"],
        ["papers.zip .ZIP", "papers.zip"],
    ];

    for (const [input, expected] of cases) {
        const fileName = ensureZipFileName(input);

        assert.equal(fileName, expected);
        assert.equal(ensureZipFileName(fileName), expected);
    }
});

test("ensurePdfFileName keeps exactly one canonical extension", () => {
    assert.equal(ensurePdfFileName("paper.PDF.pdf"), "paper.pdf");
});
