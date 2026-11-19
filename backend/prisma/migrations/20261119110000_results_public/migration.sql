-- Admin toggle: when true, published results are public on /results.
ALTER TABLE "app_settings"
ADD COLUMN "results_public" BOOLEAN NOT NULL DEFAULT false;
