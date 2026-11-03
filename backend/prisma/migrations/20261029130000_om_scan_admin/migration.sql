-- Admin OMR scans are not tied to a teacher account.
ALTER TABLE "om_scans" ALTER COLUMN "scanned_by_id" DROP NOT NULL;
