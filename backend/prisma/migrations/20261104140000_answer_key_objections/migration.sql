-- CreateEnum
CREATE TYPE "AnswerKeyObjectionStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnswerKeyObjectionRaisedBy" AS ENUM ('SCHOOL', 'TEACHER');

-- CreateTable
CREATE TABLE "answer_key_objections" (
    "id" UUID NOT NULL,
    "answer_key_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "raised_by" "AnswerKeyObjectionRaisedBy" NOT NULL,
    "teacher_id" UUID,
    "question_number" SMALLINT,
    "message" VARCHAR(2000) NOT NULL,
    "status" "AnswerKeyObjectionStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" VARCHAR(2000),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "answer_key_objections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "answer_key_objections_answer_key_id_idx" ON "answer_key_objections"("answer_key_id");
CREATE INDEX "answer_key_objections_school_id_idx" ON "answer_key_objections"("school_id");
CREATE INDEX "answer_key_objections_status_created_at_idx" ON "answer_key_objections"("status", "created_at");
CREATE INDEX "answer_key_objections_teacher_id_idx" ON "answer_key_objections"("teacher_id");

ALTER TABLE "answer_key_objections" ADD CONSTRAINT "answer_key_objections_answer_key_id_fkey"
  FOREIGN KEY ("answer_key_id") REFERENCES "answer_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_key_objections" ADD CONSTRAINT "answer_key_objections_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_key_objections" ADD CONSTRAINT "answer_key_objections_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
