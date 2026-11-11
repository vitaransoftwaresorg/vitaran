-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "PasswordResetRole" ADD VALUE 'STUDENT';

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "roll_no" VARCHAR(64) NOT NULL,
    "email" VARCHAR(254),
    "program_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "section_id" UUID,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "password_hash" VARCHAR(255) NOT NULL,
    "password_encrypted" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "students_school_id_roll_no_key" ON "students"("school_id", "roll_no");
CREATE INDEX "students_school_id_class_level_idx" ON "students"("school_id", "class_level");
CREATE INDEX "students_program_id_idx" ON "students"("program_id");
CREATE INDEX "students_section_id_idx" ON "students"("section_id");
CREATE INDEX "students_email_idx" ON "students"("email");
CREATE INDEX "students_status_idx" ON "students"("status");

ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
