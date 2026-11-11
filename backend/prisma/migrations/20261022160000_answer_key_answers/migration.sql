-- Parsed options, explanations and dynamic MPC / MPCB ranges on each answer key.
ALTER TABLE "answer_keys" ADD COLUMN IF NOT EXISTS "answers" JSONB;
ALTER TABLE "answer_keys" ADD COLUMN IF NOT EXISTS "explanations" JSONB;
ALTER TABLE "answer_keys" ADD COLUMN IF NOT EXISTS "subject_ranges" JSONB;
