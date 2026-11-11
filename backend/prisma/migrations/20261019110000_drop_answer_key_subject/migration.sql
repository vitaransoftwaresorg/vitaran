-- Answer keys are per program/class/test, not per subject.
-- A leftover NOT NULL "subject" column blocked creates (P2011).
ALTER TABLE "answer_keys" DROP COLUMN IF EXISTS "subject";
