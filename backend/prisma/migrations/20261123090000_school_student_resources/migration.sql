-- CreateTable
CREATE TABLE "school_student_resources" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "subject" VARCHAR(64) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "school_student_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_student_resources_school_id_idx" ON "school_student_resources"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_student_resources_school_id_class_level_subject_key" ON "school_student_resources"("school_id", "class_level", "subject");

-- AddForeignKey
ALTER TABLE "school_student_resources" ADD CONSTRAINT "school_student_resources_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
