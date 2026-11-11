ALTER TABLE "answer_keys" ALTER COLUMN "correct_marks" SET DEFAULT 1;
UPDATE "answer_keys" SET "correct_marks" = 1 WHERE "correct_marks" = 4;
