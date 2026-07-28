import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../utils/RateLimiter';
import { AppError } from '../../domain/errors/AppError';

describe('RateLimiter Infrastructure Utility', () => {
  beforeEach(() => {
    RateLimiter.clear();
  });

  it('permite solicitudes dentro del límite configurado', () => {
    const key = 'test_ai_endpoint';
    expect(RateLimiter.checkRateLimit(key, 3, 1000)).toBe(true);
    expect(RateLimiter.checkRateLimit(key, 3, 1000)).toBe(true);
    expect(RateLimiter.checkRateLimit(key, 3, 1000)).toBe(true);
  });

  it('bloquea la cuarta solicitud cuando el máximo permitido es 3 por segundo', () => {
    const key = 'test_ai_endpoint';
    RateLimiter.checkRateLimit(key, 3, 1000);
    RateLimiter.checkRateLimit(key, 3, 1000);
    RateLimiter.checkRateLimit(key, 3, 1000);

    expect(RateLimiter.checkRateLimit(key, 3, 1000)).toBe(false);
  });

  it('lanza una excepción AppError al llamar a enforceRateLimit si se excede el umbral', () => {
    const key = 'test_enforce';
    RateLimiter.checkRateLimit(key, 1, 1000);

    expect(() => {
      RateLimiter.enforceRateLimit(key, 1, 1000, 'Límite alcanzado');
    }).toThrowError(AppError);
  });
});
