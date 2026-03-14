'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const { PrismaClient } = require(path.resolve(process.cwd(), 'src/generated/prisma'));

const PROD_URL = process.env.DATABASE_URL;
const DEV_URL = process.env.DEV_DATABASE;
const args = new Set(process.argv.slice(2));

const DRY_RUN = args.has('--dry-run');
const RESET = args.has('--reset');
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE ?? 50);

const SYSTEM_EMAIL = process.env.DEV_SEED_USER_EMAIL ?? 'dev-seed@examcooker.local';
const SYSTEM_NAME = process.env.DEV_SEED_USER_NAME ?? 'Dev Seed User';

if (!PROD_URL || !DEV_URL) {
  console.error('Missing DATABASE_URL or DEV_DATABASE in the environment.');
  process.exit(1);
}

if (PROD_URL === DEV_URL) {
  console.error('DATABASE_URL and DEV_DATABASE are identical. Refusing to run.');
  process.exit(1);
}

if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE <= 0) {
  console.error('SEED_BATCH_SIZE must be a positive number.');
  process.exit(1);
}

const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
const dev = new PrismaClient({ datasources: { db: { url: DEV_URL } } });

function buildTagConnect(tags) {
  return (tags ?? []).map((tag) => ({ name: tag.name }));
}

function tagsForCreate(tags) {
  const connect = buildTagConnect(tags);
  return connect.length ? { connect } : undefined;
}

function tagsForUpdate(tags) {
  return { set: buildTagConnect(tags) };
}

async function copyInBatches(label, fetchBatch, handleBatch) {
  let cursor = null;
  let total = 0;

  for (;;) {
    const batch = await fetchBatch(cursor);
    if (!batch.length) break;

    total += batch.length;
    if (!DRY_RUN) {
      await handleBatch(batch);
    }

    cursor = batch[batch.length - 1].id;
    console.log(`${label}: processed ${total}`);
  }

  console.log(`${label}: done (${total} records)`);
}

async function resetDevData() {
  if (DRY_RUN) {
    console.log('Dry run: skipping reset.');
    return;
  }

  console.log('Resetting dev content tables...');
  await dev.viewHistory.deleteMany();
  await dev.vote.deleteMany();
  await dev.comment.deleteMany();
  await dev.forumPost.deleteMany();
  await dev.forum.deleteMany();
  await dev.note.deleteMany();
  await dev.pastPaper.deleteMany();
  await dev.module.deleteMany();
  await dev.subject.deleteMany();
  await dev.tag.deleteMany();
  await dev.syllabi.deleteMany();
  await dev.account.deleteMany();
  await dev.session.deleteMany();
  await dev.user.deleteMany();
}

async function ensureSystemUser() {
  if (DRY_RUN) {
    return { id: 'dry-run' };
  }

  return dev.user.upsert({
    where: { email: SYSTEM_EMAIL },
    update: { name: SYSTEM_NAME, role: 'MODERATOR' },
    create: { email: SYSTEM_EMAIL, name: SYSTEM_NAME, role: 'MODERATOR' },
  });
}

async function assertDevSchema() {
  if (DRY_RUN) return;

  try {
    await dev.user.findFirst({ select: { id: true } });
  } catch (error) {
    if (error && error.code === 'P2021') {
      console.error('Dev database is missing tables. Apply migrations to DEV_DATABASE first.');
      console.error('Example: DATABASE_URL="$DEV_DATABASE" npx prisma migrate deploy');
      console.error('Or: DATABASE_URL="$DEV_DATABASE" npx prisma db push');
      process.exit(1);
    }

    throw error;
  }
}

async function copyTags() {
  await copyInBatches(
    'Tags',
    (cursor) =>
      prod.tag.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    async (tags) => {
      await dev.$transaction(
        tags.map((tag) =>
          dev.tag.upsert({
            where: { name: tag.name },
            update: { aliases: tag.aliases },
            create: { name: tag.name, aliases: tag.aliases },
          })
        )
      );
    }
  );
}

async function copySubjects() {
  await copyInBatches(
    'Subjects',
    (cursor) =>
      prod.subject.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    async (subjects) => {
      await dev.$transaction(
        subjects.map((subject) =>
          dev.subject.upsert({
            where: { name: subject.name },
            update: {},
            create: { name: subject.name },
          })
        )
      );
    }
  );
}

async function copyModules() {
  await copyInBatches(
    'Modules',
    (cursor) =>
      prod.module.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { subject: { select: { name: true } } },
      }),
    async (modules) => {
      await dev.$transaction(
        modules.map((module) =>
          dev.module.upsert({
            where: { id: module.id },
            update: {
              title: module.title,
              webReferences: module.webReferences,
              youtubeLinks: module.youtubeLinks,
              subject: { connect: { name: module.subject.name } },
            },
            create: {
              id: module.id,
              title: module.title,
              webReferences: module.webReferences,
              youtubeLinks: module.youtubeLinks,
              subject: { connect: { name: module.subject.name } },
            },
          })
        )
      );
    }
  );
}

async function copySyllabi() {
  await copyInBatches(
    'Syllabi',
    (cursor) =>
      prod.syllabi.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    async (syllabiRows) => {
      await dev.$transaction(
        syllabiRows.map((syllabus) =>
          dev.syllabi.upsert({
            where: { id: syllabus.id },
            update: { name: syllabus.name, fileUrl: syllabus.fileUrl },
            create: { id: syllabus.id, name: syllabus.name, fileUrl: syllabus.fileUrl },
          })
        )
      );
    }
  );
}

async function copyNotes(systemUserId) {
  await copyInBatches(
    'Notes',
    (cursor) =>
      prod.note.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { tags: { select: { name: true } } },
      }),
    async (notes) => {
      await dev.$transaction(
        notes.map((note) =>
          dev.note.upsert({
            where: { id: note.id },
            update: {
              title: note.title,
              fileUrl: note.fileUrl,
              thumbNailUrl: note.thumbNailUrl,
              isClear: note.isClear,
              authorId: systemUserId,
              tags: tagsForUpdate(note.tags),
            },
            create: {
              id: note.id,
              title: note.title,
              fileUrl: note.fileUrl,
              thumbNailUrl: note.thumbNailUrl,
              isClear: note.isClear,
              authorId: systemUserId,
              tags: tagsForCreate(note.tags),
            },
          })
        )
      );
    }
  );
}

async function copyPastPapers(systemUserId) {
  await copyInBatches(
    'Past papers',
    (cursor) =>
      prod.pastPaper.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { tags: { select: { name: true } } },
      }),
    async (papers) => {
      await dev.$transaction(
        papers.map((paper) =>
          dev.pastPaper.upsert({
            where: { id: paper.id },
            update: {
              title: paper.title,
              fileUrl: paper.fileUrl,
              thumbNailUrl: paper.thumbNailUrl,
              isClear: paper.isClear,
              authorId: systemUserId,
              tags: tagsForUpdate(paper.tags),
            },
            create: {
              id: paper.id,
              title: paper.title,
              fileUrl: paper.fileUrl,
              thumbNailUrl: paper.thumbNailUrl,
              isClear: paper.isClear,
              authorId: systemUserId,
              tags: tagsForCreate(paper.tags),
            },
          })
        )
      );
    }
  );
}

async function copyForums() {
  await copyInBatches(
    'Forums',
    (cursor) =>
      prod.forum.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { tags: { select: { name: true } } },
      }),
    async (forums) => {
      await dev.$transaction(
        forums.map((forum) =>
          dev.forum.upsert({
            where: { id: forum.id },
            update: {
              courseName: forum.courseName,
              tags: tagsForUpdate(forum.tags),
            },
            create: {
              id: forum.id,
              courseName: forum.courseName,
              tags: tagsForCreate(forum.tags),
            },
          })
        )
      );
    }
  );
}

async function copyForumPosts(systemUserId) {
  await copyInBatches(
    'Forum posts',
    (cursor) =>
      prod.forumPost.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { tags: { select: { name: true } } },
      }),
    async (posts) => {
      await dev.$transaction(
        posts.map((post) =>
          dev.forumPost.upsert({
            where: { id: post.id },
            update: {
              title: post.title,
              description: post.description,
              upvoteCount: post.upvoteCount,
              downvoteCount: post.downvoteCount,
              forumId: post.forumId,
              authorId: systemUserId,
              tags: tagsForUpdate(post.tags),
            },
            create: {
              id: post.id,
              title: post.title,
              description: post.description,
              upvoteCount: post.upvoteCount,
              downvoteCount: post.downvoteCount,
              forumId: post.forumId,
              authorId: systemUserId,
              tags: tagsForCreate(post.tags),
            },
          })
        )
      );
    }
  );
}

async function copyComments(systemUserId) {
  await copyInBatches(
    'Comments',
    (cursor) =>
      prod.comment.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    async (comments) => {
      await dev.$transaction(
        comments.map((comment) =>
          dev.comment.upsert({
            where: { id: comment.id },
            update: {
              content: comment.content,
              forumPostId: comment.forumPostId,
              authorId: systemUserId,
            },
            create: {
              id: comment.id,
              content: comment.content,
              forumPostId: comment.forumPostId,
              authorId: systemUserId,
            },
          })
        )
      );
    }
  );
}

async function main() {
  if (RESET) {
    await resetDevData();
  }

  await assertDevSchema();

  const systemUser = await ensureSystemUser();

  await copyTags();
  await copySubjects();
  await copyModules();
  await copySyllabi();
  await copyForums();
  await copyForumPosts(systemUser.id);
  await copyComments(systemUser.id);
  await copyNotes(systemUser.id);
  await copyPastPapers(systemUser.id);
}

main()
  .catch((error) => {
    console.error('Copy failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prod.$disconnect();
    await dev.$disconnect();
  });
