import { DurableObject } from "cloudflare:workers";
import { stateObjectName, type StateOperation } from "../lib/app-state-types";

/** Atomic counters, expiring locks, and per-generation feedback. No sessions. */
export class AppState extends DurableObject<Record<string, unknown>> {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS records (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER
    ); CREATE INDEX IF NOT EXISTS records_expiry ON records(expires_at);`);
  }

  private read(key: string): unknown {
    const row = this.ctx.storage.sql.exec<{ value: string }>(
      "SELECT value FROM records WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)",
      key, Date.now(),
    ).toArray()[0];
    return row ? JSON.parse(row.value) : null;
  }

  private write(key: string, value: unknown, expiresAt: number | null = null) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO records(key, value, expires_at) VALUES (?, ?, ?)",
      key, JSON.stringify(value), expiresAt,
    );
  }

  async execute(operation: StateOperation): Promise<unknown> {
    // No awaits inside the transaction: concurrent requests cannot interleave
    // between reading the old vote/lock/counter and writing its replacement.
    const result = this.ctx.storage.transactionSync(() => this.apply(operation));
    const nextExpiry = this.ctx.storage.sql.exec<{ expires_at: number | null }>(
      "SELECT MIN(expires_at) AS expires_at FROM records",
    ).one().expires_at;
    if (nextExpiry !== null) {
      const currentAlarm = await this.ctx.storage.getAlarm();
      const nextAlarm = Math.max(nextExpiry, Date.now() + 1000);
      if (currentAlarm === null || nextAlarm < currentAlarm) await this.ctx.storage.setAlarm(nextAlarm);
    }
    return result;
  }

  private apply(op: StateOperation): unknown {
    const current = this.read(op.key);
    switch (op.type) {
      case "get": return current;
      case "hgetall": return current ?? {};
      case "del":
        this.ctx.storage.sql.exec("DELETE FROM records WHERE key = ?", op.key);
        return current === null ? 0 : 1;
      case "set":
        if (op.nx && current !== null) return null;
        this.write(op.key, op.value, op.ex ? Date.now() + op.ex * 1000 : null);
        return "OK";
      case "incr": {
        const value = Number(current ?? 0) + 1;
        this.write(op.key, value);
        return value;
      }
      case "releaseLock":
        if (current !== op.token) return 0;
        this.ctx.storage.sql.exec("DELETE FROM records WHERE key = ?", op.key);
        return 1;
      case "slidingWindow": {
        const now = Date.now();
        const requests = (Array.isArray(current) ? current as number[] : [])
          .filter((time) => time > now - op.windowMs);
        const allowed = requests.length < op.limit;
        if (allowed) requests.push(now);
        this.write(op.key, requests, now + op.windowMs);
        return [allowed ? 1 : 0, requests.length];
      }
      case "recordVote": {
        if (stateObjectName(op.key) !== stateObjectName(op.feedbackKey)) {
          throw new Error("Vote and feedback must belong to the same generation");
        }
        const feedback = (this.read(op.feedbackKey) ?? {}) as { upvotes?: number; downvotes?: number };
        let upvotes = Number(feedback.upvotes ?? 0);
        let downvotes = Number(feedback.downvotes ?? 0);
        if (current !== op.vote) {
          if (current === "up") upvotes = Math.max(upvotes - 1, 0);
          if (current === "down") downvotes = Math.max(downvotes - 1, 0);
          if (op.vote === "up") upvotes++; else downvotes++;
          const expiresAt = Date.now() + op.ttlSeconds * 1000;
          this.write(op.key, op.vote, expiresAt);
          this.write(op.feedbackKey, { upvotes, downvotes, updatedAt: op.updatedAt }, expiresAt);
        }
        return [current ?? "", String(upvotes), String(downvotes)];
      }
    }
  }

  async alarm() {
    this.ctx.storage.sql.exec("DELETE FROM records WHERE expires_at <= ?", Date.now());
    const next = this.ctx.storage.sql.exec<{ expires_at: number | null }>(
      "SELECT MIN(expires_at) AS expires_at FROM records",
    ).one().expires_at;
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }
}
