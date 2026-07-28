import { describe, it, expect } from 'vitest';
import { AppError } from '../../errors/AppError';
import { SupabaseErrorMapper } from '../../../data/errors/SupabaseErrorMapper';

describe('AppError & SupabaseErrorMapper — Custom Error Handling', () => {

  describe('AppError Factory Methods', () => {
    it('crea correctamente errores de red con flag isNetworkError = true', () => {
      const err = AppError.network('Sin conexión');
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.userMessage).toBe('Sin conexión');
      expect(err.isNetworkError).toBe(true);
      expect(err.name).toBe('AppError');
    });

    it('crea errores de validación, duplicado, no encontrado y no autorizado', () => {
      const valErr = AppError.validation('Monto inválido');
      expect(valErr.code).toBe('VALIDATION_ERROR');

      const dupErr = AppError.duplicate('Ya existe la transacción');
      expect(dupErr.code).toBe('DUPLICATE_RECORD');

      const notFoundErr = AppError.notFound('Cuenta no encontrada');
      expect(notFoundErr.code).toBe('NOT_FOUND');

      const unauthErr = AppError.unauthorized('Sesión expirada');
      expect(unauthErr.code).toBe('UNAUTHORIZED');
    });

    it('convierte excepciones desconocidas en AppError', () => {
      const err = AppError.fromUnknown(new TypeError('Cannot read property x'));
      expect(err.code).toBe('UNKNOWN_ERROR');
      expect(err.userMessage).toBe('Ocurrió un error inesperado. Por favor reintenta.');
    });
  });

  describe('SupabaseErrorMapper', () => {
    it('mapea código de error PostgreSQL 23505 a AppError DUPLICATE_RECORD', () => {
      const pgError = { code: '23505', message: 'duplicate key value violates unique constraint' };
      const appErr = SupabaseErrorMapper.mapSupabaseError(pgError);

      expect(appErr.code).toBe('DUPLICATE_RECORD');
      expect(appErr.userMessage).toBe('El registro ya existe en el sistema.');
    });

    it('mapea código de error PostgreSQL 23503 (Foreign Key) a AppError VALIDATION_ERROR', () => {
      const pgError = { code: '23503', message: 'violates foreign key constraint' };
      const appErr = SupabaseErrorMapper.mapSupabaseError(pgError);

      expect(appErr.code).toBe('VALIDATION_ERROR');
      expect(appErr.userMessage).toContain('registro relacionado no existe');
    });

    it('mapea código de error PostgREST PGRST301 y 42501 a AppError UNAUTHORIZED', () => {
      const rlsError = { code: '42501', message: 'permission denied for table transactions' };
      const appErr = SupabaseErrorMapper.mapSupabaseError(rlsError);

      expect(appErr.code).toBe('UNAUTHORIZED');
      expect(appErr.userMessage).toContain('permisos');
    });

    it('detecta errores de red y los mapea a AppError NETWORK_ERROR', () => {
      const netError = { message: 'FetchError: Failed to fetch data from Supabase' };
      const appErr = SupabaseErrorMapper.mapSupabaseError(netError);

      expect(appErr.code).toBe('NETWORK_ERROR');
      expect(appErr.isNetworkError).toBe(true);
      expect(appErr.userMessage).toContain('conexión a internet');
    });
  });

});
