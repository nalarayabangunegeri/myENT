-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "recurrence" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recurrence_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recurrence_parent_id" TEXT;

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "review_note" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correction_requests_user_id_meeting_id_idx" ON "correction_requests"("user_id", "meeting_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
