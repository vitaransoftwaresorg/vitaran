-- Whole-class rows (no section) for schools that organize by class only.
CREATE TABLE "school_classes" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "program_id" UUID NOT NULL,
    "student_count" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "school_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_classes_school_id_class_level_key"
  ON "school_classes"("school_id", "class_level");

CREATE INDEX "school_classes_program_id_idx" ON "school_classes"("program_id");

ALTER TABLE "school_classes"
  ADD CONSTRAINT "school_classes_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_classes"
  ADD CONSTRAINT "school_classes_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
