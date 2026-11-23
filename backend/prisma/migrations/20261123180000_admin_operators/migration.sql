-- CreateEnum
CREATE TYPE "AdminOperatorStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "admin_operators" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "status" "AdminOperatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "password_hash" VARCHAR(255) NOT NULL,
    "password_encrypted" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_operators_email_key" ON "admin_operators"("email");

-- CreateIndex
CREATE INDEX "admin_operators_status_idx" ON "admin_operators"("status");

-- CreateIndex
CREATE INDEX "admin_operators_created_at_idx" ON "admin_operators"("created_at");
