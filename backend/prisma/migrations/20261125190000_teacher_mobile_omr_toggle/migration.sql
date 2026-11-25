-- Admin toggle: teacher portal mobile camera scan.
ALTER TABLE "app_settings"
ADD COLUMN "teacher_mobile_omr_enabled" BOOLEAN NOT NULL DEFAULT true;
