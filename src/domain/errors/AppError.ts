/**
 * ZenMoney — AppError
 *
 * Clase base para la jerarquía de errores tipados de la aplicación.
 * Separa el mensaje técnico para logs del mensaje amigable para el usuario (userMessage).
 */

export type AppErrorCode =
  | 'NETWORK_ERROR'
  | 'DUPLICATE_RECORD'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly isNetworkError: boolean;
  public readonly originalError?: any;

  constructor(
    message: string,
    userMessage: string,
    code: AppErrorCode = 'UNKNOWN_ERROR',
    isNetworkError: boolean = false,
    originalError?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.isNetworkError = isNetworkError;
    this.originalError = originalError;

    // Ajustar prototipo para instanceof en ES5/TS
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static network(userMessage = 'Error de conexión a internet. Por favor verifica tu red.'): AppError {
    return new AppError('Network connection failure', userMessage, 'NETWORK_ERROR', true);
  }

  static validation(userMessage: string): AppError {
    return new AppError(`Validation failed: ${userMessage}`, userMessage, 'VALIDATION_ERROR', false);
  }

  static unauthorized(userMessage = 'No tienes permisos suficientes o tu sesión ha expirado.'): AppError {
    return new AppError('Unauthorized access', userMessage, 'UNAUTHORIZED', false);
  }

  static duplicate(userMessage = 'El registro ya existe en el sistema.'): AppError {
    return new AppError('Duplicate entry', userMessage, 'DUPLICATE_RECORD', false);
  }

  static notFound(userMessage = 'El recurso solicitado no fue encontrado.'): AppError {
    return new AppError('Resource not found', userMessage, 'NOT_FOUND', false);
  }

  static fromUnknown(error: any): AppError {
    if (error instanceof AppError) return error;
    const msg = error?.message || String(error);
    return new AppError(msg, 'Ocurrió un error inesperado. Por favor reintenta.', 'UNKNOWN_ERROR', false, error);
  }
}
