-- Answer keys are per subject within a program/test/class.
ALTER TABLE "answer_keys" ADD COLUMN "subject" "Subject";

UPDATE "answer_keys" SET "subject" = 'MATHEMATICS' WHERE "subject" IS NULL;

ALTER TABLE "answer_keys" ALTER COLUMN "subject" SET NOT NULL;

CREATE INDEX "answer_keys_subject_idx" ON "answer_keys"("subject");
