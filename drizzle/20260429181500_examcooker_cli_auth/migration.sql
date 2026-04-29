CREATE TYPE "CliDeviceAuthStatus" AS ENUM('PENDING', 'AUTHORIZED', 'DENIED');
--> statement-breakpoint
CREATE TABLE "CliAccessToken" (
  "id" string PRIMARY KEY,
  "userId" string NOT NULL,
  "label" string NOT NULL,
  "lastUsedAt" timestamp(3),
  "revokedAt" timestamp(3),
  "expiresAt" timestamp(3),
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CliDeviceAuthRequest" (
  "id" string PRIMARY KEY,
  "userCode" string NOT NULL,
  "deviceCodeHash" string NOT NULL,
  "deviceName" string,
  "status" "CliDeviceAuthStatus" DEFAULT 'PENDING' NOT NULL,
  "userId" string,
  "accessTokenId" string,
  "authorizedAt" timestamp(3),
  "lastPolledAt" timestamp(3),
  "completedAt" timestamp(3),
  "expiresAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) DEFAULT current_timestamp() NOT NULL,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "CliDeviceAuthRequest_userCode_key" UNIQUE("userCode"),
  CONSTRAINT "CliDeviceAuthRequest_deviceCodeHash_key" UNIQUE("deviceCodeHash")
);
--> statement-breakpoint
ALTER TABLE "CliAccessToken"
  ADD CONSTRAINT "CliAccessToken_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "CliDeviceAuthRequest"
  ADD CONSTRAINT "CliDeviceAuthRequest_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "CliDeviceAuthRequest"
  ADD CONSTRAINT "CliDeviceAuthRequest_accessTokenId_fkey"
  FOREIGN KEY ("accessTokenId")
  REFERENCES "CliAccessToken"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
--> statement-breakpoint
CREATE INDEX "CliAccessToken_userId_idx" ON "CliAccessToken" ("userId");
--> statement-breakpoint
CREATE INDEX "CliAccessToken_revokedAt_idx" ON "CliAccessToken" ("revokedAt");
--> statement-breakpoint
CREATE INDEX "CliAccessToken_expiresAt_idx" ON "CliAccessToken" ("expiresAt");
--> statement-breakpoint
CREATE INDEX "CliDeviceAuthRequest_userId_idx" ON "CliDeviceAuthRequest" ("userId");
--> statement-breakpoint
CREATE INDEX "CliDeviceAuthRequest_status_idx" ON "CliDeviceAuthRequest" ("status");
--> statement-breakpoint
CREATE INDEX "CliDeviceAuthRequest_expiresAt_idx" ON "CliDeviceAuthRequest" ("expiresAt");
