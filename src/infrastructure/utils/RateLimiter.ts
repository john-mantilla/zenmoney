import { AppError } from '../../domain/errors/AppError';

interface WindowRecord {
  timestamps: number[];
}

/**
 * Limitador de frecuencia (RateLimiter) con algoritmo de ventana deslizante en memoria.
 * Evita el abuso de solicitudes masivas hacia servicios de IA/Gemini, sincronización o DB.
 */
export class RateLimiter {
  private static store: Map<string, WindowRecord> = new Map();

  /**
   * Verifica si una solicitud bajo la clave dada supera el límite.
   */
  static checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.store.get(key) || { timestamps: [] };

    // Filtrar marcas de tiempo fuera de la ventana actual
    const validTimestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return false; // Límite excedido
    }

    validTimestamps.push(now);
    this.store.set(key, { timestamps: validTimestamps });
    return true;
  }

  /**
   * Enforza la tasa de solicitudes y lanza una excepción AppError si se supera el umbral.
   */
  static enforceRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number,
    customMessage = 'Has realizado demasiadas solicitudes seguidas. Por favor espera unos momentos antes de reintentar.'
  ): void {
    const isAllowed = this.checkRateLimit(key, maxRequests, windowMs);
    if (!isAllowed) {
      throw AppError.validation(customMessage);
    }
  }

  /**
   * Limpia los registros acumulados en memoria (útil para pruebas o reinicios).
   */
  static clear(): void {
    this.store.clear();
  }
}
