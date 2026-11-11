-- AlterTable: remembers who already got the objection-list welcome email, so re-adding someone does not email them again.
ALTER TABLE "app_settings" ADD COLUMN "objection_welcomed" VARCHAR(320)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(320)[];

-- Everyone on the lists today has already been welcomed.
UPDATE "app_settings" SET "objection_welcomed" =
  ARRAY(SELECT 'vitaran|' || lower(e) FROM unnest("vitaran_emails") AS e)
  || ARRAY(
    SELECT 'sme|' || lower(x->>'email') || '|' || upper(x->>'subject')
    FROM jsonb_array_elements(COALESCE("sme_contacts", '[]'::jsonb)) AS x
    WHERE x->>'email' IS NOT NULL AND x->>'subject' IS NOT NULL
  );
