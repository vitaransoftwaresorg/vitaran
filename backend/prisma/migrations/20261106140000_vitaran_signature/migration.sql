-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "vitaran_signature_data" BYTEA,
ADD COLUMN "vitaran_signature_mime_type" VARCHAR(64);
