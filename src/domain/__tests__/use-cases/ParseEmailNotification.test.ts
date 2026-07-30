import { describe, it, expect } from 'vitest';
import { ParseEmailNotification } from '../../usecases/ParseEmailNotification';

describe('ParseEmailNotification', () => {

  it('detecta correctamente un gasto bancario en texto (Bancolombia)', () => {
    const subject = 'Bancolombia: Notificación de compra';
    const body = 'Bancolombia le informa compra por $45.000 en EXITO el 30/07/2026 14:15. Inquietudes al 018000.';

    const result = ParseEmailNotification.parse(subject, body, '2026-07-30');

    expect(result.isTransactional).toBe(true);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(45000);
    expect(result.bankName).toBe('Bancolombia');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detecta correctamente un ingreso en Nequi ("Te enviaron plata")', () => {
    const subject = '¡Te enviaron plata a tu Nequi!';
    const body = 'Te enviaron $ 150.000 de Pedro Pérez a tu cuenta Nequi. ¡Disfrútala!';

    const result = ParseEmailNotification.parse(subject, body, '2026-07-30');

    expect(result.isTransactional).toBe(true);
    expect(result.type).toBe('income');
    expect(result.amount).toBe(150000);
    expect(result.bankName).toBe('Nequi');
  });

  it('detecta correctamente un pago PSE (Davivienda / PSE)', () => {
    const subject = 'Notificación Pago PSE Aprobado';
    const body = 'Su Pago PSE fue aprobado por $120.000 para Vanti S.A. ESP el día 30/07/2026.';

    const result = ParseEmailNotification.parse(subject, body, '2026-07-30');

    expect(result.isTransactional).toBe(true);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(120000);
    expect(result.bankName).toBe('PSE');
  });

  it('descarta correctamente un correo publicitario o extracto mensual', () => {
    const subject = 'Tu extracto mensual de Cuenta de Ahorros está disponible';
    const body = 'Estimado cliente, adjunto encontrarás el resumen mensual de tu cuenta correspondiente a Junio.';

    const result = ParseEmailNotification.parse(subject, body, '2026-07-30');

    expect(result.isTransactional).toBe(false);
    expect(result.type).toBeNull();
    expect(result.amount).toBeNull();
  });

});
