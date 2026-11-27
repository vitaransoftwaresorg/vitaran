-- New result sets/sheets default to published (auto-publish).
ALTER TABLE "result_sets" ALTER COLUMN "published" SET DEFAULT true;
ALTER TABLE "result_sheets" ALTER COLUMN "published" SET DEFAULT true;

-- Bring existing unpublished results in line with the new default.
UPDATE "result_sheets"
SET "published" = true,
    "published_at" = COALESCE("published_at", NOW())
WHERE "published" = false;

UPDATE "result_sets"
SET "published" = true,
    "published_at" = COALESCE("published_at", NOW())
WHERE "published" = false;
