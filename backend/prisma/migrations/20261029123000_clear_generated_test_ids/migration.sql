-- Drop auto-filled codes like ADVANCED-C6-T1 and BR_OXFORD-xxxxxxxx-C6-T3.
UPDATE "answer_keys"
SET "test_id" = NULL
WHERE "test_id" ~* '^[A-Z0-9_]+(-[a-f0-9]{8})?-C[0-9]{1,2}-T[0-9]{1,2}$';
