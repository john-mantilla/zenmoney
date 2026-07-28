import { describe, it, expect } from 'vitest';
import { CalculateRegistrationStreak } from '../../usecases/CalculateRegistrationStreak';

describe('CalculateRegistrationStreak', () => {
  it('cuenta la racha activa incluyendo el día de hoy', () => {
    const dates = ['2026-07-13', '2026-07-12', '2026-07-11', '2026-07-10'];
    const streak = new CalculateRegistrationStreak().execute(dates, '2026-07-13');
    expect(streak).toBe(4);
  });

  it('no rompe la racha si hoy todavía no hay registro (el día no ha terminado)', () => {
    const dates = ['2026-07-12', '2026-07-11', '2026-07-10'];
    const streak = new CalculateRegistrationStreak().execute(dates, '2026-07-13');
    expect(streak).toBe(3);
  });

  it('la racha se detiene en el primer día sin registro', () => {
    const dates = ['2026-07-13', '2026-07-12', '2026-07-09'];
    const streak = new CalculateRegistrationStreak().execute(dates, '2026-07-13');
    expect(streak).toBe(2);
  });

  it('devuelve 0 si no hay actividad ni hoy ni ayer', () => {
    const dates = ['2026-07-01'];
    const streak = new CalculateRegistrationStreak().execute(dates, '2026-07-13');
    expect(streak).toBe(0);
  });

  it('ignora fechas duplicadas el mismo día', () => {
    const dates = ['2026-07-13', '2026-07-13', '2026-07-12'];
    const streak = new CalculateRegistrationStreak().execute(dates, '2026-07-13');
    expect(streak).toBe(2);
  });
});
