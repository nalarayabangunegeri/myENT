-- CreateTable
CREATE TABLE "two_fa_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_fa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_fa_challenges_user_id_idx" ON "two_fa_challenges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_recurrence_parent_id_start_at_key" ON "meetings"("recurrence_parent_id", "start_at");

-- AddForeignKey
ALTER TABLE "two_fa_challenges" ADD CONSTRAINT "two_fa_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

