-- CreateTable
CREATE TABLE "school_sections" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "program_id" UUID NOT NULL,
    "student_count" SMALLINT NOT NULL,
    "class_teacher_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "school_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_sections_school_id_class_level_idx" ON "school_sections"("school_id", "class_level");

-- CreateIndex
CREATE INDEX "school_sections_program_id_idx" ON "school_sections"("program_id");

-- CreateIndex
CREATE INDEX "school_sections_class_teacher_id_idx" ON "school_sections"("class_teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_sections_school_id_class_level_name_key" ON "school_sections"("school_id", "class_level", "name");

-- AddForeignKey
ALTER TABLE "school_sections" ADD CONSTRAINT "school_sections_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_sections" ADD CONSTRAINT "school_sections_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_sections" ADD CONSTRAINT "school_sections_class_teacher_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy class-level class teachers (replaced by per-section classTeacherId).
DROP TABLE IF EXISTS "class_teachers";
