import { LoginThrottle } from './login-throttle';

describe('LoginThrottle', () => {
  it('blokir setelah 5x dalam semenit', () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 5; i++) expect(t.isBlocked('k')).toBe(false);
    expect(t.isBlocked('k')).toBe(true);
  });
});
