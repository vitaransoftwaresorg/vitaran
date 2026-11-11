-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('REGULAR', 'CUSTOMIZED');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "type" "SchoolType" NOT NULL DEFAULT 'REGULAR';
