import { afterEach, describe, expect, it, vi } from 'vitest';
import { turnstileBypass, turnstileSecret } from './turnstile';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('turnstile gate (KURANG.md §5)', () => {
  it('dev + DISABLED=true → bypass', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('TURNSTILE_DISABLED', 'true');
    expect(turnstileBypass()).toBe(true);
  });

  it('production + DISABLED=true → TETAP tidak bypass', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TURNSTILE_DISABLED', 'true');
    expect(turnstileBypass()).toBe(false);
  });

  it('tanpa flag → tidak bypass di env mana pun', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('TURNSTILE_DISABLED', '');
    expect(turnstileBypass()).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(turnstileBypass()).toBe(false);
  });

  it('secret kosong → undefined (route menolak)', () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(turnstileSecret()).toBeUndefined();
    vi.stubEnv('TURNSTILE_SECRET_KEY', 's3cret');
    expect(turnstileSecret()).toBe('s3cret');
  });
});
