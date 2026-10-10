-- Batas tebak per challenge 2FA (anti brute-force dalam satu window 5 menit).
ALTER TABLE "two_fa_challenges" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
