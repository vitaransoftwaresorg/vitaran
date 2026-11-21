-- School/section answer keys may reuse the same test ID as the platform key.
DROP INDEX IF EXISTS "answer_keys_test_id_key";

ALTER TABLE "answer_keys"
  ADD COLUMN IF NOT EXISTS "section_id" UUID;

ALTER TABLE "answer_keys"
  ADD CONSTRAINT "answer_keys_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school_sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "answer_keys_section_id_idx" ON "answer_keys"("section_id");
CREATE INDEX IF NOT EXISTS "answer_keys_test_id_school_id_section_id_idx"
  ON "answer_keys"("test_id", "school_id", "section_id");

-- One platform (shared) key per test ID.
CREATE UNIQUE INDEX "answer_keys_platform_test_id_uidx"
  ON "answer_keys"("test_id")
  WHERE "school_id" IS NULL AND "test_id" IS NOT NULL;

-- One school/section override per test ID (null section = whole-class / school-wide).
CREATE UNIQUE INDEX "answer_keys_school_section_test_id_uidx"
  ON "answer_keys"(
    "test_id",
    "school_id",
    COALESCE("section_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE "school_id" IS NOT NULL AND "test_id" IS NOT NULL;
