-- Students no longer sign in.
ALTER TABLE "students" DROP COLUMN "password_hash",
DROP COLUMN "password_encrypted";
