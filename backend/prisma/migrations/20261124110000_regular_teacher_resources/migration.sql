-- CreateTable
CREATE TABLE "regular_teacher_resources" (
    "id" UUID NOT NULL,
    "program_code" VARCHAR(64) NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "subject" VARCHAR(64) NOT NULL,
    "volume" SMALLINT NOT NULL DEFAULT 0,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "regular_teacher_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regular_teacher_resources_program_code_idx" ON "regular_teacher_resources"("program_code");

-- CreateIndex
CREATE UNIQUE INDEX "regular_teacher_resources_program_code_class_level_subject_volume_key" ON "regular_teacher_resources"("program_code", "class_level", "subject", "volume");
