-- One answer key per test ID. Test numbers may repeat; test IDs may not.
CREATE UNIQUE INDEX "answer_keys_test_id_key" ON "answer_keys"("test_id");
