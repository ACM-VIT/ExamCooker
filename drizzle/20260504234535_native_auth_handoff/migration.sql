CREATE TABLE IF NOT EXISTS "NativeAuthHandoff" (
  "id" STRING PRIMARY KEY,
  "userId" STRING NOT NULL,
  "codeHash" STRING NOT NULL,
  "verifierChallenge" STRING NOT NULL,
  "consumedAt" timestamp(3),
  "expiresAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  CONSTRAINT "NativeAuthHandoff_codeHash_key" UNIQUE ("codeHash"),
  CONSTRAINT "NativeAuthHandoff_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NativeAuthHandoff_userId_idx"
  ON "NativeAuthHandoff" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NativeAuthHandoff_expiresAt_idx"
  ON "NativeAuthHandoff" ("expiresAt");
