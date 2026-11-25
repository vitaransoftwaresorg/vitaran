-- Shared blank registration is an empty string (not 0000000).
-- Empty regs are not unique; real 7-digit regs stay unique per school.

UPDATE "students" SET "roll_no" = '' WHERE "roll_no" = '0000000';
UPDATE "om_scans" SET "roll_no" = '' WHERE "roll_no" = '0000000';

DROP INDEX IF EXISTS "students_school_id_roll_no_key";
CREATE UNIQUE INDEX "students_school_id_roll_no_key"
  ON "students" ("school_id", "roll_no")
  WHERE "roll_no" <> '';

DROP INDEX IF EXISTS "om_scans_school_id_roll_no_test_id_class_level_key";
CREATE UNIQUE INDEX "om_scans_school_id_roll_no_test_id_class_level_key"
  ON "om_scans" ("school_id", "roll_no", "test_id", "class_level")
  WHERE "roll_no" <> '';

DROP INDEX IF EXISTS "om_scans_school_id_student_id_test_id_class_level_key";
CREATE UNIQUE INDEX "om_scans_school_id_student_id_test_id_class_level_key"
  ON "om_scans" ("school_id", "student_id", "test_id", "class_level")
  WHERE "student_id" IS NOT NULL AND "roll_no" = '';
