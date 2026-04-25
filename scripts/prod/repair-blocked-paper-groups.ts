import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

type PaperKey = {
  courseCode: string;
  examType: string;
  slot: string;
  year: number;
};

type PaperExpectation = PaperKey & {
  id: string;
};

type PaperRetarget = PaperKey & {
  courseTitle: string;
  title: string;
  semester?: string;
  campus?: string;
  hasAnswerKey?: boolean;
  tagNames?: string[];
};

type RepairCase = {
  key: string;
  description: string;
  keeper: PaperExpectation;
  losers: PaperExpectation[];
  retarget?: PaperRetarget;
};

type Options = {
  databaseUrl: string;
  dryRun: boolean;
  outputFile: string | null;
};

type PaperSnapshot = {
  id: string;
  title: string;
  fileUrl: string;
  thumbNailUrl: string | null;
  examType: string | null;
  slot: string | null;
  year: number | null;
  semester: string;
  campus: string;
  hasAnswerKey: boolean;
  questionPaperId: string | null;
  createdAt: Date;
  updatedAt: Date;
  courseId: string | null;
  course: {
    id: string;
    code: string;
    title: string;
    aliases: string[];
  } | null;
  tags: Array<{ id: string; name: string }>;
};

type CaseReport = {
  key: string;
  description: string;
  action: "dry_run" | "applied";
  keeperId: string;
  loserIds: string[];
  retargetedTo: PaperRetarget | null;
  movedBookmarkRows: number;
  movedTagRows: number;
  movedStudyChatRows: number;
  mergedViewHistoryRows: number;
  reattachedAnswerKeys: number;
  deletedRows: number;
};

type ViewHistoryRow = {
  id: string;
  userId: string;
  count: number;
  viewedAt: Date;
};

type PrismaClientLike = {
  course: any;
  tag: any;
  pastPaper: any;
  studyChat: any;
  viewHistory: any;
  $transaction: any;
  $executeRawUnsafe: any;
  $disconnect: () => Promise<void>;
};

const REPORT_DIR = path.resolve(process.cwd(), "scripts/reports");

const REPAIR_CASES: RepairCase[] = [
  {
    key: "BEEE102L::CAT_1::A2::2022::QUESTION_PAPER",
    description:
      "Retag the misclassified EEE1019 paper out of the BEEE102L CAT-1 2022 key, keep one row, and clear the duplicate blocker.",
    keeper: {
      id: "clzpqls5q001n116sjcsocpk7",
      courseCode: "BEEE102L",
      examType: "CAT_1",
      slot: "A2",
      year: 2022,
    },
    losers: [
      {
        id: "clzpqw0kv001p116sp6ecg5a9",
        courseCode: "BEEE102L",
        examType: "CAT_1",
        slot: "A2",
        year: 2022,
      },
    ],
    retarget: {
      courseCode: "EEE1019",
      courseTitle: "Foundations of Electrical and Electronics Engineering",
      examType: "CAT_1",
      slot: "A2",
      year: 2022,
      semester: "UNKNOWN",
      campus: "VELLORE",
      hasAnswerKey: false,
      title:
        "Foundations of Electrical and Electronics Engineering [EEE1019] CAT-1 A2 2022-2023",
      tagNames: [
        "Foundations of Electrical and Electronics Engineering [EEE1019]",
        "A2",
        "2022",
        "CAT-1",
      ],
    },
  },
  {
    key: "BEEE102L::FAT::A1::2023::QUESTION_PAPER",
    description:
      "Move the misclassified November 2024 paper back onto the existing 2024 row and unblock the 2023 FAT key.",
    keeper: {
      id: "cm6g4awbq0009l5032h4wrmk4",
      courseCode: "BEEE102L",
      examType: "FAT",
      slot: "A1",
      year: 2024,
    },
    losers: [
      {
        id: "cm4wqjf5m0007isjucpo5mksl",
        courseCode: "BEEE102L",
        examType: "FAT",
        slot: "A1",
        year: 2023,
      },
    ],
  },
  {
    key: "BCSE303L::FAT::B1::2023::QUESTION_PAPER",
    description:
      "Move the CAT-1 paper off the FAT 2023 key and merge it into the existing BCSE303L CAT-1 2023 row.",
    keeper: {
      id: "cm048j5ya0005pv78wa0vbq0z",
      courseCode: "BCSE303L",
      examType: "CAT_1",
      slot: "B1",
      year: 2023,
    },
    losers: [
      {
        id: "cm69jkfmk001xeghf8zuopo1m",
        courseCode: "BCSE303L",
        examType: "FAT",
        slot: "B1",
        year: 2023,
      },
    ],
  },
  {
    key: "BMAT202L::CAT_1::B1::2023::QUESTION_PAPER",
    description:
      "Collapse the three same-paper BMAT202L CAT-1 2023 rows into a single keeper row.",
    keeper: {
      id: "clzppm41h0009txfs3xpfaj3q",
      courseCode: "BMAT202L",
      examType: "CAT_1",
      slot: "B1",
      year: 2023,
    },
    losers: [
      {
        id: "clzpplbk9000p116s8rq9a9w8",
        courseCode: "BMAT202L",
        examType: "CAT_1",
        slot: "B1",
        year: 2023,
      },
      {
        id: "cm6cfhshk000xe33i3n9bmwsi",
        courseCode: "BMAT202L",
        examType: "CAT_1",
        slot: "B1",
        year: 2023,
      },
    ],
  },
  {
    key: "BCSE308L::FAT::D1::2024::QUESTION_PAPER",
    description:
      "Collapse the two BCSE308L FAT 2024 duplicates into the cleaner keeper row.",
    keeper: {
      id: "cm4u3wa260001iyb849xydxyk",
      courseCode: "BCSE308L",
      examType: "FAT",
      slot: "D1",
      year: 2024,
    },
    losers: [
      {
        id: "cm487gzkq000l14oyluwoyx46",
        courseCode: "BCSE308L",
        examType: "FAT",
        slot: "D1",
        year: 2024,
      },
    ],
  },
  {
    key: "BMAT102L::FAT::A1::2024::QUESTION_PAPER",
    description:
      "Move the three April 2025 BMAT102L rows onto the existing 2025 keeper and clear the 2024 blocker.",
    keeper: {
      id: "cmoeqi49d024fa8v3gdbcsm0v",
      courseCode: "BMAT102L",
      examType: "FAT",
      slot: "A1",
      year: 2025,
    },
    losers: [
      {
        id: "cm9qsu69q003dkz04icqymbwk",
        courseCode: "BMAT102L",
        examType: "FAT",
        slot: "A1",
        year: 2024,
      },
      {
        id: "cm9quso3y003djs04rh89dmux",
        courseCode: "BMAT102L",
        examType: "FAT",
        slot: "A1",
        year: 2024,
      },
      {
        id: "cm9smffud0025l404r6uzin2l",
        courseCode: "BMAT102L",
        examType: "FAT",
        slot: "A1",
        year: 2024,
      },
    ],
  },
  {
    key: "BCSE303L::FAT::B1::2024::QUESTION_PAPER",
    description:
      "Collapse the two BCSE303L FAT 2024 rows into a single keeper row.",
    keeper: {
      id: "cm4u3v39k0001yobvkto5adxd",
      courseCode: "BCSE303L",
      examType: "FAT",
      slot: "B1",
      year: 2024,
    },
    losers: [
      {
        id: "cmgmmzx2c0001k004vr38okcj",
        courseCode: "BCSE303L",
        examType: "FAT",
        slot: "B1",
        year: 2024,
      },
    ],
  },
  {
    key: "BMAT202L::FAT::B1::2024::QUESTION_PAPER",
    description:
      "Retag one April 2025 BMAT202L paper to the correct 2025 key, merge the duplicate, and unblock the 2024 source paper.",
    keeper: {
      id: "cm9tm5ky00001jy04v4wkonn5",
      courseCode: "BMAT202L",
      examType: "FAT",
      slot: "B1",
      year: 2024,
    },
    losers: [
      {
        id: "cm9tllu9c0001l4045v94uew9",
        courseCode: "BMAT202L",
        examType: "FAT",
        slot: "B1",
        year: 2024,
      },
    ],
    retarget: {
      courseCode: "BMAT202L",
      courseTitle: "Probability and Statistics",
      examType: "FAT",
      slot: "B1",
      year: 2025,
      semester: "UNKNOWN",
      campus: "VELLORE",
      hasAnswerKey: false,
      title: "Probability and Statistics [BMAT202L] FAT B1 2025",
      tagNames: ["Probability and Statistics [BMAT202L]", "B1", "2025", "FAT"],
    },
  },
];

function usage() {
  console.log(
    [
      "Usage:",
      "  pnpm prod:repair_blocked_papers [options]",
      "",
      "Environment:",
      "  PROD_DB or TARGET_DATABASE_URL or PROD_DATABASE_URL",
      "",
      "Options:",
      "  --dry-run",
      "  --database-url=<url>",
      "  --output=<path>",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    databaseUrl:
      process.env.PROD_DB?.trim() ||
      process.env.TARGET_DATABASE_URL?.trim() ||
      process.env.PROD_DATABASE_URL?.trim() ||
      "",
    dryRun: false,
    outputFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    let flag = arg;
    let value: string | undefined;
    if (arg.includes("=")) {
      const [parsedFlag, parsedValue] = arg.split("=", 2);
      flag = parsedFlag;
      value = parsedValue?.trim();
    } else {
      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        value = nextArg.trim();
        index += 1;
      }
    }

    if (!value) {
      throw new Error(`Expected a value for ${flag}`);
    }

    switch (flag) {
      case "--database-url":
        options.databaseUrl = value;
        break;
      case "--output":
        options.outputFile = path.resolve(process.cwd(), value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.databaseUrl) {
    throw new Error("Missing prod database URL.");
  }

  return options;
}

let prismaClientClassPromise: Promise<any> | null = null;

async function getPrismaClientClass() {
  prismaClientClassPromise ??= (async () => {
    const prismaModule = await import("../../prisma/generated/client");
    const resolved = (prismaModule as any).default ?? prismaModule;
    return resolved.PrismaClient;
  })();
  return prismaClientClassPromise;
}

async function createClient(connectionString: string): Promise<PrismaClientLike> {
  const PrismaClient = await getPrismaClientClass();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCourse(
  tx: any,
  input: Pick<PaperRetarget, "courseCode" | "courseTitle">,
) {
  const existing = await tx.course.findUnique({
    where: { code: input.courseCode },
  });
  if (existing) return existing;
  const aliases = [...new Set([input.courseTitle, `${input.courseTitle} [${input.courseCode}]`])];
  return tx.course.create({
    data: {
      code: input.courseCode,
      title: input.courseTitle,
      aliases,
    },
  });
}

function courseCodeOf(paper: PaperSnapshot) {
  return paper.course?.code ?? null;
}

function sqlList(values: string[]) {
  return values.map((value) => `'${value}'`).join(", ");
}

function paperMatchesKey(paper: PaperSnapshot, expectation: PaperKey) {
  return (
    courseCodeOf(paper) === expectation.courseCode &&
    paper.examType === expectation.examType &&
    paper.slot === expectation.slot &&
    paper.year === expectation.year
  );
}

async function tableExists(tx: any, tableName: string) {
  const rows = await tx.$queryRawUnsafe(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS present
    `,
    tableName,
  );
  return Boolean(rows?.[0]?.present);
}

function assertPaperMatchesExpectation(paper: PaperSnapshot, expectation: PaperExpectation) {
  const actualCode = courseCodeOf(paper);
  if (!paperMatchesKey(paper, expectation)) {
    throw new Error(
      `Paper ${paper.id} expected ${expectation.courseCode}/${expectation.examType}/${expectation.slot}/${expectation.year} but found ${actualCode ?? "null"}/${paper.examType ?? "null"}/${paper.slot ?? "null"}/${paper.year ?? "null"}.`,
    );
  }
}

async function loadPaperSnapshots(tx: any, ids: string[]): Promise<Map<string, PaperSnapshot>> {
  const rows = await tx.pastPaper.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      thumbNailUrl: true,
      examType: true,
      slot: true,
      year: true,
      semester: true,
      campus: true,
      hasAnswerKey: true,
      questionPaperId: true,
      createdAt: true,
      updatedAt: true,
      courseId: true,
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          aliases: true,
        },
      },
      tags: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  return new Map(rows.map((row: PaperSnapshot) => [row.id, row]));
}

async function assertRetargetUniqueness(tx: any, keeperId: string, retarget: PaperRetarget) {
  const existing = await tx.pastPaper.findMany({
    where: {
      id: { not: keeperId },
      course: { code: retarget.courseCode },
      examType: retarget.examType,
      slot: retarget.slot,
      year: retarget.year,
    },
    select: { id: true },
  });
  if (existing.length > 0) {
    throw new Error(
      `Retargeting keeper ${keeperId} to ${retarget.courseCode} ${retarget.examType} ${retarget.slot} ${retarget.year} would collide with existing row(s): ${existing
        .map((row: { id: string }) => row.id)
        .join(", ")}.`,
    );
  }
}

async function syncTags(tx: any, paperId: string, tagNames: string[]) {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  const tags = [];
  for (const name of uniqueNames) {
    const tag = await tx.tag.upsert({
      where: { name },
      update: {},
      create: {
        name,
        aliases: [],
      },
      select: { id: true },
    });
    tags.push(tag);
  }
  await tx.pastPaper.update({
    where: { id: paperId },
    data: {
      tags: {
        set: tags,
      },
    },
  });
}

async function mergeViewHistory(tx: any, keeperId: string, loserIds: string[]) {
  const keeperRows = (await tx.viewHistory.findMany({
    where: { pastPaperId: keeperId },
    select: {
      id: true,
      userId: true,
      count: true,
      viewedAt: true,
    },
  })) as ViewHistoryRow[];
  const loserRows = (await tx.viewHistory.findMany({
    where: { pastPaperId: { in: loserIds } },
    orderBy: [{ userId: "asc" }, { viewedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      count: true,
      viewedAt: true,
    },
  })) as ViewHistoryRow[];

  const keeperByUser = new Map<string, ViewHistoryRow>(
    keeperRows.map((row) => [row.userId, row]),
  );
  let touched = 0;

  for (const row of loserRows) {
    const existing = keeperByUser.get(row.userId);
    if (!existing) {
      await tx.viewHistory.update({
        where: { id: row.id },
        data: { pastPaperId: keeperId },
      });
      keeperByUser.set(row.userId, { ...row });
      touched += 1;
      continue;
    }

    const viewedAt =
      existing.viewedAt.getTime() >= row.viewedAt.getTime() ? existing.viewedAt : row.viewedAt;
    await tx.viewHistory.update({
      where: { id: existing.id },
      data: {
        count: existing.count + row.count,
        viewedAt,
      },
    });
    await tx.viewHistory.delete({ where: { id: row.id } });
    keeperByUser.set(row.userId, {
      ...existing,
      count: existing.count + row.count,
      viewedAt,
    });
    touched += 1;
  }

  return touched;
}

async function mergeDuplicateIntoKeeper(tx: any, keeperId: string, loserIds: string[]) {
  if (loserIds.length === 0) {
    return {
      movedBookmarkRows: 0,
      movedTagRows: 0,
      movedStudyChatRows: 0,
      mergedViewHistoryRows: 0,
      reattachedAnswerKeys: 0,
      deletedRows: 0,
    };
  }

  const answerKeyDependents = await tx.pastPaper.findMany({
    where: {
      questionPaperId: {
        in: [keeperId, ...loserIds],
      },
    },
    select: {
      id: true,
      questionPaperId: true,
    },
  });
  const keeperDependents = answerKeyDependents.filter(
    (row: { questionPaperId: string | null }) => row.questionPaperId === keeperId,
  );
  const loserDependents = answerKeyDependents.filter(
    (row: { questionPaperId: string | null }) =>
      row.questionPaperId && loserIds.includes(row.questionPaperId),
  );
  if (keeperDependents.length > 0 && loserDependents.length > 0) {
    throw new Error(
      `Keeper ${keeperId} already has an answer-key dependent and loser rows also have dependents. Manual resolution required.`,
    );
  }
  if (loserDependents.length > 1) {
    throw new Error(
      `Loser rows ${loserIds.join(", ")} have multiple answer-key dependents. Manual resolution required.`,
    );
  }

  let movedStudyChatRows = 0;
  if (await tableExists(tx, "StudyChat")) {
    const studyChatUpdate = await tx.studyChat.updateMany({
      where: {
        pastPaperId: {
          in: loserIds,
        },
      },
      data: {
        pastPaperId: keeperId,
      },
    });
    movedStudyChatRows = studyChatUpdate.count;
  }

  const mergedViewHistoryRows = await mergeViewHistory(tx, keeperId, loserIds);

  const loserIdSql = sqlList(loserIds);
  const movedBookmarkRows = await tx.$executeRawUnsafe(
    `
      INSERT INTO "_UserBookmarkedPastPapers" ("A", "B")
      SELECT $1, rel."B"
      FROM "_UserBookmarkedPastPapers" rel
      WHERE rel."A" IN (${loserIdSql})
      ON CONFLICT ("A", "B") DO NOTHING
    `,
    keeperId,
  );
  await tx.$executeRawUnsafe(
    `
      DELETE FROM "_UserBookmarkedPastPapers"
      WHERE "A" IN (${loserIdSql})
    `,
  );

  const movedTagRows = await tx.$executeRawUnsafe(
    `
      INSERT INTO "_PastPaperToTag" ("A", "B")
      SELECT $1, rel."B"
      FROM "_PastPaperToTag" rel
      WHERE rel."A" IN (${loserIdSql})
      ON CONFLICT ("A", "B") DO NOTHING
    `,
    keeperId,
  );
  await tx.$executeRawUnsafe(
    `
      DELETE FROM "_PastPaperToTag"
      WHERE "A" IN (${loserIdSql})
    `,
  );

  let reattachedAnswerKeys = 0;
  if (loserDependents.length === 1) {
    await tx.pastPaper.update({
      where: { id: loserDependents[0].id },
      data: {
        questionPaperId: keeperId,
      },
    });
    reattachedAnswerKeys = 1;
  }

  const deleted = await tx.pastPaper.deleteMany({
    where: {
      id: {
        in: loserIds,
      },
    },
  });

  return {
    movedBookmarkRows: Number(movedBookmarkRows),
    movedTagRows: Number(movedTagRows),
    movedStudyChatRows,
    mergedViewHistoryRows,
    reattachedAnswerKeys,
    deletedRows: deleted.count,
  };
}

async function runCase(prisma: any, repairCase: RepairCase, dryRun: boolean): Promise<CaseReport> {
  const attempts = dryRun ? 1 : 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx: any) => {
          const ids = [repairCase.keeper.id, ...repairCase.losers.map((row) => row.id)];
          const snapshots = await loadPaperSnapshots(tx, ids);
          const keeper = snapshots.get(repairCase.keeper.id);
          if (!keeper) {
            throw new Error(`Missing keeper ${repairCase.keeper.id}.`);
          }
          const keeperMatchesCurrent = paperMatchesKey(keeper, repairCase.keeper);
          const keeperMatchesRetarget = repairCase.retarget
            ? paperMatchesKey(keeper, repairCase.retarget)
            : false;
          if (!keeperMatchesCurrent && !keeperMatchesRetarget) {
            assertPaperMatchesExpectation(keeper, repairCase.keeper);
          }

          const remainingLosers: string[] = [];
          for (const loserExpectation of repairCase.losers) {
            const loser = snapshots.get(loserExpectation.id);
            if (!loser) {
              continue;
            }
            assertPaperMatchesExpectation(loser, loserExpectation);
            remainingLosers.push(loserExpectation.id);
          }

          if (repairCase.retarget && !keeperMatchesRetarget) {
            await assertRetargetUniqueness(tx, repairCase.keeper.id, repairCase.retarget);
          }

          const report: CaseReport = {
            key: repairCase.key,
            description: repairCase.description,
            action: dryRun ? "dry_run" : "applied",
            keeperId: repairCase.keeper.id,
            loserIds: remainingLosers,
            retargetedTo: repairCase.retarget ?? null,
            movedBookmarkRows: 0,
            movedTagRows: 0,
            movedStudyChatRows: 0,
            mergedViewHistoryRows: 0,
            reattachedAnswerKeys: 0,
            deletedRows: remainingLosers.length,
          };

          if (dryRun) {
            return report;
          }

          const mergeReport = await mergeDuplicateIntoKeeper(tx, repairCase.keeper.id, remainingLosers);

          if (repairCase.retarget && !keeperMatchesRetarget) {
            const course = await ensureCourse(tx, repairCase.retarget);
            await tx.pastPaper.update({
              where: { id: repairCase.keeper.id },
              data: {
                title: repairCase.retarget.title,
                courseId: course.id,
                examType: repairCase.retarget.examType,
                slot: repairCase.retarget.slot,
                year: repairCase.retarget.year,
                semester: repairCase.retarget.semester ?? "UNKNOWN",
                campus: repairCase.retarget.campus ?? "VELLORE",
                hasAnswerKey: repairCase.retarget.hasAnswerKey ?? false,
                isClear: true,
              },
            });

            if (repairCase.retarget.tagNames?.length) {
              await syncTags(tx, repairCase.keeper.id, repairCase.retarget.tagNames);
            }
          }

          return {
            ...report,
            ...mergeReport,
          };
        },
        { timeout: 300000, maxWait: 60000 },
      );
    } catch (error: any) {
      const isRetryable =
        !dryRun &&
        (String(error?.cause?.kind || "").includes("TransactionWriteConflict") ||
          String(error?.message || "").includes("restart transaction") ||
          String(error?.message || "").includes("TransactionWriteConflict"));
      if (!isRetryable || attempt === attempts) {
        throw error;
      }
      await sleep(250 * attempt);
    }
  }
  throw new Error(`Failed to apply repair case ${repairCase.key}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(REPORT_DIR, { recursive: true });

  const prisma = await createClient(options.databaseUrl);
  try {
    const caseReports: CaseReport[] = [];
    for (const repairCase of REPAIR_CASES) {
      const report = await runCase(prisma, repairCase, options.dryRun);
      caseReports.push(report);
      console.log(
        `${options.dryRun ? "Validated" : "Applied"} ${repairCase.key} (${repairCase.losers.length} duplicate row(s)).`,
      );
    }

    const output = {
      generatedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      summary: {
        cases: caseReports.length,
        deletedRows: caseReports.reduce((sum, row) => sum + row.deletedRows, 0),
        movedBookmarkRows: caseReports.reduce((sum, row) => sum + row.movedBookmarkRows, 0),
        movedTagRows: caseReports.reduce((sum, row) => sum + row.movedTagRows, 0),
        movedStudyChatRows: caseReports.reduce((sum, row) => sum + row.movedStudyChatRows, 0),
        mergedViewHistoryRows: caseReports.reduce(
          (sum, row) => sum + row.mergedViewHistoryRows,
          0,
        ),
        reattachedAnswerKeys: caseReports.reduce(
          (sum, row) => sum + row.reattachedAnswerKeys,
          0,
        ),
        retargetedRows: caseReports.filter((row) => row.retargetedTo !== null).length,
      },
      cases: caseReports,
    };

    const targetFile =
      options.outputFile ??
      path.resolve(
        REPORT_DIR,
        `prod-paper-repair-${options.dryRun ? "dry-run" : "apply"}-${timestamp()}.json`,
      );
    await writeFile(targetFile, JSON.stringify(output, null, 2));

    console.log(JSON.stringify(output, null, 2));
    console.log(`Report written to ${targetFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
