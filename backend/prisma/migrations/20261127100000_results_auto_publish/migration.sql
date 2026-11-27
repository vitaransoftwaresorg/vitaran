-- Admin toggle: when true, new/updated class results publish to schools immediately.
ALTER TABLE "app_settings"
ADD COLUMN "results_auto_publish" BOOLEAN NOT NULL DEFAULT true;
