import { assertInside, haversineM } from './location';

describe('location — P2', () => {
  it('haversine Monas ±11 km dari Jakarta Selatan', () => {
    const d = haversineM(-6.1754, 106.8272, -6.26, 106.81);
    expect(d).toBeGreaterThan(9000);
    expect(d).toBeLessThan(12000);
  });

  it('tanpa radius = lolos; di luar radius ditolak', () => {
    expect(() => assertInside({ latitude: null, longitude: null, radiusM: null }, {})).not.toThrow();
    const m = { latitude: -6.1754, longitude: 106.8272, radiusM: 100 };
    expect(() => assertInside(m, { latitude: -6.1754, longitude: 106.8272 })).not.toThrow();
    expect(() => assertInside(m, {})).toThrow('Lokasi wajib');
    expect(() => assertInside(m, { latitude: -6.26, longitude: 106.81 })).toThrow('luar radius');
  });
});
