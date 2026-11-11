-- Freeform test ID on answer keys (mirrors result_sets.test_id).
ALTER TABLE "answer_keys" ADD COLUMN "test_id" VARCHAR(64);

UPDATE "answer_keys" SET "test_id" = "test_number"::text WHERE "test_id" IS NULL;

ALTER TABLE "answer_keys" ALTER COLUMN "test_id" SET NOT NULL;

CREATE INDEX "answer_keys_test_id_test_number_idx" ON "answer_keys"("test_id", "test_number");
