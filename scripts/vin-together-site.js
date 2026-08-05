// Single source of truth for the VInTogether origin.
//
// `scripts/sync-vin-together.js` resolves every course asset (images, PDFs)
// against this origin, so the same host must be allowlisted in
// `images.remotePatterns` (see `next.config.ts`) or `next/image` rejects the
// request and the visual renders as an empty box. Importing the constant in
// both places keeps the allowlist and the emitted URLs from silently drifting
// apart. CommonJS so the plain-node sync script can `require` it and the
// TypeScript config can `import` it.
const SITE_ORIGIN = "https://v-in-together.vercel.app";

module.exports = { SITE_ORIGIN };
