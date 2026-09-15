// Keep this endpoint for tabs loaded before the Live migration. The old client
// displays non-JSON response bodies verbatim, including Next's HTML 404 page.
export function POST() {
  return Response.json(
    { error: "Voice study has been updated. Refresh this page, then start voice again." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
