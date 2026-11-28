-- Home page "Our network" partner schools section (admin toggle).
ALTER TABLE "app_settings"
ADD COLUMN "home_network_enabled" BOOLEAN NOT NULL DEFAULT true;
