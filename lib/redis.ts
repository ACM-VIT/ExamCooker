import "server-only";

import { createClient, type RedisClientOptions } from "redis";

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 2_000;
const DEFAULT_PING_INTERVAL_MS = 5 * 60_000;

type RawRedisClient = ReturnType<typeof createClient>;

export type RedisSetOptions = {
  ex?: number;
  nx?: boolean;
};

export interface AppRedisClient {
  del(key: string): Promise<number>;
  eval<TArguments extends string[], TResult>(
    script: string,
    keys: string[],
    args: TArguments,
  ): Promise<TResult>;
  get<T = unknown>(key: string): Promise<T | null>;
  hgetall<T extends Record<string, unknown>>(key: string): Promise<T>;
  incr(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    options?: RedisSetOptions,
  ): Promise<"OK" | null>;
}

type RedisConfiguration = {
  authMode: "entra" | "url";
  entraClientId?: string;
  url: string;
};

let appRedisClient: AppRedisClient | null | undefined;
let rawRedisClientPromise: Promise<RawRedisClient> | null = null;
let connectPromise: Promise<RawRedisClient> | null = null;
let lastConnectionWarningAt = 0;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readRedisConfiguration(): RedisConfiguration | null {
  const configuredUrl = process.env.REDIS_URL?.trim();
  const configuredHost =
    process.env.AZURE_REDIS_HOST?.trim() || process.env.REDIS_HOST?.trim();
  const configuredPort = process.env.REDIS_PORT?.trim() || "10000";

  const url =
    configuredUrl ||
    (configuredHost ? `rediss://${configuredHost}:${configuredPort}` : "");

  if (!url) {
    return null;
  }

  const requestedAuthMode = process.env.REDIS_AUTH_MODE?.trim().toLowerCase();
  const authMode =
    requestedAuthMode === "entra" || (!configuredUrl && configuredHost)
      ? "entra"
      : "url";

  return {
    authMode,
    entraClientId: process.env.AZURE_REDIS_CLIENT_ID?.trim(),
    url,
  };
}

function warnConnectionError(error: unknown) {
  const now = Date.now();
  if (now - lastConnectionWarningAt < 60_000) {
    return;
  }

  lastConnectionWarningAt = now;
  console.error("[redis] connection error", error);
}

async function createRawRedisClient(configuration: RedisConfiguration) {
  const options: RedisClientOptions = {
    url: configuration.url,
    commandsQueueMaxLength: 1_000,
    disableOfflineQueue: true,
    name: "examcooker-web",
    pingInterval: readPositiveIntegerEnv(
      "REDIS_PING_INTERVAL_MS",
      DEFAULT_PING_INTERVAL_MS,
    ),
    socket: {
      connectTimeout: readPositiveIntegerEnv(
        "REDIS_CONNECT_TIMEOUT_MS",
        DEFAULT_CONNECT_TIMEOUT_MS,
      ),
      keepAlive: true,
      keepAliveInitialDelay: 60_000,
      reconnectStrategy(retries) {
        const exponentialDelay = Math.min(50 * 2 ** retries, 3_000);
        return exponentialDelay + Math.floor(Math.random() * 100);
      },
    },
  };

  if (configuration.authMode === "entra") {
    if (!configuration.entraClientId) {
      throw new Error(
        "AZURE_REDIS_CLIENT_ID is required when REDIS_AUTH_MODE=entra",
      );
    }

    const { EntraIdCredentialsProviderFactory } = await import("@redis/entraid");
    options.credentialsProvider =
      EntraIdCredentialsProviderFactory.createForSystemAssignedManagedIdentity({
        clientId: configuration.entraClientId,
        tokenManagerConfig: {
          expirationRefreshRatio: 0.8,
          retry: {
            backoffMultiplier: 2,
            initialDelayMs: 100,
            maxAttempts: 4,
            maxDelayMs: 2_000,
          },
        },
        onReAuthenticationError(error) {
          warnConnectionError(error);
        },
        onRetryableError(error) {
          warnConnectionError(error);
        },
      });
  }

  const client = createClient(options);
  client.on("error", warnConnectionError);
  return client;
}

async function getConnectedClient() {
  const configuration = readRedisConfiguration();
  if (!configuration) {
    throw new Error("Redis is not configured");
  }

  rawRedisClientPromise ??= createRawRedisClient(configuration);
  const client = await rawRedisClientPromise;

  if (client.isReady) {
    return client;
  }

  if (connectPromise) {
    return connectPromise;
  }

  if (client.isOpen) {
    throw new Error("Redis connection is reconnecting");
  }

  connectPromise = client
    .connect()
    .then(() => client)
    .catch((error) => {
      client.destroy();
      rawRedisClientPromise = null;
      throw error;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

async function withCommandTimeout<T>(
  operation: (client: RawRedisClient) => Promise<T>,
) {
  const timeoutMs = readPositiveIntegerEnv(
    "REDIS_COMMAND_TIMEOUT_MS",
    DEFAULT_COMMAND_TIMEOUT_MS,
  );
  const abortController = new AbortController();
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      getConnectedClient().then((client) =>
        operation(
          client.withCommandOptions({
            abortSignal: abortController.signal,
          }) as RawRedisClient,
        ),
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          const error = new Error(
            `Redis command timed out after ${timeoutMs}ms`,
          );
          abortController.abort(error);
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function createAppRedisClient(): AppRedisClient {
  return {
    async del(key) {
      return withCommandTimeout((client) => client.del(key));
    },
    async eval<TArguments extends string[], TResult>(
      script: string,
      keys: string[],
      args: TArguments,
    ) {
      return withCommandTimeout(async (client) => {
        const result = await client.eval(script, {
          arguments: args,
          keys,
        });
        return result as TResult;
      });
    },
    async get<T = unknown>(key: string) {
      return withCommandTimeout(async (client) => {
        const value = await client.get(key);
        return value as T | null;
      });
    },
    async hgetall<T extends Record<string, unknown>>(key: string) {
      return withCommandTimeout(async (client) => {
        const value = await client.hGetAll(key);
        return value as T;
      });
    },
    async incr(key: string) {
      return withCommandTimeout((client) => client.incr(key));
    },
    async set(key: string, value: string, options?: RedisSetOptions) {
      return withCommandTimeout(async (client) => {
        const result = await client.set(key, value, {
          ...(options?.ex ? { EX: options.ex } : {}),
          ...(options?.nx ? { NX: true } : {}),
        });
        return result as "OK" | null;
      });
    },
  };
}

export function getOptionalRedis() {
  if (appRedisClient !== undefined) {
    return appRedisClient;
  }

  if (!readRedisConfiguration()) {
    appRedisClient = null;
    return appRedisClient;
  }

  appRedisClient = createAppRedisClient();
  return appRedisClient;
}
