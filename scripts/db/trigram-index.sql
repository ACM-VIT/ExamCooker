-- Trigram index for fast course-name search on CockroachDB.
-- Uses gin_trgm_ops as per CockroachDB trigram index docs.

DROP INDEX IF EXISTS "Tag_name_trgm_idx";
CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING GIN ("name" gin_trgm_ops);
