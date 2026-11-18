-- Admin toggle: when true, published regular answer keys are public on /answer-keys.
ALTER TABLE "app_settings"
ADD COLUMN "answer_keys_public" BOOLEAN NOT NULL DEFAULT false;
