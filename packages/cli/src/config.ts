import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type ExamCookerConfig = {
  baseUrl?: string;
  token?: string;
  user?: {
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
  tokenLabel?: string | null;
};

export type RuntimeConfigSource = "flag" | "env" | "config" | "default";

const DEFAULT_BASE_URL = "https://examcooker.acmvit.in";

function getConfigDirectory() {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) {
    return join(xdg, "examcooker");
  }

  return join(homedir(), ".config", "examcooker");
}

export function getConfigPath() {
  return join(getConfigDirectory(), "config.json");
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

export function getDefaultBaseUrl() {
  const envBaseUrl = process.env.EXAMCOOKER_BASE_URL?.trim();
  return normalizeBaseUrl(envBaseUrl || DEFAULT_BASE_URL);
}

export async function loadConfig(): Promise<ExamCookerConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as ExamCookerConfig;
    return {
      ...parsed,
      baseUrl: parsed.baseUrl ? normalizeBaseUrl(parsed.baseUrl) : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function saveConfig(config: ExamCookerConfig) {
  const configPath = getConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        ...config,
        baseUrl: config.baseUrl ? normalizeBaseUrl(config.baseUrl) : undefined,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function clearConfig() {
  const configPath = getConfigPath();
  await rm(configPath, { force: true });
}

export async function resolveRuntimeConfig(input?: { baseUrl?: string | null }) {
  const storedConfig = await loadConfig();
  const flagBaseUrl = input?.baseUrl?.trim();
  const envBaseUrl = process.env.EXAMCOOKER_BASE_URL?.trim();
  const configBaseUrl = storedConfig.baseUrl?.trim();
  const baseUrlSource: RuntimeConfigSource = flagBaseUrl
    ? "flag"
    : envBaseUrl
      ? "env"
      : configBaseUrl
        ? "config"
        : "default";
  const baseUrl = normalizeBaseUrl(
    flagBaseUrl || envBaseUrl || configBaseUrl || DEFAULT_BASE_URL,
  );
  const token = process.env.EXAMCOOKER_TOKEN?.trim() || storedConfig.token || "";

  return {
    storedConfig,
    baseUrl,
    baseUrlSource,
    token,
  };
}
