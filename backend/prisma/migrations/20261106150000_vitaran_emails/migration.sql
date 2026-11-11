-- AlterTable: one Vitaran inbox becomes a list, keeping the saved address.
ALTER TABLE "app_settings" ADD COLUMN "vitaran_emails" VARCHAR(254)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(254)[];

UPDATE "app_settings" SET "vitaran_emails" = ARRAY["vitaran_email"] WHERE "vitaran_email" IS NOT NULL AND "vitaran_email" <> '';

ALTER TABLE "app_settings" DROP COLUMN "vitaran_email";
