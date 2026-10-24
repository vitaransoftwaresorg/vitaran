-- CreateEnum
CREATE TYPE "AnswerKeyPattern" AS ENUM ('MAINS', 'ADVANCED');

-- AlterTable
ALTER TABLE "answer_keys" ADD COLUMN "pattern" "AnswerKeyPattern" NOT NULL DEFAULT 'MAINS';
