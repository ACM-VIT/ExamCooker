// Keep tag-object activation independent of the Next.js application bundle.
export { DOShardedTagCache } from "@opennextjs/cloudflare/durable-objects/sharded-tag-cache";

export default {
  fetch() {
    return new Response(null, { status: 404 });
  },
};
