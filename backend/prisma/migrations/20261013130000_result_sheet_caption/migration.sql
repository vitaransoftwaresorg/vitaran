-- AlterTable
ALTER TABLE "result_sheets" ADD COLUMN     "caption" TEXT[] DEFAULT ARRAY[]::TEXT[];
