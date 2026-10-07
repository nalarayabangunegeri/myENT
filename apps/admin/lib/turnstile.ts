// Gerbang Turnstile untuk login BFF (KURANG.md §5).
// Bypass HANYA di non-production; production tanpa secret = tolak.
export function turnstileBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.TURNSTILE_DISABLED === 'true';
}

export function turnstileSecret(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY || undefined;
}
