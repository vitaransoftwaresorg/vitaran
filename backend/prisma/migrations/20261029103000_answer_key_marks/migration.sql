-- Per-key marking: +correct / −wrong.
ALTER TABLE "answer_keys" ADD COLUMN "correct_marks" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "answer_keys" ADD COLUMN "wrong_marks" INTEGER NOT NULL DEFAULT 0;
