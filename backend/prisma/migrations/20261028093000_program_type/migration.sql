-- Regular vs customized catalog programs.
ALTER TABLE "learning_programs" ADD COLUMN "type" "SchoolType" NOT NULL DEFAULT 'REGULAR';
CREATE INDEX "learning_programs_type_idx" ON "learning_programs"("type");
