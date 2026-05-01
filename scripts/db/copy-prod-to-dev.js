'use strict';

const { createScriptDb, queryRows } = require('../lib/db.ts');
const {
  ensureTagNames,
  loadTagIdMapByName,
} = require('../lib/past-papers.ts');
const { loadScriptEnv } = require('../lib/env.ts');

loadScriptEnv();

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

const prod = createScriptDb(PROD_URL);
const dev = createScriptDb(DEV_URL);

function recordIdGreaterThan(cursor) {
  return cursor ? ['WHERE id > $1', [cursor]] : ['', []];
}

async function withDevTransaction(work) {
  const client = await dev.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncTagLinks(client, joinTable, recordId, tagNames) {
  const uniqueTagNames = [...new Set((tagNames ?? []).map((name) => name.trim()).filter(Boolean))];
  await ensureTagNames(client, uniqueTagNames);
  const tagIdByName = await loadTagIdMapByName(client, uniqueTagNames);

  await client.query(`DELETE FROM "${joinTable}" WHERE "A" = $1`, [recordId]);

  for (const tagName of uniqueTagNames) {
    const tagId = tagIdByName.get(tagName);
    if (!tagId) {
      throw new Error(`Missing tag ${tagName} while syncing ${joinTable}.`);
    }

    await client.query(
      `
        INSERT INTO "${joinTable}" ("A", "B")
        VALUES ($1, $2)
        ON CONFLICT ("A", "B") DO NOTHING
      `,
      [recordId, tagId],
    );
  }
}

async function fetchTagsBatch(cursor) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  return queryRows(
    prod.pool,
    `
      SELECT id, name, aliases
      FROM "Tag"
      ${whereClause}
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `,
    params,
  );
}

async function fetchSubjectsBatch(cursor) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  return queryRows(
    prod.pool,
    `
      SELECT id, name
      FROM "Subject"
      ${whereClause}
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `,
    params,
  );
}

async function fetchModulesBatch(cursor) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  return queryRows(
    prod.pool,
    `
      SELECT
        m.id,
        m.title,
        m."webReferences",
        m."youtubeLinks",
        s.name AS "subjectName"
      FROM "Module" m
      INNER JOIN "Subject" s ON s.id = m."subjectId"
      ${whereClause}
      ORDER BY m.id ASC
      LIMIT ${BATCH_SIZE}
    `,
    params,
  );
}

async function fetchSyllabiBatch(cursor) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  return queryRows(
    prod.pool,
    `
      SELECT id, name, "fileUrl"
      FROM "syllabi"
      ${whereClause}
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `,
    params,
  );
}

async function fetchCommentsBatch(cursor) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  return queryRows(
    prod.pool,
    `
      SELECT id, content, "forumPostId"
      FROM "Comment"
      ${whereClause}
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `,
    params,
  );
}

async function fetchTaggedBatch({ table, joinTable, columns, cursor }) {
  const [whereClause, params] = recordIdGreaterThan(cursor);
  const rows = await queryRows(
    prod.pool,
    `
      SELECT
        ${columns.join(', ')},
        t.name AS "tagName"
      FROM "${table}" base
      LEFT JOIN "${joinTable}" rel ON rel."A" = base.id
      LEFT JOIN "Tag" t ON t.id = rel."B"
      ${whereClause ? whereClause.replace('id', 'base.id') : ''}
      ORDER BY base.id ASC
      LIMIT ${BATCH_SIZE * 8}
    `,
    params,
  );

  const grouped = new Map();
  for (const row of rows) {
    const existing = grouped.get(row.id) ?? { ...row, tags: [] };
    delete existing.tagName;
    if (row.tagName) {
      existing.tags.push(row.tagName);
    }
    grouped.set(row.id, existing);
  }

  return [...grouped.values()].slice(0, BATCH_SIZE);
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
  await withDevTransaction(async (client) => {
    await client.query('DELETE FROM "ViewHistory"');
    await client.query('DELETE FROM "Vote"');
    await client.query('DELETE FROM "Comment"');
    await client.query('DELETE FROM "ForumPost"');
    await client.query('DELETE FROM "Forum"');
    await client.query('DELETE FROM "Note"');
    await client.query('DELETE FROM "PastPaper"');
    await client.query('DELETE FROM "Module"');
    await client.query('DELETE FROM "Subject"');
    await client.query('DELETE FROM "Tag"');
    await client.query('DELETE FROM "syllabi"');
    await client.query('DELETE FROM "accounts"');
    await client.query('DELETE FROM "sessions"');
    await client.query('DELETE FROM "User"');
  });
}

async function ensureSystemUser() {
  if (DRY_RUN) {
    return { id: 'dry-run' };
  }

  return withDevTransaction(async (client) => {
    const [user] = await queryRows(
      client,
      `
        INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, 'MODERATOR', NOW(), NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          "updatedAt" = NOW()
        RETURNING id
      `,
      [SYSTEM_EMAIL, SYSTEM_NAME],
    );

    return user;
  });
}

async function assertDevSchema() {
  if (DRY_RUN) return;

  try {
    await queryRows(dev.pool, 'SELECT id FROM "User" LIMIT 1');
  } catch (error) {
    if (error && error.code === '42P01') {
      console.error('Dev database is missing tables. Apply the schema to DEV_DATABASE first.');
      console.error('Example: DATABASE_URL="$DEV_DATABASE" pnpm exec drizzle-kit push');
      process.exit(1);
    }

    throw error;
  }
}

async function copyTags() {
  await copyInBatches('Tags', fetchTagsBatch, async (tags) => {
    await withDevTransaction(async (client) => {
      for (const tag of tags) {
        await client.query(
          `
            INSERT INTO "Tag" (id, name, aliases, "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())
            ON CONFLICT (name)
            DO UPDATE SET
              aliases = EXCLUDED.aliases,
              "updatedAt" = NOW()
          `,
          [tag.name, tag.aliases ?? []],
        );
      }
    });
  });
}

async function copySubjects() {
  await copyInBatches('Subjects', fetchSubjectsBatch, async (subjects) => {
    await withDevTransaction(async (client) => {
      for (const subject of subjects) {
        await client.query(
          `
            INSERT INTO "Subject" (id, name)
            VALUES ($1, $2)
            ON CONFLICT (name) DO NOTHING
          `,
          [subject.id, subject.name],
        );
      }
    });
  });
}

async function copyModules() {
  await copyInBatches('Modules', fetchModulesBatch, async (modules) => {
    await withDevTransaction(async (client) => {
      for (const module of modules) {
        const [subject] = await queryRows(
          client,
          'SELECT id FROM "Subject" WHERE name = $1 LIMIT 1',
          [module.subjectName],
        );
        if (!subject?.id) {
          throw new Error(`Missing subject ${module.subjectName} in dev database.`);
        }

        await client.query(
          `
            INSERT INTO "Module" (id, title, "subjectId", "webReferences", "youtubeLinks")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id)
            DO UPDATE SET
              title = EXCLUDED.title,
              "subjectId" = EXCLUDED."subjectId",
              "webReferences" = EXCLUDED."webReferences",
              "youtubeLinks" = EXCLUDED."youtubeLinks"
          `,
          [
            module.id,
            module.title,
            subject.id,
            module.webReferences ?? [],
            module.youtubeLinks ?? [],
          ],
        );
      }
    });
  });
}

async function copySyllabi() {
  await copyInBatches('Syllabi', fetchSyllabiBatch, async (rows) => {
    await withDevTransaction(async (client) => {
      for (const syllabus of rows) {
        await client.query(
          `
            INSERT INTO "syllabi" (id, name, "fileUrl")
            VALUES ($1, $2, $3)
            ON CONFLICT (id)
            DO UPDATE SET
              name = EXCLUDED.name,
              "fileUrl" = EXCLUDED."fileUrl"
          `,
          [syllabus.id, syllabus.name, syllabus.fileUrl],
        );
      }
    });
  });
}

async function copyNotes(systemUserId) {
  await copyInBatches(
    'Notes',
    (cursor) =>
      fetchTaggedBatch({
        table: 'Note',
        joinTable: '_NoteToTag',
        columns: [
          'base.id',
          'base.title',
          'base."fileUrl"',
          'base."thumbNailUrl"',
          'base."isClear"',
        ],
        cursor,
      }),
    async (notes) => {
      await withDevTransaction(async (client) => {
        for (const note of notes) {
          await client.query(
            `
              INSERT INTO "Note" (
                id, title, "fileUrl", "thumbNailUrl", "authorId", "isClear", "createdAt", "updatedAt"
              )
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              ON CONFLICT (id)
              DO UPDATE SET
                title = EXCLUDED.title,
                "fileUrl" = EXCLUDED."fileUrl",
                "thumbNailUrl" = EXCLUDED."thumbNailUrl",
                "authorId" = EXCLUDED."authorId",
                "isClear" = EXCLUDED."isClear",
                "updatedAt" = NOW()
            `,
            [
              note.id,
              note.title,
              note.fileUrl,
              note.thumbNailUrl,
              systemUserId,
              note.isClear,
            ],
          );
          await syncTagLinks(client, '_NoteToTag', note.id, note.tags);
        }
      });
    },
  );
}

async function copyPastPapers(systemUserId) {
  await copyInBatches(
    'Past papers',
    (cursor) =>
      fetchTaggedBatch({
        table: 'PastPaper',
        joinTable: '_PastPaperToTag',
        columns: [
          'base.id',
          'base.title',
          'base."fileUrl"',
          'base."thumbNailUrl"',
          'base."isClear"',
        ],
        cursor,
      }),
    async (papers) => {
      await withDevTransaction(async (client) => {
        for (const paper of papers) {
          await client.query(
            `
              INSERT INTO "PastPaper" (
                id, title, "fileUrl", "thumbNailUrl", "authorId", "isClear", "createdAt", "updatedAt"
              )
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              ON CONFLICT (id)
              DO UPDATE SET
                title = EXCLUDED.title,
                "fileUrl" = EXCLUDED."fileUrl",
                "thumbNailUrl" = EXCLUDED."thumbNailUrl",
                "authorId" = EXCLUDED."authorId",
                "isClear" = EXCLUDED."isClear",
                "updatedAt" = NOW()
            `,
            [
              paper.id,
              paper.title,
              paper.fileUrl,
              paper.thumbNailUrl,
              systemUserId,
              paper.isClear,
            ],
          );
          await syncTagLinks(client, '_PastPaperToTag', paper.id, paper.tags);
        }
      });
    },
  );
}

async function copyForums() {
  await copyInBatches(
    'Forums',
    (cursor) =>
      fetchTaggedBatch({
        table: 'Forum',
        joinTable: '_ForumToTag',
        columns: ['base.id', 'base."courseName"'],
        cursor,
      }),
    async (forums) => {
      await withDevTransaction(async (client) => {
        for (const forum of forums) {
          await client.query(
            `
              INSERT INTO "Forum" (id, "courseName", "createdAt", "updatedAt")
              VALUES ($1, $2, NOW(), NOW())
              ON CONFLICT (id)
              DO UPDATE SET
                "courseName" = EXCLUDED."courseName",
                "updatedAt" = NOW()
            `,
            [forum.id, forum.courseName],
          );
          await syncTagLinks(client, '_ForumToTag', forum.id, forum.tags);
        }
      });
    },
  );
}

async function copyForumPosts(systemUserId) {
  await copyInBatches(
    'Forum posts',
    (cursor) =>
      fetchTaggedBatch({
        table: 'ForumPost',
        joinTable: '_ForumPostToTag',
        columns: [
          'base.id',
          'base.title',
          'base.description',
          'base."upvoteCount"',
          'base."downvoteCount"',
          'base."forumId"',
        ],
        cursor,
      }),
    async (posts) => {
      await withDevTransaction(async (client) => {
        for (const post of posts) {
          await client.query(
            `
              INSERT INTO "ForumPost" (
                id,
                title,
                description,
                "upvoteCount",
                "downvoteCount",
                "forumId",
                "authorId",
                "createdAt",
                "updatedAt"
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
              ON CONFLICT (id)
              DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                "upvoteCount" = EXCLUDED."upvoteCount",
                "downvoteCount" = EXCLUDED."downvoteCount",
                "forumId" = EXCLUDED."forumId",
                "authorId" = EXCLUDED."authorId",
                "updatedAt" = NOW()
            `,
            [
              post.id,
              post.title,
              post.description,
              post.upvoteCount,
              post.downvoteCount,
              post.forumId,
              systemUserId,
            ],
          );
          await syncTagLinks(client, '_ForumPostToTag', post.id, post.tags);
        }
      });
    },
  );
}

async function copyComments(systemUserId) {
  await copyInBatches('Comments', fetchCommentsBatch, async (comments) => {
    await withDevTransaction(async (client) => {
      for (const comment of comments) {
        await client.query(
          `
            INSERT INTO "Comment" (id, content, "forumPostId", "authorId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (id)
            DO UPDATE SET
              content = EXCLUDED.content,
              "forumPostId" = EXCLUDED."forumPostId",
              "authorId" = EXCLUDED."authorId",
              "updatedAt" = NOW()
          `,
          [comment.id, comment.content, comment.forumPostId, systemUserId],
        );
      }
    });
  });
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
    await Promise.allSettled([prod.close(), dev.close()]);
  });
