-- BR-18: maksimal satu request aktif (PENDING/APPROVED) per user per meeting (PRD §11).
CREATE UNIQUE INDEX "absence_requests_one_active"
  ON "absence_requests" ("user_id", "meeting_id")
  WHERE "status" IN ('PENDING', 'APPROVED');
