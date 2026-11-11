-- CreateTable
CREATE TABLE "om_scans" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "answer_key_id" UUID NOT NULL,
    "test_id" VARCHAR(64) NOT NULL,
    "roll_no" VARCHAR(64) NOT NULL,
    "answers" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "subject_scores" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "blank" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "max_total" INTEGER NOT NULL,
    "rank" INTEGER,
    "class_size" INTEGER,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "image" BYTEA NOT NULL,
    "scanned_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "om_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "om_scans_student_id_test_id_key" ON "om_scans"("student_id", "test_id");
CREATE INDEX "om_scans_school_id_test_id_idx" ON "om_scans"("school_id", "test_id");
CREATE INDEX "om_scans_answer_key_id_idx" ON "om_scans"("answer_key_id");
CREATE INDEX "om_scans_scanned_by_id_idx" ON "om_scans"("scanned_by_id");

ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_answer_key_id_fkey" FOREIGN KEY ("answer_key_id") REFERENCES "answer_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
