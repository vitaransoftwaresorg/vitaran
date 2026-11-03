-- Subjects are per-program strings, not a fixed enum.
ALTER TABLE "learning_programs"
  ALTER COLUMN "subjects" TYPE TEXT[]
  USING "subjects"::text[];

ALTER TABLE "school_program_classes"
  ALTER COLUMN "subjects" TYPE TEXT[]
  USING "subjects"::text[];

ALTER TABLE "teacher_assignments"
  ALTER COLUMN "subject" TYPE VARCHAR(64)
  USING "subject"::text;

DROP TYPE IF EXISTS "Subject";
