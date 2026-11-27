-- Head office portal login credentials
ALTER TABLE "head_offices" ADD COLUMN "account_email" VARCHAR(254);
ALTER TABLE "head_offices" ADD COLUMN "account_phone" VARCHAR(20);
ALTER TABLE "head_offices" ADD COLUMN "password_hash" VARCHAR(255);
ALTER TABLE "head_offices" ADD COLUMN "password_encrypted" VARCHAR(512);

-- Seed login identifiers from existing contact fields
UPDATE "head_offices"
SET
  "account_email" = LOWER(TRIM("contact_email")),
  "account_phone" = "contact_phone"
WHERE "account_email" IS NULL;

CREATE UNIQUE INDEX "head_offices_account_email_key" ON "head_offices"("account_email");
CREATE INDEX "head_offices_account_phone_idx" ON "head_offices"("account_phone");
