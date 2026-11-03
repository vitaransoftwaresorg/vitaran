-- 20261029150000 already created om_scans. Align it with the new scan model.
ALTER TABLE "om_scans" DROP COLUMN IF EXISTS "rank";
ALTER TABLE "om_scans" DROP COLUMN IF EXISTS "class_size";

ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "om_scans" ADD COLUMN IF NOT EXISTS "actor" VARCHAR(16) NOT NULL DEFAULT 'ADMIN';

ALTER TABLE "om_scans" DROP CONSTRAINT IF EXISTS "om_scans_scanned_by_id_fkey";
ALTER TABLE "om_scans" ADD CONSTRAINT "om_scans_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
