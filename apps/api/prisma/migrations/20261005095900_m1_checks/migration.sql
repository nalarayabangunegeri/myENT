-- Invariant waktu PRD §19 (Prisma belum mendukung CHECK; AGENTS §11).
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_time_chk" CHECK ("start_at" < "end_at");
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_window_chk" CHECK ("attendance_open_at" < "attendance_close_at");
