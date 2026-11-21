-- Per-range key types (normal / mcq). Questions not listed stay normal.
ALTER TABLE "answer_keys" ADD COLUMN IF NOT EXISTS "key_type_ranges" JSONB;
