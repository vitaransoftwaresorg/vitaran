ALTER TABLE "om_scans" DROP CONSTRAINT IF EXISTS "om_scans_student_id_test_id_key";
DROP INDEX IF EXISTS "om_scans_student_id_test_id_key";

ALTER TABLE "om_scans" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE "om_scans" DROP CONSTRAINT IF EXISTS "om_scans_student_id_fkey";
ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "student_name" VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "class_level" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "section_name" VARCHAR(32);
ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "program_name" VARCHAR(120);

UPDATE "om_scans" AS scan
SET
  "student_name" = student."name",
  "class_level" = student."class_level"
FROM "students" AS student
WHERE scan."student_id" = student."id"
  AND (scan."student_name" = '' OR scan."class_level" = 0);

CREATE UNIQUE INDEX IF NOT EXISTS "om_scans_school_id_roll_no_test_id_class_level_key"
  ON "om_scans"("school_id", "roll_no", "test_id", "class_level");
