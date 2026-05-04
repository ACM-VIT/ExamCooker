import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/app/auth";
import { type Database, db } from "@/db";
import {
  accounts,
  cliAccessToken,
  cliDeviceAuthRequest,
  sessions,
  studyChat,
  user,
  userBookmarkedForumPosts,
  userBookmarkedNotes,
  userBookmarkedPastPapers,
  userBookmarkedResources,
  userBookmarkedSyllabus,
  viewHistory,
  vote,
} from "@/db/schema";

async function tableExists(tableName: string) {
  const result = await db.execute<{ exists: boolean }>(sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = current_schema()
        and table_name = ${tableName}
    ) as "exists"
  `);
  return Boolean(result.rows[0]?.exists);
}

type AccountDeleteTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deletedEmail = `deleted-${userId}@deleted.examcooker.local`;
  const [hasCliAccessToken, hasCliDeviceAuthRequest, hasStudyChat] =
    await Promise.all([
      tableExists("CliAccessToken"),
      tableExists("CliDeviceAuthRequest"),
      tableExists("StudyChat"),
    ]);

  await db.transaction(async (tx) => {
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await deleteCliAccess(tx, userId, {
      hasCliAccessToken,
      hasCliDeviceAuthRequest,
    });
    if (hasStudyChat) {
      await tx.delete(studyChat).where(eq(studyChat.userId, userId));
    }
    await tx.delete(viewHistory).where(eq(viewHistory.userId, userId));
    await tx.delete(vote).where(eq(vote.userId, userId));
    await tx
      .delete(userBookmarkedNotes)
      .where(eq(userBookmarkedNotes.b, userId));
    await tx
      .delete(userBookmarkedPastPapers)
      .where(eq(userBookmarkedPastPapers.b, userId));
    await tx
      .delete(userBookmarkedForumPosts)
      .where(eq(userBookmarkedForumPosts.b, userId));
    await tx
      .delete(userBookmarkedResources)
      .where(eq(userBookmarkedResources.b, userId));
    await tx
      .delete(userBookmarkedSyllabus)
      .where(eq(userBookmarkedSyllabus.a, userId));

    await tx
      .update(user)
      .set({
        email: deletedEmail,
        name: "Deleted account",
        image: null,
        emailVerified: null,
        role: "USER",
      })
      .where(eq(user.id, userId));
  });

  return NextResponse.json({ ok: true });
}

async function deleteCliAccess(
  tx: AccountDeleteTx,
  userId: string,
  options: {
    hasCliAccessToken: boolean;
    hasCliDeviceAuthRequest: boolean;
  },
) {
  if (options.hasCliDeviceAuthRequest) {
    await tx
      .delete(cliDeviceAuthRequest)
      .where(eq(cliDeviceAuthRequest.userId, userId));
  }

  if (options.hasCliAccessToken) {
    await tx.delete(cliAccessToken).where(eq(cliAccessToken.userId, userId));
  }
}
