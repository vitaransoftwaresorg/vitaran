-- Recreate class-level class teachers (used when a program+class has no sections yet).
CREATE TABLE "class_teachers" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "teacher_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_teachers_school_id_program_id_class_level_key"
  ON "class_teachers"("school_id", "program_id", "class_level");

CREATE INDEX "class_teachers_teacher_id_idx" ON "class_teachers"("teacher_id");

ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_teachers"
  ADD CONSTRAINT "class_teachers_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
