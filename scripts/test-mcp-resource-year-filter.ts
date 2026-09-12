import assert from "node:assert/strict";
import { shouldQueryDatabaseResources } from "../lib/mcp/resource-pagination";

assert.equal(shouldQueryDatabaseResources(undefined), true);
assert.equal(shouldQueryDatabaseResources(""), true);
assert.equal(shouldQueryDatabaseResources("  "), true);
assert.equal(shouldQueryDatabaseResources("3rd Year"), false);

console.log("MCP resource year filter test passed");
