-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "program" "Program" NOT NULL,
    "test_number" SMALLINT NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "results_updated_at_idx" ON "results"("updated_at");

-- CreateIndex
CREATE INDEX "results_school_id_idx" ON "results"("school_id");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
