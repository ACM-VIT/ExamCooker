import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearActivePdfSnapshot,
  getActivePdfSnapshot,
  setActivePdfSnapshot,
  type ActivePdfSnapshot,
} from "./pdf-voice-context";

function viewer(viewerId: string, currentPage = 1): ActivePdfSnapshot {
  return {
    currentPage,
    fileName: `${viewerId}.pdf`,
    fileUrl: `https://example.test/${viewerId}.pdf`,
    navigateToPage: () => {},
    title: viewerId,
    totalPages: 10,
    viewerId,
  };
}

test("closing the active viewer hands over to the viewer still open", () => {
  setActivePdfSnapshot(viewer("left"));
  setActivePdfSnapshot(viewer("right"));
  assert.equal(getActivePdfSnapshot()?.viewerId, "right");

  // Paging in the left viewer makes it the one voice is looking at.
  setActivePdfSnapshot(viewer("left", 4));
  assert.equal(getActivePdfSnapshot()?.viewerId, "left");
  assert.equal(getActivePdfSnapshot()?.currentPage, 4);

  clearActivePdfSnapshot("left");
  assert.equal(getActivePdfSnapshot()?.viewerId, "right");
  clearActivePdfSnapshot("right");
  assert.equal(getActivePdfSnapshot(), null);
});
