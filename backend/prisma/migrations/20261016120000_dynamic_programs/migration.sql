-- Dynamic learning programs + school class/subject offerings + class teachers.

-- 1. Catalog
CREATE TABLE "learning_programs" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "year" INTEGER NOT NULL,
    "class_from" SMALLINT NOT NULL,
    "class_to" SMALLINT NOT NULL,
    "subjects" "Subject"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_programs_code_key" ON "learning_programs"("code");
CREATE INDEX "learning_programs_year_idx" ON "learning_programs"("year");
CREATE INDEX "learning_programs_created_at_idx" ON "learning_programs"("created_at");

-- Seed from the previous Program enum (academic year 2025).
INSERT INTO "learning_programs" ("id", "code", "name", "year", "class_from", "class_to", "subjects", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'INTEGRATED', 'Integrated Program', 2025, 6, 10, ARRAY['MATHEMATICS','PHYSICS','CHEMISTRY','BIOLOGY']::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ADVANCED', 'Advanced Program', 2025, 6, 10, ARRAY['MATHEMATICS','PHYSICS','CHEMISTRY','BIOLOGY']::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'REVISED_ADVANCED', 'Revised Advanced Program', 2025, 6, 10, ARRAY['MATHEMATICS','PHYSICS','CHEMISTRY','BIOLOGY']::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OLYMPIAD', 'Olympiad Program', 2025, 6, 10, ARRAY['MATHEMATICS','PHYSICS','CHEMISTRY','BIOLOGY']::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OLYMPIAD_PRIMARY', 'Olympiad Program Class 1 to 5', 2025, 1, 5, ARRAY['MATHEMATICS','SCIENCE']::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. School program offerings
CREATE TABLE "school_programs" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_programs_school_id_program_id_key" ON "school_programs"("school_id", "program_id");
CREATE INDEX "school_programs_program_id_idx" ON "school_programs"("program_id");

ALTER TABLE "school_programs" ADD CONSTRAINT "school_programs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_programs" ADD CONSTRAINT "school_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school_program_classes" (
    "id" UUID NOT NULL,
    "school_program_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "subjects" "Subject"[],

    CONSTRAINT "school_program_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_program_classes_school_program_id_class_level_key" ON "school_program_classes"("school_program_id", "class_level");

ALTER TABLE "school_program_classes" ADD CONSTRAINT "school_program_classes_school_program_id_fkey" FOREIGN KEY ("school_program_id") REFERENCES "school_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill school enrollments from schools.programs + schools.subjects
INSERT INTO "school_programs" ("id", "school_id", "program_id", "created_at", "updated_at")
SELECT gen_random_uuid(), s.id, lp.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "schools" s
CROSS JOIN LATERAL unnest(s.programs) AS p(code)
JOIN "learning_programs" lp ON lp.code = p.code::text;

INSERT INTO "school_program_classes" ("id", "school_program_id", "class_level", "subjects")
SELECT
  gen_random_uuid(),
  sp.id,
  cls.class_level,
  (
    SELECT COALESCE(array_agg(sub ORDER BY sub), ARRAY[]::"Subject"[])
    FROM unnest(lp.subjects) AS sub
    WHERE sub = ANY (s.subjects) OR cardinality(s.subjects) = 0
  )
FROM "school_programs" sp
JOIN "schools" s ON s.id = sp.school_id
JOIN "learning_programs" lp ON lp.id = sp.program_id
CROSS JOIN LATERAL generate_series(lp.class_from::int, lp.class_to::int) AS cls(class_level);

-- 3. Teacher assignments: add program_id
ALTER TABLE "teacher_assignments" ADD COLUMN "program_id" UUID;

-- Attach each existing assignment to every school program that includes that class (prefer first match).
UPDATE "teacher_assignments" ta
SET "program_id" = (
  SELECT sp.program_id
  FROM "teachers" t
  JOIN "school_programs" sp ON sp.school_id = t.school_id
  JOIN "school_program_classes" spc ON spc.school_program_id = sp.id
  WHERE t.id = ta.teacher_id
    AND spc.class_level = ta.class_level
    AND ta.subject = ANY (spc.subjects)
  ORDER BY sp.created_at
  LIMIT 1
);

-- Fallback: any program of the teacher's school
UPDATE "teacher_assignments" ta
SET "program_id" = (
  SELECT sp.program_id
  FROM "teachers" t
  JOIN "school_programs" sp ON sp.school_id = t.school_id
  WHERE t.id = ta.teacher_id
  ORDER BY sp.created_at
  LIMIT 1
)
WHERE ta.program_id IS NULL;

-- Orphan assignments (teacher school has no programs) — delete
DELETE FROM "teacher_assignments" WHERE "program_id" IS NULL;

ALTER TABLE "teacher_assignments" ALTER COLUMN "program_id" SET NOT NULL;

DROP INDEX IF EXISTS "teacher_assignments_teacher_id_class_level_subject_key";
CREATE UNIQUE INDEX "teacher_assignments_teacher_id_program_id_class_level_subject_key"
  ON "teacher_assignments"("teacher_id", "program_id", "class_level", "subject");
CREATE INDEX "teacher_assignments_program_id_idx" ON "teacher_assignments"("program_id");

ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Class teachers
CREATE TABLE "class_teachers" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "class_level" SMALLINT NOT NULL,
    "teacher_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_teachers_school_id_program_id_class_level_teacher_id_key"
  ON "class_teachers"("school_id", "program_id", "class_level", "teacher_id");
CREATE INDEX "class_teachers_school_id_program_id_class_level_idx"
  ON "class_teachers"("school_id", "program_id", "class_level");
CREATE INDEX "class_teachers_teacher_id_idx" ON "class_teachers"("teacher_id");

ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "learning_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Answer keys: enum → program_code text
ALTER TABLE "answer_keys" ADD COLUMN "program_code" VARCHAR(64);
UPDATE "answer_keys" SET "program_code" = "program"::text;
ALTER TABLE "answer_keys" ALTER COLUMN "program_code" SET NOT NULL;
ALTER TABLE "answer_keys" DROP COLUMN "program";
CREATE INDEX "answer_keys_program_code_idx" ON "answer_keys"("program_code");

-- 6. Result sets: enum → program_code text
ALTER TABLE "result_sets" ADD COLUMN "program_code" VARCHAR(64);
UPDATE "result_sets" SET "program_code" = "program"::text WHERE "program" IS NOT NULL;
ALTER TABLE "result_sets" DROP COLUMN "program";
CREATE INDEX "result_sets_program_code_idx" ON "result_sets"("program_code");

-- 7. Drop old school array columns and Program enum
ALTER TABLE "schools" DROP COLUMN "programs";
ALTER TABLE "schools" DROP COLUMN "subjects";
DROP TYPE "Program";
