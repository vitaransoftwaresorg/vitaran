-- Per-class publish for results (publishing class 7 must not publish 8/9).
ALTER TABLE "result_sheets" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "published_at" TIMESTAMPTZ(3);

-- Existing set-level publish applies to every sheet that was already uploaded.
UPDATE "result_sheets" AS sheet
SET
  "published" = result_set."published",
  "published_at" = result_set."published_at"
FROM "result_sets" AS result_set
WHERE sheet."result_set_id" = result_set."id";
