-- AlterTable
ALTER TABLE "schools" ADD COLUMN "logo_mime_type" VARCHAR(64);
ALTER TABLE "schools" ADD COLUMN "logo_file_name" VARCHAR(255);
ALTER TABLE "schools" ADD COLUMN "logo_data" BYTEA;
