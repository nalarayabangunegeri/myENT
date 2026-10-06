-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION', 'ABSENT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('SELF', 'ABSENCE_APPROVAL', 'AUTO_ALPHA', 'MANUAL');

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "selfie_object_key" TEXT,
    "selfie_deleted_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "adjusted_at" TIMESTAMPTZ,
    "adjustment_reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_meeting_id_idx" ON "attendance"("meeting_id");

-- CreateIndex
CREATE INDEX "attendance_user_id_idx" ON "attendance"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_user_id_meeting_id_key" ON "attendance"("user_id", "meeting_id");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
