-- CreateTable
CREATE TABLE "head_offices" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "contact_email" VARCHAR(254) NOT NULL,
    "contact_phone" VARCHAR(20) NOT NULL,
    "address_line" VARCHAR(300) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "head_offices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "head_offices_code_key" ON "head_offices"("code");

-- CreateIndex
CREATE INDEX "head_offices_created_at_idx" ON "head_offices"("created_at");

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "head_office_id" UUID;

-- CreateIndex
CREATE INDEX "schools_head_office_id_idx" ON "schools"("head_office_id");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_head_office_id_fkey" FOREIGN KEY ("head_office_id") REFERENCES "head_offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
