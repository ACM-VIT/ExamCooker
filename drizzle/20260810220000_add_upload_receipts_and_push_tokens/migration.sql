CREATE TABLE "UploadResultReceipt" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"result" jsonb NOT NULL,
	"consumedAt" timestamp(3),
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "UploadResultReceipt_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX "UploadResultReceipt_expiresAt_idx" ON "UploadResultReceipt" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX "UploadResultReceipt_userId_idx" ON "UploadResultReceipt" USING btree ("userId");
--> statement-breakpoint
CREATE TABLE "NativePushToken" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"userId" text,
	"lastSeenAt" timestamp(3) DEFAULT now() NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "NativePushToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "NativePushToken_tokenHash_key" ON "NativePushToken" USING btree ("tokenHash");
--> statement-breakpoint
CREATE INDEX "NativePushToken_userId_idx" ON "NativePushToken" USING btree ("userId");
