// Wrangler bundles .wasm imports as precompiled modules.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
