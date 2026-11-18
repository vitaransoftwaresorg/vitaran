-- Admin toggle: when true, /teachers-resources is browsable without login.
ALTER TABLE "app_settings"
ADD COLUMN "teacher_resources_public" BOOLEAN NOT NULL DEFAULT false;
