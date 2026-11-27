-- Head office shared customized teacher PDFs + optional school→school resource reuse.

CREATE TABLE "head_office_teacher_resources" (
    "id" UUID NOT NULL,
    "head_office_id" UUID NOT NULL,
    "program_code" VARCHAR(64) NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "subject" VARCHAR(64) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "head_office_teacher_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "head_office_teacher_resources_head_office_id_program_code_class_level_subject_key"
  ON "head_office_teacher_resources"("head_office_id", "program_code", "class_level", "subject");

CREATE INDEX "head_office_teacher_resources_head_office_id_idx"
  ON "head_office_teacher_resources"("head_office_id");

CREATE INDEX "head_office_teacher_resources_head_office_id_program_code_idx"
  ON "head_office_teacher_resources"("head_office_id", "program_code");

ALTER TABLE "head_office_teacher_resources"
  ADD CONSTRAINT "head_office_teacher_resources_head_office_id_fkey"
  FOREIGN KEY ("head_office_id") REFERENCES "head_offices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schools"
  ADD COLUMN "teacher_resource_source_school_id" UUID;

CREATE INDEX "schools_teacher_resource_source_school_id_idx"
  ON "schools"("teacher_resource_source_school_id");

ALTER TABLE "schools"
  ADD CONSTRAINT "schools_teacher_resource_source_school_id_fkey"
  FOREIGN KEY ("teacher_resource_source_school_id") REFERENCES "schools"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
