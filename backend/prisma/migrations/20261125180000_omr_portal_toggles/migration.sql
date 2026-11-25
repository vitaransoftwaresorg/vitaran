-- Admin toggles: school/teacher desktop OMR and school mobile scan.
ALTER TABLE "app_settings"
ADD COLUMN "school_desktop_omr_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "teacher_desktop_omr_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "school_mobile_omr_enabled" BOOLEAN NOT NULL DEFAULT true;
