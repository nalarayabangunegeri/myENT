-- Satu klaim koreksi aktif per user per meeting (backlog §22.3, analog BR-18).
CREATE UNIQUE INDEX "correction_requests_one_active"
  ON "correction_requests" ("user_id", "meeting_id")
  WHERE "status" IN ('PENDING', 'APPROVED');
