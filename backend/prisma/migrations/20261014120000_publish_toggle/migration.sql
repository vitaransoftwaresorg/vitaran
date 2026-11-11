-- AlterTable
ALTER TABLE "answer_keys" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "result_sets" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_at" TIMESTAMPTZ(3);
