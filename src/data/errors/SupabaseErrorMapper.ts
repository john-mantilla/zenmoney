import { AppError } from '../../domain/errors/AppError';

/**
 * Mapeador estático que traduce códigos de error de Postgres y PostgREST de Supabase
 * a instancias de AppError con mensajes explicativos en español para la UI.
 */
export class SupabaseErrorMapper {
  static mapSupabaseError(error: any): AppError {
    if (!error) {
      return AppError.fromUnknown(new Error('Unknown Supabase error'));
    }

    if (error instanceof AppError) {
      return error;
    }

    const code = String(error.code || error.statusCode || '');
    const message = error.message || String(error);

    // Detección de fallos de red / conexión
    if (
      message.includes('FetchError') ||
      message.includes('Network request failed') ||
      message.includes('Failed to fetch') ||
      code === 'FETCH_ERROR'
    ) {
      return AppError.network('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
    }

    // Errores conocidos de PostgreSQL / PostgREST
    switch (code) {
      case '23505': // Unique constraint violation
        return AppError.duplicate('El registro ya existe en el sistema.');

      case '23503': // Foreign key constraint violation
        return new AppError(
          message,
          'No se puede realizar la acción: el registro relacionado no existe.',
          'VALIDATION_ERROR',
          false,
          error
        );

      case '23502': // Not null constraint violation
        return new AppError(
          message,
          'Faltan datos obligatorios para completar la operación.',
          'VALIDATION_ERROR',
          false,
          error
        );

      case '42501': // RLS Permission denied
      case 'PGRST301': // JWT expired / Invalid auth
        return AppError.unauthorized('No tienes permisos para realizar esta acción o tu sesión ha caducado.');

      case 'PGRST116': // Row not found
      case '42P01': // Table not found
        return AppError.notFound('El registro o la vista solicitada no fue encontrada.');

      default:
        return new AppError(message, message || 'Error al procesar la solicitud en el servidor.', 'SERVER_ERROR', false, error);
    }
  }
}
