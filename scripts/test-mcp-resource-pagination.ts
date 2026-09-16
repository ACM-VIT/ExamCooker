import assert from "node:assert/strict";
import { getDatabaseResourcePageRequests } from "../lib/mcp/resource-pagination";

const databaseRows = Array.from({ length: 55 }, (_, index) => `db-${String(index).padStart(3, "0")}`);
const requests = getDatabaseResourcePageRequests(40, 15);
const fetchedRows = requests.flatMap(({ page, pageSize }) => {
  const start = (page - 1) * pageSize;
  return databaseRows.slice(start, start + pageSize);
});
const databaseItems = fetchedRows.slice(40 % 50, 40 % 50 + 15);

assert.deepEqual(databaseItems, databaseRows.slice(40, 55));
assert.deepEqual(requests, [
  { page: 1, pageSize: 50 },
  { page: 2, pageSize: 50 },
]);
const remoteRows = Array.from({ length: 10 }, (_, index) => `vin-${index + 1}`);
const page3DatabaseItems = databaseRows.slice(40, 55);
const page3Items = [
  ...page3DatabaseItems,
  ...remoteRows.slice(0, 20 - page3DatabaseItems.length),
];
const page4Items = remoteRows.slice(60 - databaseRows.length, 80 - databaseRows.length);

assert.deepEqual(page3Items, [
  ...databaseRows.slice(40, 55),
  ...remoteRows.slice(0, 5),
]);
assert.deepEqual(page4Items, remoteRows.slice(5));
assert.equal(new Set([...page3Items, ...page4Items]).size, 25);

console.log("MCP resource pagination test passed");
