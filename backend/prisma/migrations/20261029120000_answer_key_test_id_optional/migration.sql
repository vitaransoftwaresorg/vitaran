-- Test ID is typed on the answers editor, not generated at create.
ALTER TABLE "answer_keys" ALTER COLUMN "test_id" DROP NOT NULL;
