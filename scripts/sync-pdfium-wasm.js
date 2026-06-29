#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const sourcePath = require.resolve("@embedpdf/pdfium/pdfium.wasm");
const outputPath = path.join(
  __dirname,
  "..",
  "public",
  "vendor",
  "embedpdf",
  "pdfium.wasm",
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const sourceHash = sha256(sourcePath);
const outputHash = fs.existsSync(outputPath) ? sha256(outputPath) : null;

if (sourceHash === outputHash) {
  console.log(`pdfium.wasm is current (${sourceHash})`);
  process.exit(0);
}

fs.copyFileSync(sourcePath, outputPath);
console.log(`Synced pdfium.wasm from @embedpdf/pdfium (${sourceHash})`);
