import { HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  let body: any;
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: (_: number) => ({ json: (b: any) => (body = b) }) }),
    }),
    captured: () => body,
  };
}

describe('AllExceptionsFilter — PRD §18', () => {
  const OLD = process.env.NODE_ENV;
  afterEach(() => (process.env.NODE_ENV = OLD));

  it('prod: 500 disamarkan tanpa stack/SQL', () => {
    process.env.NODE_ENV = 'production';
    const h = host();
    new AllExceptionsFilter().catch(new Error('SELECT * FROM users .../secret'), h as any);
    expect(h.captured().message).toBe('Internal server error');
    expect(JSON.stringify(h.captured())).not.toMatch(/SELECT|secret/);
  });

  it('dev: 400 membawa pesan validasi', () => {
    const h = host();
    new AllExceptionsFilter().catch(new HttpException({ message: 'start_at harus < end_at' }, 400), h as any);
    expect(h.captured().message).toBe('start_at harus < end_at');
  });
});
