-- CreateEnum
CREATE TYPE "PasswordResetRole" AS ENUM ('SCHOOL', 'TEACHER');

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" UUID NOT NULL,
    "role" "PasswordResetRole" NOT NULL,
    "account_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_otps_email_role_idx" ON "password_reset_otps"("email", "role");

-- CreateIndex
CREATE INDEX "password_reset_otps_expires_at_idx" ON "password_reset_otps"("expires_at");
