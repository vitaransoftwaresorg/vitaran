-- CreateTable
CREATE TABLE "om_result_releases" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "test_id" VARCHAR(64) NOT NULL,
    "program_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "section_key" VARCHAR(64) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "om_result_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "om_result_releases_school_id_test_id_program_id_class_level_key" ON "om_result_releases"("school_id", "test_id", "program_id", "class_level", "section_key");

-- CreateIndex
CREATE INDEX "om_result_releases_updated_by_id_idx" ON "om_result_releases"("updated_by_id");

-- AddForeignKey
ALTER TABLE "om_result_releases" ADD CONSTRAINT "om_result_releases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "om_result_releases" ADD CONSTRAINT "om_result_releases_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
