-- DropForeignKey
ALTER TABLE "results" DROP CONSTRAINT "results_school_id_fkey";

-- DropTable
DROP TABLE "results";

-- CreateTable
CREATE TABLE "result_sets" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "program" "Program",
    "program_name" VARCHAR(120),
    "program_key" VARCHAR(130) NOT NULL,
    "test_number" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_sheets" (
    "id" UUID NOT NULL,
    "result_set_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "columns" JSONB NOT NULL,
    "row_count" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_rows" (
    "sheet_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "result_rows_pkey" PRIMARY KEY ("sheet_id","position")
);

-- CreateIndex
CREATE INDEX "result_sets_updated_at_idx" ON "result_sets"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "result_sets_school_id_program_key_test_number_key" ON "result_sets"("school_id", "program_key", "test_number");

-- CreateIndex
CREATE UNIQUE INDEX "result_sheets_result_set_id_class_level_key" ON "result_sheets"("result_set_id", "class_level");

-- AddForeignKey
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_sheets" ADD CONSTRAINT "result_sheets_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_rows" ADD CONSTRAINT "result_rows_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "result_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
