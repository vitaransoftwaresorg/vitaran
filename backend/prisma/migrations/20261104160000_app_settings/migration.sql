CREATE TABLE "app_settings" (
    "id" VARCHAR(32) NOT NULL,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "vitaran_email" VARCHAR(254),
    "sme_contacts" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_settings" ("id", "maintenance_mode", "vitaran_email", "sme_contacts", "updated_at")
VALUES ('default', false, NULL, '[]', CURRENT_TIMESTAMP);
