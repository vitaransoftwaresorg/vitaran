-- Freeform school ID (code), independent of serial.
ALTER TABLE "schools" ADD COLUMN "code" VARCHAR(64);
UPDATE "schools" SET "code" = 'VLS-' || LPAD("serial"::text, 4, '0');
ALTER TABLE "schools" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- Human test ID alongside ordinal test number on results.
ALTER TABLE "result_sets" ADD COLUMN "test_id" VARCHAR(64);
UPDATE "result_sets" SET "test_id" = "test_number"::text;
ALTER TABLE "result_sets" ALTER COLUMN "test_id" SET NOT NULL;
