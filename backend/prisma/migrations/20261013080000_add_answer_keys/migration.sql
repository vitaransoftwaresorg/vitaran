-- CreateTable
CREATE TABLE "answer_keys" (
    "id" UUID NOT NULL,
    "program" "Program" NOT NULL,
    "type" "SchoolType" NOT NULL,
    "school_id" UUID,
    "test_number" SMALLINT NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "answer_keys_created_at_idx" ON "answer_keys"("created_at");

-- CreateIndex
CREATE INDEX "answer_keys_school_id_idx" ON "answer_keys"("school_id");

-- AddForeignKey
ALTER TABLE "answer_keys" ADD CONSTRAINT "answer_keys_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
