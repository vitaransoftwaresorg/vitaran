-- Add program_code so customized resources are school × program × class × subject.
ALTER TABLE "school_student_resources" ADD COLUMN "program_code" VARCHAR(64);

-- Backfill from the school's customized program first, else any enrolled program.
UPDATE "school_student_resources" AS r
SET "program_code" = (
  SELECT lp.code
  FROM "school_programs" sp
  INNER JOIN "learning_programs" lp ON lp.id = sp.program_id
  WHERE sp.school_id = r.school_id
  ORDER BY CASE WHEN lp.type = 'CUSTOMIZED' THEN 0 ELSE 1 END, lp.code ASC
  LIMIT 1
);

DELETE FROM "school_student_resources" WHERE "program_code" IS NULL;

ALTER TABLE "school_student_resources" ALTER COLUMN "program_code" SET NOT NULL;

DROP INDEX IF EXISTS "school_student_resources_school_id_class_level_subject_key";

CREATE UNIQUE INDEX "school_student_resources_school_id_program_code_class_level_subject_key"
  ON "school_student_resources"("school_id", "program_code", "class_level", "subject");

CREATE INDEX "school_student_resources_school_id_program_code_idx"
  ON "school_student_resources"("school_id", "program_code");
