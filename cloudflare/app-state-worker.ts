// Locks, limits and counters must not load the Next.js application bundle.
export { AppState } from "./app-state";

export default {
  fetch() {
    return new Response(null, { status: 404 });
  },
};
