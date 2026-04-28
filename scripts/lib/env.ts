import path from "node:path";
import dotenv from "dotenv";

let loaded = false;

export function loadScriptEnv() {
  if (loaded) {
    return;
  }

  dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
    quiet: true,
  });
  dotenv.config({
    path: path.resolve(process.cwd(), ".env.local"),
    override: true,
    quiet: true,
  });

  loaded = true;
}
